import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "$lib/server/db/index.js";
import {
	auditLog,
	cameras,
	incidents,
	notifications,
	publicReports,
	reporterTrust,
} from "$lib/server/db/schema.js";
import { generateId } from "$lib/server/id.js";
import type { JenisSampah } from "$lib/types/novira.js";
import { cariTerdekat, jarakMeter, normalisasiTelepon, parseTitik, type Titik } from "./geo.js";
import { hitungPrioritas, serializeRincian, type FaktorPrioritas } from "./prioritas.js";

/**
 * Alur laporan warga: kirim → pindai AI → triase → verifikasi → insiden.
 *
 * Sebelumnya laporan warga adalah kantong buntu — operator hanya bisa
 * mengganti status di dropdown, laporannya tidak pernah menjadi pekerjaan
 * nyata dan pelapor tidak pernah tahu kelanjutannya. File ini menutup
 * lingkaran itu.
 *
 * Prinsip yang dipegang: **AI menyaring, manusia memutuskan.** Tidak ada
 * jalur di file ini yang mengubah status laporan menjadi valid/ditolak secara
 * otomatis. Model hanya mengisi kolom `ai*` dan menghasilkan rekomendasi;
 * perubahan status selalu berasal dari aksi operator dan selalu tercatat di
 * `audit_log`. Itu penting karena model kami dilatih pada citra CCTV jalan,
 * sedangkan foto warga diambil dari ponsel pada jarak dan sudut yang sangat
 * berbeda — akurasinya tidak layak dijadikan hakim tunggal.
 */

const PLITTER_API_URL = process.env.PLITTER_API_URL ?? "http://localhost:8000";

/** Radius yang dianggap "lokasi yang sama" untuk penggabungan duplikat. */
const RADIUS_DUPLIKAT_METER = 150;
/** Laporan lebih tua dari ini tidak lagi dianggap duplikat — sampah baru di titik lama itu insiden baru. */
const JENDELA_DUPLIKAT_JAM = 48;
/** Radius pencarian kamera terdekat saat menautkan insiden hasil laporan ke sebuah kamera. */
const RADIUS_KAMERA_METER = 500;

const SKOR_AI_TINGGI = 0.45;
const SKOR_AI_RENDAH = 0.2;

export type RekomendasiAi =
	| "SANGAT_MUNGKIN_VALID"
	| "PERLU_TINJAUAN"
	| "KEMUNGKINAN_SPAM"
	| "GAGAL_PINDAI";

/** Pemetaan kelas mentah model → enum jenis sampah kami. Sengaja sama dengan `deteksi.ts`. */
const CLASS_TO_JENIS: Partial<Record<string, JenisSampah>> = {
	Pile: "tumpukan_sampah",
	Plastic: "kantong_plastik",
	"Face mask": "kantong_plastik",
};

const JENIS_VALID: readonly JenisSampah[] = [
	"tumpukan_sampah",
	"kantong_plastik",
	"kardus_kemasan",
	"botol_minuman",
	"pembuangan_liar_besar",
	"puing_bangunan",
];

interface PlitterDetection {
	class_id: number;
	class_name: string;
	score: number;
	box: [number, number, number, number];
}

interface ImageDetectionResponse {
	filename: string;
	model_type: string;
	width: number;
	height: number;
	detections: PlitterDetection[];
}

/**
 * Kode pelacakan publik. Alfabet sengaja tanpa 0/O/1/I/L supaya kode yang
 * dibacakan lewat telepon atau disalin dari layar ponsel tidak salah ketik —
 * pelapor kami sebagian besar mengaksesnya dari HP di lapangan.
 */
const ALFABET_KODE = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function buatKodeTracking(): string {
	let out = "";
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	for (const b of bytes) out += ALFABET_KODE[b % ALFABET_KODE.length];
	return `LPR-${out}`;
}

// ---------------------------------------------------------------------------
// Pindai AI
// ---------------------------------------------------------------------------

