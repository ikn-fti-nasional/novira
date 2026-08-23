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

const MAGIC: Record<string, { offset: number; bytes: number[] }[]> = {
	"image/jpeg": [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
	"image/png": [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
	"image/webp": [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }], // RIFF....WEBP checked separately
	"video/mp4": [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }], // ftyp at 4
	"video/webm": [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }],
	"video/quicktime": [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }],
};

function matchesMagic(buf: Uint8Array, type: string): boolean {
	const patterns = MAGIC[type];
	if (!patterns) return true;
	for (const { offset, bytes } of patterns) {
		if (buf.length < offset + bytes.length) return false;
		for (let i = 0; i < bytes.length; i++) if (buf[offset + i] !== bytes[i]) return false;
	}
	// Extra WEBP check: bytes 8-11 must be WEBP
	if (type === "image/webp") {
		if (buf.length < 12) return false;
		return buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
	}
	return true;
}

async function assertMagic(file: File, kind: "foto" | "video"): Promise<string | null> {
	try {
		const slice = await file.slice(0, 16).arrayBuffer();
		const buf = new Uint8Array(slice);
		if (buf.length === 0) return null;
		if (!matchesMagic(buf, file.type)) {
			return `${kind === "foto" ? "Foto" : "Video"} tidak sesuai format ${file.type} (header tidak cocok)`;
		}
	} catch {
		// Kalau gagal baca header (mis. stream error), jangan blokir — validasi MIME sudah lolos.
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
	const magicError = await assertMagic(file, kind);
	if (magicError) throw new Error(magicError);

	const name = `${kind}/${Date.now()}-${randomBytes(6).toString("hex")}.${EXTENSION[file.type] ?? "bin"}`;
	const blob = await put(name, file, { access: "public", contentType: file.type });
	return blob.url;
}

/**
 * Simpan foto beranotasi (kotak deteksi) yang dihasilkan pLitter -- ini
 * gambar yang sudah digenerate model, bukan unggahan mentah pengguna, jadi
 * tidak lewat `validateUpload`.
 */
export async function storeAnnotatedImage(file: File): Promise<string> {
	const name = `foto-analisa/${Date.now()}-${randomBytes(6).toString("hex")}.jpg`;
	const blob = await put(name, file, { access: "public", contentType: "image/jpeg" });
	return blob.url;
}
