import { env } from "$env/dynamic/public";
import type { ModelTypeDeteksi } from "$lib/server/novira/deteksi.js";

/**
 * Client-side (browser) pLitter calls -- foto/video TIDAK lagi singgah di
 * server Novira untuk dianalisa. Browser mengompres/resize dulu, lalu
 * langsung POST ke pLitter; server Novira hanya menyimpan hasilnya.
 *
 * Ini butuh pLitter dijangkau langsung dari browser pengguna (bukan cuma
 * dari jaringan server), jadi `PUBLIC_PLITTER_API_URL` harus berupa URL
 * publik dan pLitter harus mengizinkan CORS dari origin Novira.
 */
const PLITTER_API_URL = env.PUBLIC_PLITTER_API_URL || "http://localhost:8000";

export interface DeteksiUnggahan {
	classId: number;
	className: string;
	score: number;
	box: [number, number, number, number];
}

export interface HasilAnalisaFoto {
	kind: "foto";
	modelType: ModelTypeDeteksi;
	confThres: number;
	width: number;
	height: number;
	deteksi: DeteksiUnggahan[];
	annotatedDataUrl: string;
}

export interface FrameAnalisaVideo {
	frameIndex: number;
	timestamp: number;
	deteksi: DeteksiUnggahan[];
}

export interface HasilAnalisaVideo {
	kind: "video";
	modelType: ModelTypeDeteksi;
	confThres: number;
	fps: number;
	framesProcessed: number;
	framesTotalInSource: number;
	truncated: boolean;
	frames: FrameAnalisaVideo[];
	totalDeteksi: number;
}

export type HasilAnalisaUnggahan = HasilAnalisaFoto | HasilAnalisaVideo;

interface PengaturanAnalisa {
	modelType: ModelTypeDeteksi;
	confThres: number;
}

interface PlitterDetectionRaw {
	class_id: number;
	class_name: string;
	score: number;
	box: [number, number, number, number];
}

const MAX_FRAMES_VIDEO = 60;
const SKIP_FRAMES_VIDEO = 5;

/**
 * Resize + kompres sebuah foto di browser sebelum dikirim ke pLitter --
 * tidak ada batas ukuran yang dilihat pengguna, ini yang menjaga unggahan
 * tetap ringan. Dipakai oleh halaman /lapor dan Unggah & Analisa.
 */
export async function resizeFoto(
	file: File,
	opsi: { maksDimensi?: number; kualitas?: number } = {}
): Promise<File> {
	if (!file.type.startsWith("image/")) return file;
	const maksDimensi = opsi.maksDimensi ?? 1920;
	const kualitas = opsi.kualitas ?? 0.8;

	const bitmap = await createImageBitmap(file);
	const skala = Math.min(1, maksDimensi / Math.max(bitmap.width, bitmap.height));
	const lebar = Math.round(bitmap.width * skala);
	const tinggi = Math.round(bitmap.height * skala);

	const canvas = document.createElement("canvas");
	canvas.width = lebar;
	canvas.height = tinggi;
	const ctx = canvas.getContext("2d");
	if (!ctx) return file;
	ctx.drawImage(bitmap, 0, 0, lebar, tinggi);

	const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", kualitas));
	if (!blob) return file;

	const namaBaru = file.name.replace(/\.[^.]+$/, "") + ".jpg";
	return new File([blob], namaBaru, { type: "image/jpeg" });
}

export async function analisaFotoLangsung(
	file: File,
	opsi: PengaturanAnalisa
): Promise<HasilAnalisaFoto> {
	const buffer = await file.arrayBuffer();
	// pLitter mengembalikan JSON deteksi + gambar beranotasi (base64) dalam satu
	// response saat include_annotated=true -- satu kali hit, bukan dua.
	const res = await kirimKePlitter("/detect/image", file, buffer, opsi, {
		include_annotated: "true",
	});
	if (!res.ok) throw new Error(await pesanError(res));
	const data = (await res.json()) as {
		width: number;
		height: number;
		detections: PlitterDetectionRaw[];
		annotated_image_base64: string;
	};

	return {
		kind: "foto",
		modelType: opsi.modelType,
		confThres: opsi.confThres,
		width: data.width,
		height: data.height,
		deteksi: data.detections.map(petakanDeteksi),
		annotatedDataUrl: `data:image/jpeg;base64,${data.annotated_image_base64}`,
	};
}

export async function analisaVideoLangsung(
	file: File,
	opsi: PengaturanAnalisa
): Promise<HasilAnalisaVideo> {
	const buffer = await file.arrayBuffer();
	const res = await kirimKePlitter(
		"/detect/video",
		file,
		buffer,
		opsi,
		{
			annotate: "false",
			skip_frames: String(SKIP_FRAMES_VIDEO),
			max_frames: String(MAX_FRAMES_VIDEO),
		},
		90_000
	);
	if (!res.ok) throw new Error(await pesanError(res));
	const data = (await res.json()) as {
		fps: number;
		frames_processed: number;
		frames_total_in_source: number;
		truncated: boolean;
		frames: { frame_index: number; timestamp: number; detections: PlitterDetectionRaw[] }[];
	};

	const frames: FrameAnalisaVideo[] = data.frames.map((f) => ({
		frameIndex: f.frame_index,
		timestamp: f.timestamp,
		deteksi: f.detections.map(petakanDeteksi),
	}));

	return {
		kind: "video",
		modelType: opsi.modelType,
		confThres: opsi.confThres,
		fps: data.fps,
		framesProcessed: data.frames_processed,
		framesTotalInSource: data.frames_total_in_source,
		truncated: data.truncated,
		frames,
		totalDeteksi: frames.reduce((sum, f) => sum + f.deteksi.length, 0),
	};
}

function petakanDeteksi(d: PlitterDetectionRaw): DeteksiUnggahan {
	return { classId: d.class_id, className: d.class_name, score: d.score, box: d.box };
}

async function kirimKePlitter(
	pathname: string,
	file: File,
	buffer: ArrayBuffer,
	opsi: PengaturanAnalisa,
	extraParams: Record<string, string>,
	timeoutMs = 30_000
): Promise<Response> {
	const form = new FormData();
	form.append("file", new Blob([buffer], { type: file.type }), file.name);

	const endpoint = new URL(pathname, PLITTER_API_URL);
	endpoint.searchParams.set("model_type", opsi.modelType);
	endpoint.searchParams.set("conf_thres", String(opsi.confThres));
	for (const [key, value] of Object.entries(extraParams)) {
		endpoint.searchParams.set(key, value);
	}

	return fetch(endpoint, { method: "POST", body: form, signal: AbortSignal.timeout(timeoutMs) });
}

async function pesanError(res: Response): Promise<string> {
	const body = await res.text().catch(() => "");
	return `pLitter API ${res.status}: ${body.slice(0, 300)}`;
}