/**
 * Kirim foto laporan ke pLitter dan simpan hasilnya ke baris laporan.
 *
 * Dipanggil "fire and forget" dari action `/lapor` — warga tidak boleh
 * menunggu inferensi selesai untuk melihat halaman konfirmasi, dan kegagalan
 * pemindaian tidak boleh menggagalkan laporannya. Karena itu fungsi ini
 * menelan errornya sendiri dan mencatat `GAGAL_PINDAI`, bukan melempar.
 */
export async function pindaiLaporan(laporanId: string): Promise<void> {
	const [laporan] = await db.select().from(publicReports).where(eq(publicReports.id, laporanId));
	if (!laporan) return;

	const now = new Date();

	// Laporan video-saja tidak bisa dipindai endpoint gambar. Ditandai
	// GAGAL_PINDAI supaya operator tahu harus menilai manual, bukan mengira
	// AI sudah menyatakan laporannya lemah.
	if (!laporan.urlFoto) {
		await tulisHasilPindai(laporanId, {
			aiRekomendasi: "GAGAL_PINDAI",
			aiRincian: serializeRincian([
				{ label: "Tidak dapat dipindai", poin: 0, keterangan: "laporan tidak menyertakan foto" },
			]),
			aiDipindaiPada: now,
		});
		return;
	}

	let hasil: ImageDetectionResponse;
	try {
		hasil = await panggilDetectImage(laporan.urlFoto);
	} catch (err) {
		const pesan = err instanceof Error ? err.message : String(err);
		console.error("[novira] Pindai AI laporan gagal:", pesan);
		await tulisHasilPindai(laporanId, {
			aiRekomendasi: "GAGAL_PINDAI",
			aiRincian: serializeRincian([
				{ label: "Pemindaian gagal", poin: 0, keterangan: pesan.slice(0, 200) },
			]),
			aiDipindaiPada: now,
		});
		return;
	}

	// Hanya kelas sampah yang dihitung; `Trash bin` (tempat sampah) adalah
	// perabot kota, bukan sampah — sama seperti di siklus deteksi CCTV.
	const relevan = hasil.detections.filter((d) => CLASS_TO_JENIS[d.class_name] !== undefined);
	const terkuat = relevan.reduce<PlitterDetection | null>(
		(best, d) => (!best || d.score > best.score ? d : best),
		null
	);

	const trust = await ambilReputasi(laporan.pelaporTelepon);
	const { rekomendasi, rincian } = hitungRekomendasi({
		skorAi: terkuat?.score ?? 0,
		jumlahDeteksi: relevan.length,
		punyaFoto: true,
		punyaKoordinat: !!parseTitik(laporan.latitude, laporan.longitude),
		punyaDeskripsi: !!laporan.deskripsi?.trim(),
		skorReputasi: trust?.skor ?? null,
	});

	await tulisHasilPindai(laporanId, {
		aiSkor: terkuat ? String(terkuat.score) : "0",
		aiLabel: terkuat?.class_name ?? null,
		aiJumlahDeteksi: relevan.length,
		aiRekomendasi: rekomendasi,
		aiRincian: serializeRincian(rincian),
		aiDipindaiPada: now,
	});
}

async function tulisHasilPindai(
	laporanId: string,
	nilai: Partial<typeof publicReports.$inferInsert>
): Promise<void> {
	await db
		.update(publicReports)
		.set({ ...nilai, updatedAt: new Date() })
		.where(eq(publicReports.id, laporanId));
}

async function panggilDetectImage(urlFoto: string): Promise<ImageDetectionResponse> {
	// `urlFoto` adalah URL publik Vercel Blob dari storeUpload() -- ambil isinya
	// lewat HTTP, bukan baca disk lokal (disk container/serverless efemeral).
	const fotoRes = await fetch(urlFoto, { signal: AbortSignal.timeout(15_000) });
	if (!fotoRes.ok) {
		throw new Error(`Gagal mengambil foto laporan dari blob storage: HTTP ${fotoRes.status}`);
	}
	const isi = await fotoRes.arrayBuffer();
	const namaFile = new URL(urlFoto).pathname.split("/").pop() || "foto.jpg";

	const form = new FormData();
	form.append("file", new Blob([isi], { type: "image/jpeg" }), namaFile);

	const endpoint = new URL("/detect/image", PLITTER_API_URL);
	endpoint.searchParams.set("model_type", "street");
	// Foto ponsel jarak dekat: objeknya besar di frame, jadi tiled inference
	// (yang berguna untuk frame CCTV lebar) justru tidak diperlukan.
	endpoint.searchParams.set("conf_thres", "0.2");

	const res = await fetch(endpoint, {
		method: "POST",
		body: form,
		signal: AbortSignal.timeout(30_000),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`pLitter API ${res.status}: ${body.slice(0, 200)}`);
	}
	return (await res.json()) as ImageDetectionResponse;
}

