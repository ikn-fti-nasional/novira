import { and, eq, inArray, sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "$lib/server/db/index.js";
import { cameras, incidents, auditLog, notifications, appSettings } from "$lib/server/db/schema.js";
import { storeUpload } from "$lib/server/uploads.js";
import { generateId } from "$lib/server/id.js";
import type { JenisSampah } from "$lib/types/novira.js";
import { hitungPrioritas, serializeRincian } from "./prioritas.js";

/**
 * Twice-daily (12:00 & 15:00 WIB, see scheduler.ts) Bandung CCTV detection
 * cycle: one still frame per camera, run through pLitter's `street` model,
 * matched against still-open incidents by bbox overlap so a litter pile that
 * persists across snapshots extends its duration/SLA instead of creating a
 * duplicate. This is deliberately NOT frame-by-frame video tracking (no clip
 * is ever stored) -- see plan/BANDUNG_FINETUNE.md for why a single snapshot
 * per cycle plus vehicle-overlap suppression is the current tradeoff.
 */

const PLITTER_API_URL = process.env.PLITTER_API_URL ?? "http://localhost:8000";
const ORIGIN = process.env.ORIGIN ?? "http://localhost:5173";
export const BANDUNG_KOTA = "Kota Bandung";

/**
 * Server pLitter menjalankan inferensi model secara sinkron di satu proses --
 * satu siklus deteksi yang sedang berjalan bisa membuatnya lambat merespons,
 * jadi timeout di sini dibuat pendek: kalau `/health` tidak jawab dalam waktu
 * segini, anggap saja server tidak siap dipakai daripada operator menunggu
 * lama hanya untuk tahu analisanya gagal total.
 */
export async function cekKesehatanPlitter(timeoutMs = 4000): Promise<boolean> {
	try {
		const res = await fetch(new URL("/health", PLITTER_API_URL), {
			signal: AbortSignal.timeout(timeoutMs),
		});
		return res.ok;
	} catch {
		return false;
	}
}

/** Model pLitter yang boleh dipakai untuk analisa CCTV -- `urban` tidak diaktifkan di deployment ini (butuh weights GPL terpisah, lihat pLitter/Dockerfile), jadi sengaja tidak masuk daftar. */
export const MODEL_TYPES_TERSEDIA = ["street", "cctv", "taco"] as const;
export type ModelTypeDeteksi = (typeof MODEL_TYPES_TERSEDIA)[number];

const SETTING_KEY_MODEL = "deteksi_model_type";
const SETTING_KEY_CONF = "deteksi_conf_thres";
const DEFAULT_MODEL_TYPE: ModelTypeDeteksi = "street";
const DEFAULT_CONF_THRES = 0.3;

export interface PengaturanModelDeteksi {
	modelType: ModelTypeDeteksi;
	confThres: number;
}

/**
 * Model & ambang kepercayaan dipakai siklus deteksi CCTV -- diatur admin di
 * halaman Pengaturan (appSettings), bukan lagi hardcode. `street` tetap
 * default aman untuk kamera jalan Bandung (lihat BANDUNG_FINETUNE.md); ganti
 * ke `cctv` untuk kamera yang mengarah ke sungai/kanal (sampah apung).
 */
export async function ambilPengaturanModel(): Promise<PengaturanModelDeteksi> {
	const rows = await db
		.select()
		.from(appSettings)
		.where(inArray(appSettings.key, [SETTING_KEY_MODEL, SETTING_KEY_CONF]));
	const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

	const rawModel = map[SETTING_KEY_MODEL];
	const modelType = (MODEL_TYPES_TERSEDIA as readonly string[]).includes(rawModel ?? "")
		? (rawModel as ModelTypeDeteksi)
		: DEFAULT_MODEL_TYPE;

	const rawConf = Number(map[SETTING_KEY_CONF]);
	const confThres = Number.isFinite(rawConf) && rawConf > 0 && rawConf <= 1 ? rawConf : DEFAULT_CONF_THRES;

	return { modelType, confThres };
}

export async function simpanPengaturanModel(pengaturan: PengaturanModelDeteksi): Promise<void> {
	const now = new Date();
	for (const [key, value] of [
		[SETTING_KEY_MODEL, pengaturan.modelType],
		[SETTING_KEY_CONF, String(pengaturan.confThres)],
	] as const) {
		await db
			.insert(appSettings)
			.values({ key, value, updatedAt: now })
			.onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: now } });
	}
}

