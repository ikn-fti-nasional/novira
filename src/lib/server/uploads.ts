import { randomBytes } from "node:crypto";
import { put } from "@vercel/blob";

// Foto dikompres otomatis di browser sebelum diunggah (lihat `kompresFoto` di
// halaman /lapor), jadi ini bukan batas yang dilihat pengguna -- hanya jaring
// pengaman untuk unggahan mentah kalau kompresi klien gagal/dilewati.
const MAX_SIZE = {
	foto: 25 * 1024 * 1024,
	video: 20 * 1024 * 1024,
} as const;

const ALLOWED_TYPES: Record<"foto" | "video", readonly string[]> = {
	foto: ["image/jpeg", "image/png", "image/webp"],
	video: ["video/mp4", "video/webm", "video/quicktime"],
};

const EXTENSION: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"video/mp4": "mp4",
	"video/webm": "webm",
	"video/quicktime": "mov",
};

export function validateUpload(file: File, kind: "foto" | "video"): string | null {
	if (!ALLOWED_TYPES[kind].includes(file.type)) {
		return `${kind === "foto" ? "Foto" : "Video"} harus berformat ${ALLOWED_TYPES[kind].join(", ")}`;
	}
	if (file.size > MAX_SIZE[kind]) {
		return `${kind === "foto" ? "Foto" : "Video"} maksimal ${MAX_SIZE[kind] / 1024 / 1024} MB`;
	}
	return null;
}

/**
 * Simpan berkas unggahan ke Vercel Blob (bukan disk lokal) -- filesystem
 * container/serverless bersifat efemeral, jadi foto/video bukti yang ditulis
 * ke disk hilang begitu instans-nya didaur ulang. Blob mengembalikan URL
 * publik permanen yang langsung dipakai sebagai `urlSnapshot`/`urlFoto`/dst.
 */
export async function storeUpload(file: File, kind: "foto" | "video"): Promise<string> {
	const error = validateUpload(file, kind);
	if (error) throw new Error(error);

	const name = `${kind}/${Date.now()}-${randomBytes(6).toString("hex")}.${EXTENSION[file.type] ?? "bin"}`;
	const blob = await put(name, file, { access: "public", contentType: file.type });
	return blob.url;
}