/**
 * Gabungkan sinyal menjadi satu rekomendasi triase.
 *
 * Fungsi murni (tanpa DB) supaya kebijakan triasenya bisa diuji unit dan
 * diaudit terpisah dari mekanisme pemanggilan model.
 *
 * Catatan penting soal `KEMUNGKINAN_SPAM`: label itu TIDAK pernah diberikan
 * hanya karena model tidak menemukan apa-apa. Model kami dilatih pada citra
 * CCTV, jadi wajar meleset pada foto ponsel; menuduh warga spam atas dasar
 * itu akan menghukum pelapor yang jujur. Spam hanya disimpulkan bila sinyal
 * lemah BERTEMU dengan laporan yang tidak lengkap atau reputasi pelapor yang
 * memang sudah buruk berdasarkan keputusan operator sebelumnya.
 */
export function hitungRekomendasi(input: {
	skorAi: number;
	jumlahDeteksi: number;
	punyaFoto: boolean;
	punyaKoordinat: boolean;
	punyaDeskripsi: boolean;
	skorReputasi: number | null;
}): { rekomendasi: RekomendasiAi; rincian: FaktorPrioritas[] } {
	const rincian: FaktorPrioritas[] = [];
	let poin = 0;

	if (input.jumlahDeteksi > 0 && input.skorAi >= SKOR_AI_TINGGI) {
		poin += 3;
		rincian.push({
			label: "AI menemukan sampah",
			poin: 3,
			keterangan: `${input.jumlahDeteksi} objek, kepercayaan tertinggi ${Math.round(input.skorAi * 100)}%`,
		});
	} else if (input.jumlahDeteksi > 0 && input.skorAi >= SKOR_AI_RENDAH) {
		poin += 1;
		rincian.push({
			label: "AI menemukan indikasi sampah",
			poin: 1,
			keterangan: `kepercayaan ${Math.round(input.skorAi * 100)}% — di bawah ambang yakin`,
		});
	} else {
		poin -= 1;
		rincian.push({
			label: "AI tidak menemukan sampah",
			poin: -1,
			keterangan: "model dilatih untuk citra CCTV, foto ponsel wajar meleset — perlu mata operator",
		});
	}

	if (input.punyaKoordinat) {
		poin += 1;
		rincian.push({ label: "Lokasi GPS presisi", poin: 1, keterangan: "koordinat terlampir" });
	} else {
		poin -= 1;
		rincian.push({
			label: "Tanpa koordinat GPS",
			poin: -1,
			keterangan: "hanya kota/kecamatan — petugas sulit menemukan titik",
		});
	}

	if (input.punyaDeskripsi) {
		poin += 1;
		rincian.push({ label: "Ada deskripsi", poin: 1, keterangan: "pelapor menjelaskan kondisi" });
	}

	if (input.skorReputasi !== null) {
		if (input.skorReputasi >= 70) {
			poin += 2;
			rincian.push({
				label: "Pelapor tepercaya",
				poin: 2,
				keterangan: `reputasi ${input.skorReputasi}/100 dari laporan sebelumnya`,
			});
		} else if (input.skorReputasi <= 30) {
			poin -= 3;
			rincian.push({
				label: "Reputasi pelapor rendah",
				poin: -3,
				keterangan: `reputasi ${input.skorReputasi}/100 — laporan sebelumnya banyak ditolak`,
			});
		}
	}

	const rekomendasi: RekomendasiAi =
		poin >= 4 ? "SANGAT_MUNGKIN_VALID" : poin <= -2 ? "KEMUNGKINAN_SPAM" : "PERLU_TINJAUAN";

	return { rekomendasi, rincian };
}