export interface ProgresAnalisaManual {
	cameraId: string;
	cameraNama: string;
	index: number;
	total: number;
	status: "memproses" | "selesai" | "gagal";
}

interface PlitterDetection {
	class_id: number;
	class_name: string;
	score: number;
	box: [number, number, number, number]; // pixel-space x1,y1,x2,y2
	detector?: string;
}

interface SnapshotResponse {
	source: string;
	model_type: string;
	width: number;
	height: number;
	captured_at: string;
	detections: PlitterDetection[];
	image_base64: string;
	vehicle_blockers: number;
}

// Only the `street` model's 4 classes matter today. `Trash bin` is a fixture
// (not litter) so it's intentionally excluded -- see BANDUNG_FINETUNE.md for
// why `street` (not `cctv`/`urban`) is the safe default for these cameras.
const CLASS_TO_JENIS: Partial<Record<string, JenisSampah>> = {
	Pile: "tumpukan_sampah",
	Plastic: "kantong_plastik",
	"Face mask": "kantong_plastik",
};

// Keparahan tidak lagi berupa tabel statis jenis→level. Sekarang diturunkan
// dari skor mesin prioritas (`prioritas.ts`), yang juga memperhitungkan
// durasi, sensitivitas lokasi, dan kekambuhan titik — dua tumpukan sampah
// dengan label model yang sama tidak otomatis sama gentingnya.

const MATCH_IOU_THRESHOLD = 0.2;
const SLA_HAMPIR_BREACH_MS = 12 * 60 * 60 * 1000;
const SLA_MELANGGAR_MS = 24 * 60 * 60 * 1000;

interface NormalizedBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

function iou(a: NormalizedBox, b: NormalizedBox): number {
	const ax2 = a.x + a.width;
	const ay2 = a.y + a.height;
	const bx2 = b.x + b.width;
	const by2 = b.y + b.height;
	const ix1 = Math.max(a.x, b.x);
	const iy1 = Math.max(a.y, b.y);
	const ix2 = Math.min(ax2, bx2);
	const iy2 = Math.min(ay2, by2);
	const interW = Math.max(0, ix2 - ix1);
	const interH = Math.max(0, iy2 - iy1);
	const inter = interW * interH;
	const union = a.width * a.height + b.width * b.height - inter;
	return union <= 0 ? 0 : inter / union;
}

// Mirrors the `bandung` entry of `SOURCES` in
// src/routes/api/cctv/[...path]/+server.ts. That proxy exists to unblock
// *browser* playback (CORS + Origin/Referer spoofing for hls.js) -- it's not
// needed for server-to-server capture: cv2.VideoCapture on the Python side
// opens these exact upstream URLs directly (verified against real Bandung
// feeds). Routing capture through our own Node proxy was tried first and
// reliably failed/timed out there (cv2's HLS demuxer re-requesting .ts
// segments through the proxy didn't behave like a browser's hls.js does), so
// the detection cycle talks to the upstream directly instead.
const BANDUNG_UPSTREAM_BASE = "https://pelindung.bandung.go.id:3443/video/";
const BANDUNG_PROXY_PREFIX = "/api/cctv/bandung/";

