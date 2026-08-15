import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.resolve("static/uploads");
const MAX_SIZE = {
	foto: 5 * 1024 * 1024,
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

export async function storeUpload(file: File, kind: "foto" | "video"): Promise<string> {
	const error = validateUpload(file, kind);
	if (error) throw new Error(error);

	await mkdir(UPLOAD_DIR, { recursive: true });
	const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${EXTENSION[file.type] ?? "bin"}`;
	const filePath = path.join(UPLOAD_DIR, name);
	await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
	return `/uploads/${name}`;
}