// ---------------------------------------------------------------------------
// Deteksi duplikat
// ---------------------------------------------------------------------------

export interface KandidatDuplikat {
	laporanId: string;
	kodeTracking: string;
	jarakMeter: number;
	createdAt: Date;
	status: string;
}

/**
 * Cari laporan lain di lokasi yang praktis sama dalam 48 jam terakhir.
 *
 * Satu tumpukan sampah di pinggir jalan ramai bisa dilaporkan sepuluh warga
 * dalam sejam. Tanpa penggabungan, antrian operator penuh pekerjaan yang
 * sama dan statistik "jumlah laporan" jadi menyesatkan sebagai ukuran
 * masalah. Yang digabungkan adalah laporannya, bukan datanya — baris duplikat
 * tetap disimpan dan tetap bisa dilacak pelapornya masing-masing.
 */
export async function cariDuplikat(laporanId: string): Promise<KandidatDuplikat[]> {
	const [laporan] = await db.select().from(publicReports).where(eq(publicReports.id, laporanId));
	if (!laporan) return [];
	const titik = parseTitik(laporan.latitude, laporan.longitude);
	if (!titik) return [];

	const sejak = new Date(laporan.createdAt.getTime() - JENDELA_DUPLIKAT_JAM * 3600_000);
	const kandidat = await db
		.select()
		.from(publicReports)
		.where(
			and(
				ne(publicReports.id, laporanId),
				gte(publicReports.createdAt, sejak),
				// Laporan yang sudah ditolak atau sudah ditandai duplikat bukan
				// induk yang sah untuk penggabungan.
				inArray(publicReports.status, ["MENUNGGU", "DIPROSES", "SELESAI"])
			)
		)
		.orderBy(publicReports.createdAt);

	return kandidat
		.flatMap((k) => {
			const t = parseTitik(k.latitude, k.longitude);
			if (!t) return [];
			const jarak = jarakMeter(titik, t);
			if (jarak > RADIUS_DUPLIKAT_METER) return [];
			return [
				{
					laporanId: k.id,
					kodeTracking: k.kodeTracking,
					jarakMeter: Math.round(jarak),
					createdAt: k.createdAt,
					status: k.status,
				},
			];
		})
		.sort((a, b) => a.jarakMeter - b.jarakMeter);
}

/** Jumlah laporan warga berbeda yang menguatkan sebuah titik — dipakai mesin prioritas. */
async function hitungLaporanMenguatkan(titik: Titik, kecuali: string): Promise<number> {
	const sejak = new Date(Date.now() - JENDELA_DUPLIKAT_JAM * 3600_000);
	const rows = await db
		.select({
			id: publicReports.id,
			latitude: publicReports.latitude,
			longitude: publicReports.longitude,
		})
		.from(publicReports)
		.where(and(gte(publicReports.createdAt, sejak), ne(publicReports.id, kecuali)));

	return rows.filter((r) => {
		const t = parseTitik(r.latitude, r.longitude);
		return !!t && jarakMeter(titik, t) <= RADIUS_DUPLIKAT_METER;
	}).length;
}

// ---------------------------------------------------------------------------
// Reputasi pelapor
// ---------------------------------------------------------------------------

async function ambilReputasi(telepon: string | null) {
	const kunci = normalisasiTelepon(telepon);
	if (!kunci) return null;
	const [row] = await db.select().from(reporterTrust).where(eq(reporterTrust.telepon, kunci));
	return row ?? null;
}

/**
 * Perbarui reputasi pelapor setelah operator memutuskan.
 *
 * Skor = proporsi laporan valid, ditarik ke arah netral (50) oleh prior
 * Laplace `+1/+2`. Efeknya: satu laporan valid tidak langsung membuat skor
 * 100, dan satu penolakan tidak langsung membuat 0 — dibutuhkan pola yang
 * konsisten sebelum sistem memperlakukan seseorang sebagai tepercaya atau
 * sebagai pengirim spam. Ini penting karena skor tersebut ikut menentukan
 * apakah laporan berikutnya ditandai KEMUNGKINAN_SPAM.
 */
