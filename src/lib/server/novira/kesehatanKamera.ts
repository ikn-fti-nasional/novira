import { eq } from "drizzle-orm";
import { db } from "$lib/server/db/index.js";
import { cameras, auditLog } from "$lib/server/db/schema.js";
import { generateId } from "$lib/server/id.js";

/**
 * Cek keterjangkauan stream setiap kamera (semua kota, bukan cuma Bandung)
 * dan perbarui `status` sesuai kenyataan. Sebelum ini, `status` cuma nilai
 * seed statis ("ONLINE" untuk semuanya) yang tidak pernah diperbarui untuk
 * kota selain Bandung -- jadi kamera yang sudah lama mati di upstream tetap
 * mengaku ONLINE selamanya. `PERBAIKAN` sengaja tidak disentuh -- itu flag
 * manual admin, bukan sesuatu yang boleh ditimpa otomatis.
 */

const ORIGIN = process.env.ORIGIN ?? "http://localhost:5173";
const TIMEOUT_MS = 10_000;

function resolveUrl(urlStream: string): string {
	if (/^https?:\/\//i.test(urlStream)) return urlStream;
	return new URL(urlStream, ORIGIN).toString();
}

async function cekSatuKamera(urlStream: string): Promise<boolean> {
	try {
		const res = await fetch(resolveUrl(urlStream), { signal: AbortSignal.timeout(TIMEOUT_MS) });
		return res.ok;
	} catch {
		return false;
	}
}

export interface KesehatanKameraSummary {
	diperiksa: number;
	online: number;
	offline: number;
	dilewati: number; // status PERBAIKAN, tidak disentuh
}

export async function periksaKesehatanKamera(): Promise<KesehatanKameraSummary> {
	const semua = await db.select().from(cameras);
	const summary: KesehatanKameraSummary = { diperiksa: 0, online: 0, offline: 0, dilewati: 0 };
	const now = new Date();

	const hasil = await Promise.allSettled(
		semua.map(async (cam) => {
			if (cam.status === "PERBAIKAN" || !cam.urlStream) {
				return { cam, skip: true, ok: false };
			}
			const ok = await cekSatuKamera(cam.urlStream);
			return { cam, skip: false, ok };
		})
	);

	for (const r of hasil) {
		if (r.status !== "fulfilled") continue;
		const { cam, skip, ok } = r.value;
		if (skip) {
			summary.dilewati++;
			continue;
		}
		summary.diperiksa++;
		const statusBaru = ok ? "ONLINE" : "OFFLINE";
		if (cam.status !== statusBaru) {
			await db
				.update(cameras)
				.set({ status: statusBaru, updatedAt: now })
				.where(eq(cameras.id, cam.id));
		}
		if (ok) summary.online++;
		else summary.offline++;
	}

	await db.insert(auditLog).values({
		id: generateId(10),
		waktu: now,
		pengguna: "sistem",
		peran: "SISTEM",
		tindakan: "Cek kesehatan kamera",
		rincian: `${summary.diperiksa} kamera diperiksa: ${summary.online} online, ${summary.offline} offline (${summary.dilewati} dilewati karena status Perbaikan)`,
		wilayah: "Semua",
		tipe: "KONFIGURASI",
	});

	return summary;
}
