import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

/**
 * **Model Novira** — jalur deteksi kedua di samping model pLitter yang kami
 * latih sendiri.
 *
 * Bedanya mendasar: pLitter adalah detektor objek (YOLO) yang mengembalikan
 * kotak piksel langsung, sedangkan Model Novira adalah model multimodal —
 * ia "membaca" fotonya dan mengembalikan daftar temuan berikut kotak dalam
 * koordinat ternormalisasi (0–1). Kotak pada foto hasil analisa digambar di
 * sini (sharp + overlay SVG), bukan oleh modelnya.
 *
 * Kapan dipakai: foto ponsel dari laporan warga. Model CCTV kami dilatih pada
 * citra kamera jalan — pada foto jarak dekat dengan sudut bebas, akurasinya
 * turun. Model multimodal jauh lebih tahan pada variasi sudut/jarak dan bisa
 * mengenali jenis sampah yang tidak ada di kelas pLitter (kardus, puing,
 * pembuangan liar besar).
 *
 * Yang TIDAK berubah: model tetap hanya merekomendasikan. Tidak ada jalur di
 * sini yang mengubah status laporan — lihat catatan "AI menyaring, manusia
 * memutuskan" di `laporan.ts`.
 */

/**
 * Kelas yang boleh dikembalikan model. Sengaja memakai nama kelas yang sama
 * dengan pLitter (`Pile`, `Plastic`, `Face mask`, `Trash bin`) supaya seluruh
 * jalur di hilir — `CLASS_TO_JENIS`, kolom `aiLabel`, filter "Trash bin bukan
 * sampah" — tidak perlu tahu model mana yang menghasilkannya. Empat kelas
 * terakhir adalah tambahan yang memang tak dikenali pLitter.
 */
export const KELAS_NOVIRA = [
	"Pile",
	"Plastic",
	"Bottle",
	"Cardboard",
	"Bulky waste",
	"Construction debris",
	"Face mask",
	"Trash bin",
] as const;

export type KelasNovira = (typeof KELAS_NOVIRA)[number];

/** Bentuknya sengaja identik dengan `PlitterDetection` supaya bisa dipertukarkan. */
export interface DeteksiNovira {
	class_id: number;
	class_name: string;
	score: number;
	/** Piksel x1,y1,x2,y2 pada gambar sumber. */
	box: [number, number, number, number];
	detector?: string;
}

export interface HasilAnalisaNovira {
	width: number;
	height: number;
	detections: DeteksiNovira[];
	/** JPEG beranotasi (kotak deteksi) dalam base64, tanpa prefiks data URL. */
	annotated_image_base64: string;
}

/** Bentuk mentah yang diminta dari model — dinormalkan oleh `petakanDeteksiNovira`. */
interface TemuanMentah {
	label: string;
	confidence: number;
	box: { x1: number; y1: number; x2: number; y2: number };
}

const MODEL_ID = process.env.NOVIRA_MODEL_ID || "claude-sonnet-5";
/**
 * Model CCTV terpisah dari model laporan warga: siklus CCTV memanggil ini
 * per kamera, dua kali sehari, jadi volumenya jauh lebih besar daripada foto
 * laporan warga yang tetap ditinjau manusia. Haiku cukup untuk task deteksi
 * kotak sederhana ini di volume tinggi; kalau akurasinya kurang, naikkan
 * lewat env tanpa menyentuh kode.
 */
const MODEL_ID_CCTV = process.env.NOVIRA_MODEL_ID_CCTV || "claude-haiku-4-5";
/** Cukup untuk maksimum 25 deteksi + sedikit thinking; jadi jaring pengaman
 * dari biaya outlier, bukan penentu biaya rata-rata (hanya token yang benar-
 * benar dipakai yang dibayar). */
const MAX_TOKENS = 1500;

/**
 * Sisi terpanjang gambar yang dikirim ke model. Snapshot CCTV datang dari
 * pLitter dalam resolusi penuh (bisa >1920px) dan foto laporan warga kadang
 * lolos tanpa kompresi klien — di atas ambang ini Claude toh men-downsample
 * sendiri, jadi mengirim lebih besar cuma membayar token gambar tanpa
 * menambah akurasi deteksi.
 */
const MAKS_SISI_GAMBAR = 1568;

/**
 * Kunci API disimpan pada nama env milik kami sendiri supaya konfigurasi
 * deployment bicara dalam istilah produk ("model Novira"), bukan istilah
 * penyedianya. `ANTHROPIC_API_KEY` tetap diterima sebagai fallback karena SDK
 * membacanya secara default di lingkungan pengembangan.
 */
function ambilKunci(): string | null {
	return process.env.NOVIRA_MODEL_API_KEY || process.env.ANTHROPIC_API_KEY || null;
}

/** Dipakai UI/pengaturan untuk menampilkan apakah model ini siap dipanggil. */
export function noviraSiap(): boolean {
	return ambilKunci() !== null;
}