export async function perbaruiReputasi(
	telepon: string | null,
	hasil: "valid" | "ditolak"
): Promise<void> {
	const kunci = normalisasiTelepon(telepon);
	if (!kunci) return;

	const [row] = await db.select().from(reporterTrust).where(eq(reporterTrust.telepon, kunci));
	const valid = (row?.laporanValid ?? 0) + (hasil === "valid" ? 1 : 0);
	const ditolak = (row?.laporanDitolak ?? 0) + (hasil === "ditolak" ? 1 : 0);
	const total = (row?.laporanTotal ?? 0) + 1;
	const skor = Math.round(((valid + 1) / (valid + ditolak + 2)) * 100);

	const nilai = {
		telepon: kunci,
		laporanTotal: total,
		laporanValid: valid,
		laporanDitolak: ditolak,
		skor,
		updatedAt: new Date(),
	};

	await db
		.insert(reporterTrust)
		.values(nilai)
		.onConflictDoUpdate({ target: reporterTrust.telepon, set: nilai });
}

// ---------------------------------------------------------------------------
// Triase: verifikasi / tolak / duplikat
// ---------------------------------------------------------------------------

export interface AktorTriase {
	id: string;
	nama: string;
	peran: string;
}

/**
 * Naikkan laporan warga terverifikasi menjadi insiden resmi.
 *
 * Sejak titik ini laporan warga diperlakukan sama persis dengan deteksi CCTV:
 * masuk antrian insiden, dapat skor prioritas, punya timer SLA, bisa
 * ditugaskan ke petugas, dan wajib bukti foto saat diselesaikan. Itulah inti
 * fiturnya — sebelumnya laporan warga tidak pernah menjadi pekerjaan yang
 * terukur.
 */