/** `urlStream` is stored as the browser-facing proxied path; resolve it to the real upstream URL for server-side capture. */
function resolveStreamUrl(urlStream: string): string {
	if (urlStream.startsWith(BANDUNG_PROXY_PREFIX)) {
		return BANDUNG_UPSTREAM_BASE + urlStream.slice(BANDUNG_PROXY_PREFIX.length);
	}
	if (/^https?:\/\//i.test(urlStream)) return urlStream;
	return new URL(urlStream, ORIGIN).toString();
}

/**
 * Berapa kamera diproses bersamaan dalam satu siklus.
 *
 * Registri Bandung berisi ~290 kamera. Menembakkan semuanya sekaligus
 * (`Promise.allSettled` atas seluruh daftar) akan mengirim 290 permintaan
 * tangkap-bingkai + inferensi serentak ke satu proses pLitter — layanannya
 * akan antre habis lalu seluruh permintaan gagal karena timeout 45 detik,
 * sehingga siklusnya justru tidak menghasilkan deteksi apa pun.
 *
 * Dengan batas ini satu siklus memakan waktu kira-kira
 * `290 / 6 × waktu-per-kamera`; pada ~20 detik per kamera itu sekitar 16
 * menit — masih jauh di dalam jeda antar-siklus (12:00 dan 15:00 WIB).
 * Naikkan hanya bila layanan inferensi berjalan di GPU yang lebih besar.
 */
const MAKS_KAMERA_PARALEL = 6;

/**
 * `Promise.allSettled` dengan batas konkurensi: menjaga urutan hasil tetap
 * sama dengan urutan masukan, karena pemanggil memasangkan `results[i]`
 * dengan `bandungCameras[i]` untuk menyusun laporan errornya.
 */
async function petaTerbatas<T, R>(
	items: readonly T[],
	kerjakan: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
	const hasil = new Array<PromiseSettledResult<R>>(items.length);
	let berikutnya = 0;

	async function pekerja(): Promise<void> {
		for (;;) {
			const i = berikutnya++;
			if (i >= items.length) return;
			try {
				hasil[i] = { status: "fulfilled", value: await kerjakan(items[i]) };
			} catch (reason) {
				hasil[i] = { status: "rejected", reason };
			}
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(MAKS_KAMERA_PARALEL, items.length) }, pekerja)
	);
	return hasil;
}

export interface SiklusDeteksiSummary {
	camerasProcessed: number;
	camerasFailed: number;
	insidenBaru: number;
	insidenDiperbarui: number;
	errors: { cameraId: string; nama: string; error: string }[];
}

/** Satu deteksi mentah dari analisa manual -- belum disimpan sebagai insiden sampai operator menekan "Verifikasi". */
export interface TemuanManual {
	/** ID sintetis khusus untuk pelacakan di UI -- temuan belum punya baris `incidents` sampai diverifikasi. */
	key: string;
	cameraId: string;
	cameraNama: string;
	kota: string;
	kecamatan: string | null;
	jenisSampah: JenisSampah;
	labelSampah: string;
	skor: number;
	bbox: NormalizedBox;
	urlSnapshot: string;
}

export interface AnalisaManualSummary {
	camerasProcessed: number;
	camerasFailed: number;
	temuan: TemuanManual[];
	errors: { cameraId: string; nama: string; error: string }[];
}

type CameraRow = typeof cameras.$inferSelect;
type CameraRef = Pick<CameraRow, "id" | "nama" | "kota" | "kecamatan">;

export async function jalankanSiklusDeteksi(): Promise<SiklusDeteksiSummary> {
	const bandungCameras = await db.select().from(cameras).where(eq(cameras.kota, BANDUNG_KOTA));
	const now = new Date();
	const pengaturan = await ambilPengaturanModel();

	const results = await petaTerbatas(bandungCameras, (camera) =>
		prosesKamera(camera, now, pengaturan)
	);

	const summary: SiklusDeteksiSummary = {
		camerasProcessed: 0,
		camerasFailed: 0,
		insidenBaru: 0,
		insidenDiperbarui: 0,
		errors: [],
	};

	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		const camera = bandungCameras[i];
		if (result.status === "fulfilled") {
			summary.camerasProcessed++;
			summary.insidenBaru += result.value.insidenBaru;
			summary.insidenDiperbarui += result.value.insidenDiperbarui;
		} else {
			summary.camerasFailed++;
			const message =
				result.reason instanceof Error ? result.reason.message : String(result.reason);
			summary.errors.push({ cameraId: camera.id, nama: camera.nama, error: message });
		}
	}

	await db.insert(auditLog).values({
		id: generateId(10),
		waktu: now,
		pengguna: "sistem",
		peran: "SISTEM",
		tindakan: "Siklus deteksi AI CCTV Bandung",
		rincian:
			`${summary.camerasProcessed} kamera diproses, ${summary.camerasFailed} gagal, ` +
			`${summary.insidenBaru} insiden baru, ${summary.insidenDiperbarui} insiden diperbarui`,
		wilayah: BANDUNG_KOTA,
		tipe: "DETEKSI_AI",
	});

	// Notifikasi global (userId null -- semua pengguna melihatnya, lihat pola
	// di hooks terkait notifikasi) satu per siklus, bukan per insiden, supaya
	// operator tidak kebanjiran notifikasi saat banyak kamera mendeteksi
	// sekaligus.
	if (summary.insidenBaru > 0) {
		await db.insert(notifications).values({
			id: generateId(10),
			userId: null,
			title: `${summary.insidenBaru} insiden sampah baru terdeteksi`,
			message: `Siklus deteksi CCTV ${BANDUNG_KOTA} menemukan ${summary.insidenBaru} insiden baru (${summary.insidenDiperbarui} insiden lama diperbarui). Cek halaman Insiden untuk menugaskan petugas.`,
			type: "warning",
		});
	}

	return summary;
}