const PROMPT_SISTEM = `You are a street-litter detection model for a municipal cleanliness monitoring system in Indonesia.

You are given one photograph. Find every piece of litter, illegally dumped waste, or waste pile that is visibly present, and report a bounding box for each.

Rules:
- Report ONLY waste that is actually visible in the photo. If there is no waste, return an empty list. Never invent a detection to be helpful — a false positive costs a field officer a wasted trip.
- Do not report waste that is properly contained: a closed municipal bin, a bin bag placed inside a bin, or waste inside a garbage truck. A bin itself may be reported as "Trash bin" only when it is a clearly visible fixture in the frame; it is not counted as litter downstream.
- Group waste that forms one continuous heap into a single "Pile" detection rather than boxing each item in it.
- Boxes are normalized to the image: x1,y1 is the top-left corner and x2,y2 the bottom-right, each between 0 and 1, with x1 < x2 and y1 < y2. Box the object tightly.
- confidence is your own certainty that the box contains the labelled waste, from 0 to 1. Be calibrated: use above 0.8 only when the object is unmistakable, and below 0.4 when the object is small, blurred, or partly occluded.
- Label meanings: "Pile" = mixed heap of waste; "Plastic" = plastic bag/wrapper/sheet; "Bottle" = bottle or drink can; "Cardboard" = cardboard or packaging; "Bulky waste" = dumped furniture, mattress, appliance, tyre; "Construction debris" = rubble, sand, broken concrete; "Face mask" = discarded mask; "Trash bin" = a waste bin fixture.
- Return at most 25 detections, strongest first.`;

const SKEMA_KELUARAN = {
	type: "object",
	additionalProperties: false,
	required: ["detections"],
	properties: {
		detections: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: ["label", "confidence", "box"],
				properties: {
					label: { type: "string", enum: [...KELAS_NOVIRA] },
					confidence: { type: "number" },
					box: {
						type: "object",
						additionalProperties: false,
						required: ["x1", "y1", "x2", "y2"],
						properties: {
							x1: { type: "number" },
							y1: { type: "number" },
							x2: { type: "number" },
							y2: { type: "number" },
						},
					},
				},
			},
		},
	},
} as const;

/**
 * Kecilkan gambar sebelum dikirim ke model. Selalu diencode ulang ke JPEG
 * (termasuk yang PNG) karena PNG snapshot CCTV jauh lebih berat untuk isi
 * yang sama. Kotak deteksi tetap dipetakan ke resolusi asli oleh
 * `petakanDeteksiNovira` -- koordinatnya ternormalisasi 0..1 jadi tidak
 * tergantung resolusi yang dilihat model.
 */
async function kompresGambarUntukModel(
	buffer: Buffer,
	width: number,
	height: number
): Promise<{ data: string; mediaType: "image/jpeg" }> {
	const sisiTerpanjang = Math.max(width, height);
	const resized = sharp(buffer).resize({
		width: sisiTerpanjang > MAKS_SISI_GAMBAR ? MAKS_SISI_GAMBAR : undefined,
		height: sisiTerpanjang > MAKS_SISI_GAMBAR ? MAKS_SISI_GAMBAR : undefined,
		fit: "inside",
		withoutEnlargement: true,
	});
	const data = await resized.jpeg({ quality: 85 }).toBuffer();
	return { data: data.toString("base64"), mediaType: "image/jpeg" };
}

/**
 * Analisa satu gambar dengan Model Novira dan kembalikan hasil berbentuk sama
 * dengan response `/detect/image` pLitter, lengkap dengan foto beranotasi —
 * supaya pemanggilnya (laporan warga, Unggah & Analisa, siklus CCTV) tidak
 * perlu bercabang lebih jauh dari sekadar memilih model.
 */
export async function analisaGambarNovira(
	gambar: Uint8Array,
	opsi: { confThres?: number; sumber?: "laporan" | "cctv" } = {}
): Promise<HasilAnalisaNovira> {
	const apiKey = ambilKunci();
	if (!apiKey) {
		throw new Error(
			"Model Novira belum dikonfigurasi — setel NOVIRA_MODEL_API_KEY pada environment server."
		);
	}
	const confThres = opsi.confThres ?? 0.2;
	const model = opsi.sumber === "cctv" ? MODEL_ID_CCTV : MODEL_ID;

	const buffer = Buffer.from(gambar);
	const meta = await sharp(buffer).metadata();
	const width = meta.width ?? 0;
	const height = meta.height ?? 0;
	if (!width || !height) {
		throw new Error("Berkas yang dikirim bukan gambar yang bisa dibaca.");
	}

	const gambarModel = await kompresGambarUntukModel(buffer, width, height);

	const client = new Anthropic({ apiKey });
	const response = await client.messages.create({
		model,
		max_tokens: MAX_TOKENS,
		system: PROMPT_SISTEM,
		output_config: {
			effort: "low",
			format: { type: "json_schema", schema: SKEMA_KELUARAN },
		},
		messages: [
			{
				role: "user",
				content: [
					{
						type: "image",
						source: {
							type: "base64",
							media_type: gambarModel.mediaType,
							data: gambarModel.data,
						},
					},
					{
						type: "text",
						text: `Detect all visible litter in this photo. Image size: ${width}x${height} pixels. Ignore any detection you are less than ${confThres} confident about.`,
					},
				],
			},
		],
	});

	if (response.stop_reason === "refusal") {
		throw new Error("Model Novira menolak menganalisa gambar ini.");
	}

	const detections = petakanDeteksiNovira(bacaKeluaran(response), width, height, confThres);

	let annotated: Uint8Array = buffer;
	try {
		annotated = await gambarKotakNovira(buffer, detections);
	} catch (err) {
		// Foto beranotasi bersifat pelengkap — kegagalan menggambar tidak boleh
		// membuang hasil deteksi yang sudah didapat.
		console.error("[novira] Gagal menggambar kotak deteksi:", err);
	}

	return {
		width,
		height,
		detections,
		annotated_image_base64: Buffer.from(annotated).toString("base64"),
	};
}