export async function verifikasiLaporan(
	laporanId: string,
	aktor: AktorTriase,
	opsi: { jenisSampah?: string; catatan?: string } = {}
): Promise<{ ok: true; insidenId: string } | { ok: false; pesan: string }> {
	const [laporan] = await db.select().from(publicReports).where(eq(publicReports.id, laporanId));
	if (!laporan) return { ok: false, pesan: "Laporan tidak ditemukan" };
	if (laporan.insidenId) {
		return { ok: false, pesan: "Laporan ini sudah pernah diverifikasi menjadi insiden" };
	}

	const now = new Date();
	const titik = parseTitik(laporan.latitude, laporan.longitude);

	// Jenis sampah: pilihan operator menang, lalu tebakan model, lalu isian warga.
	const jenisSampah = pilihJenisSampah(
		opsi.jenisSampah,
		laporan.aiLabel ? CLASS_TO_JENIS[laporan.aiLabel] : undefined,
		laporan.jenisSampah
	);

	// Tautkan ke kamera terdekat kalau ada yang dalam radius — insiden jadi
	// ikut terhitung di skor kebersihan kecamatan kamera tersebut. Kalau tidak
	// ada, insiden tetap dibuat tanpa kamera (kolom cameraId nullable).
	const kameraTerdekat = titik ? await cariKameraTerdekat(titik) : null;

	const lokasiTeks =
		kameraTerdekat?.item.nama ??
		[laporan.kecamatan, laporan.kota].filter(Boolean).join(", ") ??
		"Lokasi laporan warga";

	const menguatkan = titik ? await hitungLaporanMenguatkan(titik, laporanId) : 0;
	const kekambuhan = kameraTerdekat ? await hitungKekambuhanKamera(kameraTerdekat.item.id) : 0;

	const prioritas = hitungPrioritas({
		jenisSampah,
		durasiJam: (now.getTime() - laporan.createdAt.getTime()) / 3600_000,
		tingkatKepercayaan: Number(laporan.aiSkor ?? 0),
		teksLokasi: [lokasiTeks, laporan.kecamatan, laporan.deskripsi].filter(Boolean).join(" "),
		kekambuhan,
		laporanWargaMenguatkan: menguatkan,
		dariLaporanWarga: true,
	});

	const insidenId = generateId(10);
	await db.insert(incidents).values({
		id: insidenId,
		cameraId: kameraTerdekat?.item.id ?? null,
		sumber: "LAPORAN_WARGA",
		laporanId,
		latitude: laporan.latitude,
		longitude: laporan.longitude,
		lokasiTeks,
		jenisSampah,
		labelSampah: laporan.aiLabel ?? "laporan warga",
		// Timer SLA berjalan sejak WARGA MELAPOR, bukan sejak operator sempat
		// membuka antrian. Kalau tidak, keterlambatan verifikasi internal akan
		// tersembunyi dari statistik waktu tanggap.
		pertamaDilihat: laporan.createdAt,
		terakhirDilihat: now,
		status: "AKTIF",
		keparahan: prioritas.keparahan,
		tingkatKepercayaan: laporan.aiSkor ?? "0",
		urlSnapshot: laporan.urlFoto ?? "",
		urlSnapshotPertama: laporan.urlFoto ?? null,
		statusSla: "TEPAT_WAKTU",
		skorPrioritas: prioritas.skor,
		rincianPrioritas: serializeRincian(prioritas.rincian),
		// Laporan warga tidak punya bounding box dalam ruang gambar kamera —
		// nol berarti "tidak berlaku", dan UI menyembunyikan kotaknya saat
		// lebar/tingginya nol.
		bboxX: "0",
		bboxY: "0",
		bboxWidth: "0",
		bboxHeight: "0",
	});

	await db
		.update(publicReports)
		.set({
			status: "DIPROSES",
			insidenId,
			diprosesOleh: aktor.id,
			catatanPetugas: opsi.catatan?.trim() || laporan.catatanPetugas,
			updatedAt: now,
		})
		.where(eq(publicReports.id, laporanId));

	await perbaruiReputasi(laporan.pelaporTelepon, "valid");

	await db.insert(auditLog).values({
		id: generateId(10),
		waktu: now,
		pengguna: aktor.nama,
		peran: aktor.peran,
		tindakan: "Laporan warga diverifikasi",
		rincian: `Laporan ${laporan.kodeTracking} diverifikasi ${aktor.nama} dan dinaikkan menjadi insiden ${insidenId} (${lokasiTeks}, prioritas ${prioritas.skor}/100)`,
		wilayah: laporan.kota ?? kameraTerdekat?.item.kota ?? "",
		tipe: "LAPORAN_WARGA",
		incidentId: insidenId,
	});

	await db.insert(notifications).values({
		id: generateId(10),
		userId: null,
		title: "Insiden baru dari laporan warga",
		message: `Laporan ${laporan.kodeTracking} di ${lokasiTeks} diverifikasi dan menjadi insiden dengan prioritas ${prioritas.skor}/100. Tugaskan petugas di halaman Insiden.`,
		type: "warning",
	});

	return { ok: true, insidenId };
}

function pilihJenisSampah(...kandidat: (string | null | undefined)[]): JenisSampah {
	for (const c of kandidat) {
		if (c && (JENIS_VALID as readonly string[]).includes(c)) return c as JenisSampah;
	}
	return "tumpukan_sampah";
}

async function cariKameraTerdekat(titik: Titik) {
	const semua = await db.select().from(cameras);
	return cariTerdekat(
		titik,
		semua,
		(c) => parseTitik(c.latitude, c.longitude),
		RADIUS_KAMERA_METER
	);
}

/** Berapa kali kamera ini pernah punya insiden yang sudah SELESAI — proksi kekambuhan titik. */
async function hitungKekambuhanKamera(cameraId: string): Promise<number> {
	const [row] = await db
		.select({ jumlah: sql<number>`count(*)::int` })
		.from(incidents)
		.where(and(eq(incidents.cameraId, cameraId), eq(incidents.status, "SELESAI")));
	return row?.jumlah ?? 0;
}