interface HasilTangkapan {
	urlSnapshot: string;
	relevan: { detection: PlitterDetection; jenisSampah: JenisSampah; bbox: NormalizedBox }[];
}

/**
 * Ambil satu cuplikan dari kamera dan jalankan model deteksi -- tanpa
 * menyentuh tabel `incidents`. Dipakai oleh siklus otomatis (yang lalu
 * mencocokkan & menyimpan tiap deteksi lewat `terapkanDeteksi`) maupun
 * analisa manual (yang menahan hasilnya sampai operator menekan "Verifikasi").
 */
function escapeXml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const KOTAK_STROKE = "#ef4444"; // red-500 -- konsisten dengan warna alert/insiden di UI

/**
 * Foto bukti yang disimpan HARUS berupa hasil yang sudah dianalisa model
 * (dengan kotak deteksi), bukan cuplikan mentah -- operator memverifikasi apa
 * yang dilihat model, bukan cuplikan yang belum tentu menunjukkan mana yang
 * terdeteksi. Kalau composite gagal (mis. cuplikan bukan JPEG valid), foto
 * asli tetap disimpan daripada evidence-nya hilang sama sekali.
 */
async function gambarKotakDeteksi(
	buffer: Buffer,
	width: number,
	height: number,
	deteksi: { detection: PlitterDetection }[]
): Promise<Buffer> {
	if (deteksi.length === 0) return buffer;

	const elemen = deteksi
		.map(({ detection }) => {
			const [x1, y1, x2, y2] = detection.box;
			const w = Math.max(1, x2 - x1);
			const h = Math.max(1, y2 - y1);
			const label = `${detection.class_name} ${Math.round(detection.score * 100)}%`;
			const labelWidth = Math.max(40, label.length * 7 + 12);
			const labelY = y1 > 20 ? y1 : y2 + 18;
			return `
				<rect x="${x1}" y="${y1}" width="${w}" height="${h}" fill="none" stroke="${KOTAK_STROKE}" stroke-width="3" />
				<rect x="${x1}" y="${labelY - 15}" width="${labelWidth}" height="17" fill="${KOTAK_STROKE}" />
				<text x="${x1 + 5}" y="${labelY - 2}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff">${escapeXml(label)}</text>
			`;
		})
		.join("");
	const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${elemen}</svg>`;

	try {
		return await sharp(buffer)
			.composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
			.jpeg()
			.toBuffer();
	} catch {
		return buffer;
	}
}

async function tangkapKamera(
	camera: CameraRow,
	now: Date,
	pengaturan: PengaturanModelDeteksi
): Promise<HasilTangkapan> {
	if (!camera.urlStream) {
		throw new Error("kamera tidak memiliki urlStream");
	}
	const streamUrl = resolveStreamUrl(camera.urlStream);

	const endpoint = new URL("/detect/snapshot", PLITTER_API_URL);
	endpoint.searchParams.set("source", streamUrl);
	endpoint.searchParams.set("model_type", pengaturan.modelType);
	endpoint.searchParams.set("slice_infer", "true");
	endpoint.searchParams.set("suppress_vehicles", "true");
	endpoint.searchParams.set("conf_thres", String(pengaturan.confThres));

	let res: Response;
	try {
		res = await fetch(endpoint, { signal: AbortSignal.timeout(45_000) });
	} catch (err) {
		await db
			.update(cameras)
			.set({ status: "OFFLINE", updatedAt: now })
			.where(eq(cameras.id, camera.id));
		throw err;
	}
	if (!res.ok) {
		await db
			.update(cameras)
			.set({ status: "OFFLINE", updatedAt: now })
			.where(eq(cameras.id, camera.id));
		const body = await res.text().catch(() => "");
		throw new Error(`pLitter API ${res.status}: ${body.slice(0, 300)}`);
	}

	const data = (await res.json()) as SnapshotResponse;

	const relevanMentah = data.detections
		.map((d) => ({ detection: d, jenisSampah: CLASS_TO_JENIS[d.class_name] }))
		.filter(
			(d): d is { detection: PlitterDetection; jenisSampah: JenisSampah } =>
				d.jenisSampah !== undefined
		);

	let urlSnapshot = "";
	try {
		const buffer = Buffer.from(data.image_base64, "base64");
		const fotoFinal = await gambarKotakDeteksi(buffer, data.width, data.height, relevanMentah);
		const file = new File([new Uint8Array(fotoFinal)], `${camera.id}-${now.getTime()}.jpg`, {
			type: "image/jpeg",
		});
		urlSnapshot = await storeUpload(file, "foto");
	} catch {
		// Detections still matter even if we couldn't persist the evidence photo.
	}

	await db
		.update(cameras)
		.set({ status: "ONLINE", urlSnapshot: urlSnapshot || undefined, updatedAt: now })
		.where(eq(cameras.id, camera.id));

	const relevan = relevanMentah.map(({ detection, jenisSampah }) => {
		const [x1, y1, x2, y2] = detection.box;
		const bbox: NormalizedBox = {
			x: x1 / data.width,
			y: y1 / data.height,
			width: (x2 - x1) / data.width,
			height: (y2 - y1) / data.height,
		};
		return { detection, jenisSampah, bbox };
	});

	return { urlSnapshot, relevan };
}

/**
 * Cocokkan satu deteksi dengan insiden terbuka kamera ini (lewat overlap
 * bbox) lalu perbarui insiden itu, atau buat insiden baru kalau tak ada yang
 * cocok. `openIncidents` di-splice di tempat supaya deteksi berikutnya dalam
 * kamera/siklus yang sama tidak mencocokkan baris yang sudah dipakai.
 */
async function terapkanDeteksi(params: {
	camera: CameraRef;
	now: Date;
	jenisSampah: JenisSampah;
	labelSampah: string;
	skor: number;
	bbox: NormalizedBox;
	urlSnapshot: string;
	openIncidents: (typeof incidents.$inferSelect)[];
	kekambuhanPerKamera: number;
}): Promise<{ insidenId: string; baru: boolean }> {
	const { camera, now, jenisSampah, labelSampah, skor, bbox, urlSnapshot, openIncidents, kekambuhanPerKamera } =
		params;

	const matchIndex = openIncidents.findIndex(
		(inc) =>
			inc.jenisSampah === jenisSampah &&
			iou(bbox, {
				x: Number(inc.bboxX),
				y: Number(inc.bboxY),
				width: Number(inc.bboxWidth),
				height: Number(inc.bboxHeight),
			}) > MATCH_IOU_THRESHOLD
	);

	if (matchIndex !== -1) {
		const match = openIncidents[matchIndex];
		const elapsedMs = now.getTime() - match.pertamaDilihat.getTime();
		const statusSla =
			elapsedMs >= SLA_MELANGGAR_MS
				? "MELANGGAR_SLA"
				: elapsedMs >= SLA_HAMPIR_BREACH_MS
					? "HAMPIR_BREACH"
					: "TEPAT_WAKTU";

		// Prioritas dihitung ulang setiap siklus: durasinya bertambah, jadi
		// urutan antrian operator harus ikut bergeser. Kalau hanya dihitung
		// saat insiden lahir, tumpukan yang dibiarkan tiga hari akan selamanya
		// duduk di prioritas hari pertamanya.
		const prioritas = hitungPrioritas({
			jenisSampah,
			durasiJam: elapsedMs / 3600_000,
			tingkatKepercayaan: skor,
			teksLokasi: `${camera.nama} ${camera.kecamatan ?? ""} ${camera.kota}`,
			kekambuhan: kekambuhanPerKamera,
			laporanWargaMenguatkan: 0,
		});

		await db
			.update(incidents)
			.set({
				terakhirDilihat: now,
				statusSla,
				keparahan: prioritas.keparahan,
				skorPrioritas: prioritas.skor,
				rincianPrioritas: serializeRincian(prioritas.rincian),
				tingkatKepercayaan: String(skor),
				urlSnapshot: urlSnapshot || match.urlSnapshot,
				bboxX: String(bbox.x),
				bboxY: String(bbox.y),
				bboxWidth: String(bbox.width),
				bboxHeight: String(bbox.height),
				updatedAt: now,
			})
			.where(eq(incidents.id, match.id));

		// Drop it from the pool so a second detection this cycle can't re-match the same row.
		openIncidents.splice(matchIndex, 1);
		return { insidenId: match.id, baru: false };
	}

	const prioritas = hitungPrioritas({
		jenisSampah,
		durasiJam: 0,
		tingkatKepercayaan: skor,
		teksLokasi: `${camera.nama} ${camera.kecamatan ?? ""} ${camera.kota}`,
		kekambuhan: kekambuhanPerKamera,
		laporanWargaMenguatkan: 0,
	});

	const id = generateId(10);
	await db.insert(incidents).values({
		id,
		cameraId: camera.id,
		sumber: "CCTV",
		jenisSampah,
		labelSampah,
		pertamaDilihat: now,
		terakhirDilihat: now,
		status: "AKTIF",
		keparahan: prioritas.keparahan,
		skorPrioritas: prioritas.skor,
		rincianPrioritas: serializeRincian(prioritas.rincian),
		tingkatKepercayaan: String(skor),
		urlSnapshot,
		urlSnapshotPertama: urlSnapshot,
		statusSla: "TEPAT_WAKTU",
		bboxX: String(bbox.x),
		bboxY: String(bbox.y),
		bboxWidth: String(bbox.width),
		bboxHeight: String(bbox.height),
	});
	return { insidenId: id, baru: true };
}

async function kondisiKamera(cameraId: string) {
	const openIncidents = await db
		.select()
		.from(incidents)
		.where(and(eq(incidents.cameraId, cameraId), inArray(incidents.status, ["AKTIF", "PERINGATAN"])));

	// Berapa kali titik ini pernah dibersihkan lalu kotor lagi. Dihitung sekali
	// per kamera (bukan per deteksi) karena nilainya sama untuk semua deteksi
	// dalam satu frame.
	const [kambuhRow] = await db
		.select({ jumlah: sql<number>`count(*)::int` })
		.from(incidents)
		.where(and(eq(incidents.cameraId, cameraId), eq(incidents.status, "SELESAI")));

	return { openIncidents, kekambuhanPerKamera: kambuhRow?.jumlah ?? 0 };
}

async function prosesKamera(
	camera: CameraRow,
	now: Date,
	pengaturan: PengaturanModelDeteksi
): Promise<{ insidenBaru: number; insidenDiperbarui: number }> {
	const { urlSnapshot, relevan } = await tangkapKamera(camera, now, pengaturan);

	if (relevan.length === 0) {
		return { insidenBaru: 0, insidenDiperbarui: 0 };
	}

	const { openIncidents, kekambuhanPerKamera } = await kondisiKamera(camera.id);

	let insidenBaru = 0;
	let insidenDiperbarui = 0;

	for (const { detection, jenisSampah, bbox } of relevan) {
		const { baru } = await terapkanDeteksi({
			camera,
			now,
			jenisSampah,
			labelSampah: detection.class_name,
			skor: detection.score,
			bbox,
			urlSnapshot,
			openIncidents,
			kekambuhanPerKamera,
		});
		if (baru) insidenBaru++;
		else insidenDiperbarui++;
	}

	return { insidenBaru, insidenDiperbarui };
}

/**
 * Versi manual dari siklus deteksi: menangkap & menganalisa seluruh kamera
 * Bandung persis seperti siklus otomatis, tapi TIDAK menulis apa pun ke
 * `incidents` -- hasilnya dikembalikan sebagai `TemuanManual` untuk
 * ditinjau operator dan disimpan satu per satu lewat `verifikasiTemuanManual`.
 */
export async function jalankanAnalisaManual(
	verifier: { nama: string; peran: string },
	onProgress?: (progres: ProgresAnalisaManual) => void,
	/** Kosong/undefined berarti seluruh kamera Bandung -- lihat "pilih semua" di modal analisa manual. */
	cameraIds?: string[]
): Promise<AnalisaManualSummary> {
	const bandungCameras =
		cameraIds && cameraIds.length > 0
			? await db
					.select()
					.from(cameras)
					.where(and(eq(cameras.kota, BANDUNG_KOTA), inArray(cameras.id, cameraIds)))
			: await db.select().from(cameras).where(eq(cameras.kota, BANDUNG_KOTA));
	const now = new Date();
	const total = bandungCameras.length;
	let selesai = 0;
	const pengaturan = await ambilPengaturanModel();

	const results = await petaTerbatas(bandungCameras, async (camera) => {
		onProgress?.({
			cameraId: camera.id,
			cameraNama: camera.nama,
			index: selesai,
			total,
			status: "memproses",
		});
		try {
			const hasil = await tangkapKamera(camera, now, pengaturan);
			selesai++;
			onProgress?.({
				cameraId: camera.id,
				cameraNama: camera.nama,
				index: selesai,
				total,
				status: "selesai",
			});
			return hasil;
		} catch (err) {
			selesai++;
			onProgress?.({
				cameraId: camera.id,
				cameraNama: camera.nama,
				index: selesai,
				total,
				status: "gagal",
			});
			throw err;
		}
	});

	const summary: AnalisaManualSummary = {
		camerasProcessed: 0,
		camerasFailed: 0,
		temuan: [],
		errors: [],
	};

	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		const camera = bandungCameras[i];
		if (result.status === "fulfilled") {
			summary.camerasProcessed++;
			for (const { detection, jenisSampah, bbox } of result.value.relevan) {
				summary.temuan.push({
					key: generateId(8),
					cameraId: camera.id,
					cameraNama: camera.nama,
					kota: camera.kota,
					kecamatan: camera.kecamatan,
					jenisSampah,
					labelSampah: detection.class_name,
					skor: detection.score,
					bbox,
					urlSnapshot: result.value.urlSnapshot,
				});
			}
		} else {
			summary.camerasFailed++;
			const message =
				result.reason instanceof Error ? result.reason.message : String(result.reason);
			summary.errors.push({ cameraId: camera.id, nama: camera.nama, error: message });
		}
	}

	await db.insert(auditLog).values({
		id: generateId(10),
		waktu: now,
		pengguna: verifier.nama,
		peran: verifier.peran,
		tindakan: "Analisa manual CCTV dijalankan",
		rincian:
			`${summary.camerasProcessed} kamera diproses, ${summary.camerasFailed} gagal, ` +
			`${summary.temuan.length} temuan menunggu verifikasi`,
		wilayah: BANDUNG_KOTA,
		tipe: "DETEKSI_AI",
	});

	return summary;
}

/**
 * Simpan satu temuan dari analisa manual sebagai insiden -- baru dipanggil
 * setelah operator menekan "Verifikasi", sejalan dengan aturan "AI tidak
 * pernah memutuskan sendiri" (lihat CLAUDE.md): model hanya merekomendasikan,
 * operator yang mengonfirmasi, dan konfirmasi itu tercatat di audit_log.
 */
export async function verifikasiTemuanManual(
	temuan: TemuanManual,
	verifier: { nama: string; peran: string }
): Promise<{ insidenId: string; baru: boolean }> {
	const now = new Date();
	const { openIncidents, kekambuhanPerKamera } = await kondisiKamera(temuan.cameraId);

	const hasil = await terapkanDeteksi({
		camera: { id: temuan.cameraId, nama: temuan.cameraNama, kota: temuan.kota, kecamatan: temuan.kecamatan },
		now,
		jenisSampah: temuan.jenisSampah,
		labelSampah: temuan.labelSampah,
		skor: temuan.skor,
		bbox: temuan.bbox,
		urlSnapshot: temuan.urlSnapshot,
		openIncidents,
		kekambuhanPerKamera,
	});

	await db.insert(auditLog).values({
		id: generateId(10),
		waktu: now,
		pengguna: verifier.nama,
		peran: verifier.peran,
		tindakan: hasil.baru
			? "Verifikasi temuan analisa manual → insiden baru"
			: "Verifikasi temuan analisa manual → insiden diperbarui",
		rincian: `${temuan.cameraNama}: ${temuan.labelSampah} (keyakinan ${(temuan.skor * 100).toFixed(0)}%)`,
		wilayah: temuan.kota,
		tipe: "DETEKSI_AI",
		incidentId: hasil.insidenId,
	});

	return hasil;
}
