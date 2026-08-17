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
const TIMEOUT_MS = 15_000;

/**
 * Batas probe yang berjalan bersamaan.
 *
 * Kamera Bandung memakai URL relatif (`/api/cctv/bandung/...`), artinya setiap
 * probe masuk kembali ke proses Node ini sendiri lalu diteruskan ke upstream
 * ATCS. Menembakkan 290 probe sekaligus (perilaku sebelumnya, satu
 * `Promise.allSettled` atas seluruh tabel) berarti server ini membanjiri
 * dirinya sendiri: request menumpuk di event loop, lewat batas 10 detik, dan
 * kamera yang sebenarnya SEHAT ditulis OFFLINE. Hasilnya dashboard melaporkan
 * uptime ~8% untuk feed yang sebetulnya bisa diputar.
 */
const MAKS_PARALEL = 6;

function resolveUrl(urlStream: string): string {
	if (/^https?:\/\//i.test(urlStream)) return urlStream;
	return new URL(urlStream, ORIGIN).toString();
}

async function cekSatuKamera(urlStream: string): Promise<boolean> {
	try {
		const res = await fetch(resolveUrl(urlStream), { signal: AbortSignal.timeout(TIMEOUT_MS) });
		if (!res.ok) {
			await res.body?.cancel();
			return false;
		}
		// Playlist HLS kosong = perangkat terdaftar tapi tidak mengudara. Kriteria
		// ini sama dengan yang dipakai saat registri kamera dibuat, jadi status
		// ONLINE di sini berarti hal yang sama dengan "stream terverifikasi".
		const teks = await res.text();
		return teks.includes("#EXTM3U") ? /\.ts|\.m4s|#EXTINF/i.test(teks) : teks.length > 0;
	} catch {
		return false;
	}
}

/** Jalankan `tugas` dengan paralelisme terbatas, mempertahankan urutan hasil. */
async function petaTerbatas<T, R>(
	items: readonly T[],
	batas: number,
	tugas: (item: T) => Promise<R>
): Promise<R[]> {
	const hasil = new Array<R>(items.length);
	let berikutnya = 0;
	const pekerja = Array.from({ length: Math.min(batas, items.length) }, async () => {
		while (berikutnya < items.length) {
			const i = berikutnya++;
			hasil[i] = await tugas(items[i]);
		}
	});
	await Promise.all(pekerja);
	return hasil;
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

	const hasil = await petaTerbatas(semua, MAKS_PARALEL, async (cam) => {
		if (cam.status === "PERBAIKAN" || !cam.urlStream) {
			return { cam, skip: true, ok: false };
		}
		const ok = await cekSatuKamera(cam.urlStream);
		return { cam, skip: false, ok };
	});

	let berubah = 0;
	for (const { cam, skip, ok } of hasil) {
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
			berubah++;
		}
		if (ok) summary.online++;
		else summary.offline++;
	}

	// Cek ini berjalan tiap 15 menit. Menulis baris audit setiap kali membuat
	// jejak audit didominasi 96 entri "tidak ada yang berubah" per hari, dan
	// tindakan operator yang sebenarnya penting terkubur di bawahnya. Catat
	// hanya kalau ada status kamera yang benar-benar berpindah.
	if (berubah > 0) {
		await db.insert(auditLog).values({
			id: generateId(10),
			waktu: now,
			pengguna: "sistem",
			peran: "SISTEM",
			tindakan: "Perubahan status kamera",
			rincian: `${berubah} kamera berubah status — hasil cek: ${summary.online} online, ${summary.offline} offline dari ${summary.diperiksa} kamera diperiksa (${summary.dilewati} dilewati karena status Perbaikan)`,
			wilayah: "Semua",
			tipe: "KONFIGURASI",
		});
	}

	return summary;
}