/** Tolak laporan (tidak valid / bukan sampah / di luar wewenang). Menurunkan reputasi pelapor. */
export async function tolakLaporan(
	laporanId: string,
	aktor: AktorTriase,
	alasan: string
): Promise<{ ok: boolean; pesan?: string }> {
	const [laporan] = await db.select().from(publicReports).where(eq(publicReports.id, laporanId));
	if (!laporan) return { ok: false, pesan: "Laporan tidak ditemukan" };
	if (laporan.insidenId) {
		return { ok: false, pesan: "Laporan sudah menjadi insiden — selesaikan lewat halaman Insiden" };
	}

	const now = new Date();
	await db
		.update(publicReports)
		.set({ status: "DITOLAK", catatanPetugas: alasan, diprosesOleh: aktor.id, updatedAt: now })
		.where(eq(publicReports.id, laporanId));

	await perbaruiReputasi(laporan.pelaporTelepon, "ditolak");

	await db.insert(auditLog).values({
		id: generateId(10),
		waktu: now,
		pengguna: aktor.nama,
		peran: aktor.peran,
		tindakan: "Laporan warga ditolak",
		rincian: `Laporan ${laporan.kodeTracking} ditolak ${aktor.nama}. Alasan: ${alasan}`,
		wilayah: laporan.kota ?? "",
		tipe: "LAPORAN_WARGA",
	});

	return { ok: true };
}

/**
 * Tandai laporan sebagai duplikat dari laporan lain.
 *
 * Berbeda dari penolakan: duplikat BUKAN laporan yang salah, jadi reputasi
 * pelapor tidak diturunkan — warga yang melaporkan masalah nyata yang
 * kebetulan sudah dilaporkan orang lain tidak boleh dihukum karenanya.
 */
export async function tandaiDuplikat(
	laporanId: string,
	indukId: string,
	aktor: AktorTriase
): Promise<{ ok: boolean; pesan?: string }> {
	if (laporanId === indukId)
		return { ok: false, pesan: "Laporan tidak bisa menjadi duplikat dirinya sendiri" };

	const [laporan] = await db.select().from(publicReports).where(eq(publicReports.id, laporanId));
	const [induk] = await db.select().from(publicReports).where(eq(publicReports.id, indukId));
	if (!laporan || !induk) return { ok: false, pesan: "Laporan tidak ditemukan" };
	if (induk.duplikatDariId) {
		// Cegah rantai duplikat — selalu tunjuk ke induk terluar supaya
		// pelacakan publik tidak perlu menelusuri berlapis-lapis.
		return { ok: false, pesan: "Laporan induk sendiri sudah ditandai duplikat" };
	}

	const now = new Date();
	await db
		.update(publicReports)
		.set({
			status: "DUPLIKAT",
			duplikatDariId: indukId,
			diprosesOleh: aktor.id,
			catatanPetugas: `Digabungkan ke laporan ${induk.kodeTracking}`,
			updatedAt: now,
		})
		.where(eq(publicReports.id, laporanId));

	await db.insert(auditLog).values({
		id: generateId(10),
		waktu: now,
		pengguna: aktor.nama,
		peran: aktor.peran,
		tindakan: "Laporan warga digabungkan",
		rincian: `Laporan ${laporan.kodeTracking} ditandai duplikat dari ${induk.kodeTracking}`,
		wilayah: laporan.kota ?? "",
		tipe: "LAPORAN_WARGA",
	});

	return { ok: true };
}

// ---------------------------------------------------------------------------
// Pelacakan publik
// ---------------------------------------------------------------------------

export interface StatusLacak {
	kodeTracking: string;
	status: string;
	dibuatPada: string;
	lokasi: string;
	jenisSampah: string | null;
	catatanPetugas: string | null;
	/** Langkah-langkah yang sudah dilewati, untuk ditampilkan sebagai linimasa. */
	linimasa: { judul: string; waktu: string | null; selesai: boolean; keterangan: string }[];
}

