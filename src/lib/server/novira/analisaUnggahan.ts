import { validateUpload } from "$lib/server/uploads.js";
import { MODEL_TYPES_TERSEDIA, type ModelTypeDeteksi } from "./deteksi.js";

/**
 * Analisa ad-hoc: operator mengunggah satu foto/video dari perangkatnya
 * (bukan dari kamera CCTV terdaftar) dan langsung dikirim ke pLitter untuk
 * dianalisa. Berbeda dari `jalankanAnalisaManual` di deteksi.ts (yang
 * menangkap ulang cuplikan dari kamera Bandung) dan dari `laporan.ts` (alur
 * publik laporan warga) -- ini murni alat bantu lihat-hasil untuk operator,
 * tidak menulis apa pun ke tabel `incidents`.
 */

const PLITTER_API_URL = process.env.PLITTER_API_URL ?? "http://localhost:8000";
const MAX_FRAMES_VIDEO = 60;
const SKIP_FRAMES_VIDEO = 5;

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

export function parseModelType(raw: FormDataEntryValue | null): ModelTypeDeteksi | null {
	if (typeof raw !== "string") return null;
	return (MODEL_TYPES_TERSEDIA as readonly string[]).includes(raw)
		? (raw as ModelTypeDeteksi)
		: null;
}

export function parseConfThres(raw: FormDataEntryValue | null, fallback: number): number {
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 && n <= 1 ? n : fallback;
}

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

export async function analisaUnggahan(
	file: File,
	opsi: PengaturanAnalisa
): Promise<HasilAnalisaUnggahan> {
	const kind: "foto" | "video" = file.type.startsWith("video/") ? "video" : "foto";
	const error = validateUpload(file, kind);
	if (error) throw new Error(error);

	const buffer = await file.arrayBuffer();
	return kind === "foto" ? analisaFoto(file, buffer, opsi) : analisaVideo(file, buffer, opsi);
}

async function analisaFoto(
	file: File,
	buffer: ArrayBuffer,
	opsi: PengaturanAnalisa
): Promise<HasilAnalisaFoto> {
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

async function analisaVideo(
	file: File,
	buffer: ArrayBuffer,
	opsi: PengaturanAnalisa
): Promise<HasilAnalisaVideo> {
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