/**
 * Ambil daftar temuan dari response. Keluaran sudah dibatasi skema JSON
 * (`output_config.format`), tapi tetap diparse defensif: kalau response tidak
 * berbentuk seperti yang diminta, perlakukan sebagai "tidak ada temuan"
 * daripada melempar dan menggagalkan seluruh pemindaian.
 */
function bacaKeluaran(response: Anthropic.Message): unknown {
	const teks = response.content
		.filter((b): b is Anthropic.TextBlock => b.type === "text")
		.map((b) => b.text)
		.join("");
	if (!teks.trim()) return [];
	try {
		const data = JSON.parse(teks) as { detections?: unknown };
		return data?.detections ?? [];
	} catch {
		console.error("[novira] Keluaran model bukan JSON yang valid.");
		return [];
	}
}

/**
 * Ubah temuan model (kotak ternormalisasi 0–1) menjadi deteksi piksel.
 *
 * Fungsi murni supaya kebijakan validasinya bisa diuji tanpa memanggil model.
 * Keluaran model diperlakukan sebagai input tak tepercaya: kotak terbalik
 * dibetulkan, koordinat di luar bingkai dipotong, label di luar daftar dan
 * kotak yang menciut jadi nol dibuang.
 */
export function petakanDeteksiNovira(
	temuan: unknown,
	width: number,
	height: number,
	confThres: number
): DeteksiNovira[] {
	if (!Array.isArray(temuan)) return [];

	const hasil: DeteksiNovira[] = [];
	for (const item of temuan as TemuanMentah[]) {
		if (!item || typeof item !== "object") continue;
		const kelasIndex = (KELAS_NOVIRA as readonly string[]).indexOf(item.label);
		if (kelasIndex === -1) continue;

		const skor = Number(item.confidence);
		if (!Number.isFinite(skor) || skor < confThres) continue;

		const kotak = item.box;
		if (!kotak || typeof kotak !== "object") continue;
		const nums = [kotak.x1, kotak.y1, kotak.x2, kotak.y2].map(Number);
		if (!nums.every((n) => Number.isFinite(n))) continue;

		const [rx1, ry1, rx2, ry2] = nums as [number, number, number, number];
		const x1 = Math.round(jepit(Math.min(rx1, rx2)) * width);
		const y1 = Math.round(jepit(Math.min(ry1, ry2)) * height);
		const x2 = Math.round(jepit(Math.max(rx1, rx2)) * width);
		const y2 = Math.round(jepit(Math.max(ry1, ry2)) * height);
		if (x2 - x1 < 1 || y2 - y1 < 1) continue;

		hasil.push({
			class_id: kelasIndex,
			class_name: KELAS_NOVIRA[kelasIndex],
			score: Math.min(1, Math.max(0, skor)),
			box: [x1, y1, x2, y2],
			detector: "novira",
		});
	}

	return hasil.sort((a, b) => b.score - a.score).slice(0, 25);
}

function jepit(n: number): number {
	return Math.min(1, Math.max(0, n));
}

const KOTAK_STROKE = "#ef4444"; // red-500 -- sama dengan kotak deteksi pLitter di seluruh UI

/**
 * Model multimodal tidak mengembalikan gambar, hanya koordinat — jadi kotaknya
 * digambar di sini supaya operator melihat bukti dalam bentuk yang sama
 * persis dengan hasil model pLitter.
 */
export async function gambarKotakNovira(
	buffer: Uint8Array,
	detections: DeteksiNovira[]
): Promise<Uint8Array> {
	if (detections.length === 0) return buffer;
	const meta = await sharp(buffer).metadata();
	const width = meta.width ?? 0;
	const height = meta.height ?? 0;
	if (!width || !height) return buffer;

	const elemen = detections
		.map((d) => {
			const [x1, y1, x2, y2] = d.box;
			const w = Math.max(1, x2 - x1);
			const h = Math.max(1, y2 - y1);
			const label = `${d.class_name} ${Math.round(d.score * 100)}%`;
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

	return sharp(buffer)
		.composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
		.jpeg()
		.toBuffer();
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