/**
 * Lacak laporan dari kode publik — tanpa akun, tanpa data pribadi.
 *
 * Sengaja TIDAK mengembalikan nama/nomor pelapor: siapa pun yang memegang
 * kode bisa membacanya, dan kode itu sering dibagikan lewat pesan singkat.
 * Yang dikembalikan hanya status penanganan, yaitu satu-satunya hal yang
 * memang perlu diketahui pelapor.
 */
export async function lacakLaporan(kode: string): Promise<StatusLacak | null> {
	const bersih = kode.trim().toUpperCase();
	if (!bersih) return null;

	const [laporan] = await db
		.select()
		.from(publicReports)
		.where(eq(publicReports.kodeTracking, bersih));
	if (!laporan) return null;

	const insiden = laporan.insidenId
		? (await db.select().from(incidents).where(eq(incidents.id, laporan.insidenId)))[0]
		: undefined;

	const diverifikasi = !!laporan.insidenId;
	const ditolak = laporan.status === "DITOLAK";
	const duplikat = laporan.status === "DUPLIKAT";
	const selesai = insiden?.status === "SELESAI" || laporan.status === "SELESAI";

	const linimasa: StatusLacak["linimasa"] = [
		{
			judul: "Laporan diterima",
			waktu: laporan.createdAt.toISOString(),
			selesai: true,
			keterangan: "Laporan Anda masuk ke sistem dan antre untuk diperiksa.",
		},
		{
			judul: "Diperiksa AI",
			waktu: laporan.aiDipindaiPada?.toISOString() ?? null,
			selesai: !!laporan.aiDipindaiPada,
			keterangan: laporan.aiDipindaiPada
				? "Foto dipindai otomatis sebagai bahan pertimbangan petugas."
				: "Menunggu pemindaian otomatis.",
		},
		{
			judul: ditolak
				? "Tidak dapat ditindaklanjuti"
				: duplikat
					? "Digabungkan"
					: "Diverifikasi petugas",
			waktu: diverifikasi || ditolak || duplikat ? laporan.updatedAt.toISOString() : null,
			selesai: diverifikasi || ditolak || duplikat,
			keterangan: ditolak
				? (laporan.catatanPetugas ?? "Laporan dinilai tidak memenuhi kriteria.")
				: duplikat
					? "Lokasi ini sudah dilaporkan sebelumnya; laporan Anda digabungkan agar penanganannya satu pintu."
					: diverifikasi
						? "Petugas memverifikasi laporan dan menjadikannya insiden resmi."
						: "Menunggu verifikasi petugas.",
		},
	];

	// Langkah pembersihan hanya relevan kalau laporannya jadi pekerjaan nyata.
	if (!ditolak && !duplikat) {
		linimasa.push({
			judul: "Dibersihkan",
			waktu: selesai ? (insiden?.updatedAt.toISOString() ?? laporan.updatedAt.toISOString()) : null,
			selesai,
			keterangan: selesai
				? "Petugas telah membersihkan lokasi dan mengunggah foto bukti."
				: insiden?.petugasDitugaskan
					? "Petugas sudah ditugaskan dan sedang menuju lokasi."
					: "Menunggu penugasan petugas lapangan.",
		});
	}

	return {
		kodeTracking: laporan.kodeTracking,
		status: laporan.status,
		dibuatPada: laporan.createdAt.toISOString(),
		lokasi: [laporan.kecamatan, laporan.kota].filter(Boolean).join(", ") || "Lokasi GPS terlampir",
		jenisSampah: laporan.jenisSampah,
		catatanPetugas: laporan.catatanPetugas,
		linimasa,
	};
}

/** Antrian triase untuk dashboard — laporan + reputasi pelapor + kandidat duplikat. */
export async function listAntrianTriase(status: string) {
	const rows = await db
		.select()
		.from(publicReports)
		.where(eq(publicReports.status, status as "MENUNGGU"))
		.orderBy(desc(publicReports.createdAt));

	return Promise.all(
		rows.map(async (laporan) => ({
			...laporan,
			reputasiPelapor: (await ambilReputasi(laporan.pelaporTelepon))?.skor ?? null,
			duplikat: laporan.status === "MENUNGGU" ? await cariDuplikat(laporan.id) : [],
		}))
	);
}
