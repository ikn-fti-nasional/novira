import { eq } from "drizzle-orm";
import { db } from "$lib/server/db/index.js";
import { cameras, auditLog } from "$lib/server/db/schema.js";
import { generateId } from "$lib/server/id.js";
import { petaTerbatas } from "./petaTerbatas.js";

/**
 * Cek keterjangkauan stream setiap kamera (semua kota, bukan cuma Bandung)
 * dan perbarui `status` sesuai kenyataan. Sebelum ini, `status` cuma nilai
 * seed statis ("ONLINE" untuk semuanya) yang tidak pernah diperbarui untuk
 * kota selain Bandung -- jadi kamera yang sudah lama mati di upstream tetap
 * mengaku ONLINE selamanya. `PERBAIKAN` sengaja tidak disentuh -- itu flag
 * manual admin, bukan sesuatu yang boleh ditimpa otomatis.
 */

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

// Upstream Bandung — sama dengan SOURCES.bandung di api/cctv. Probe server-side
// tidak perlu lewat proxy (yang kini butuh sesi); deteksi.ts juga langsung ke
// upstream. Jangan pakai ORIGIN/proxy agar tidak kena 401.
const BANDUNG_UPSTREAM_BASE = "https://pelindung.bandung.go.id:3443/video/";
const BANDUNG_PROXY_PREFIX = "/api/cctv/bandung/";

function resolveUrl(urlStream: string): string {
	if (urlStream.startsWith(BANDUNG_PROXY_PREFIX)) {
		return BANDUNG_UPSTREAM_BASE + urlStream.slice(BANDUNG_PROXY_PREFIX.length);
	}
	if (/^https?:\/\//i.test(urlStream)) return urlStream;
	const origin = process.env.ORIGIN ?? "http://localhost:5173";
	return new URL(urlStream, origin).toString();
}

async function cekSatuKamera(urlStream: string): Promise<boolean> {
	try {
		const url = resolveUrl(urlStream);
		const headers: Record<string, string> = {};
		if (url.startsWith(BANDUNG_UPSTREAM_BASE)) {
			headers["Origin"] = new URL(BANDUNG_UPSTREAM_BASE).origin;
			headers["Referer"] = new URL(BANDUNG_UPSTREAM_BASE).origin + "/";
		}
		const res = await fetch(url, {
			headers: Object.keys(headers).length ? headers : undefined,
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
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

	const toUpdate: { id: string; status: "ONLINE" | "OFFLINE" }[] = [];
	let berubah = 0;
	for (const settled of hasil) {
		// cekSatuKamera menelan errornya sendiri, jadi rejected di sini tidak
		// seharusnya terjadi — lewati daripada menghitung kamera fiktif.
		if (settled.status === "rejected") continue;
		const { cam, skip, ok } = settled.value;
		if (skip) {
			summary.dilewati++;
			continue;
		}
		summary.diperiksa++;
		const statusBaru = ok ? "ONLINE" : "OFFLINE";
		if (cam.status !== statusBaru) {
			toUpdate.push({ id: cam.id, status: statusBaru });
			berubah++;
		}
		if (ok) summary.online++;
		else summary.offline++;
	}

	// Batch update dalam satu transaksi — 290 kamera sequential tanpa tx = 290 round-trip
	// + partial commit kalau proses mati di tengah.
	if (toUpdate.length > 0) {
		await db.transaction(async (tx) => {
			for (const u of toUpdate) {
				await tx
					.update(cameras)
					.set({ status: u.status, updatedAt: now })
					.where(eq(cameras.id, u.id));
			}
			await tx.insert(auditLog).values({
				id: generateId(10),
				waktu: now,
				pengguna: "sistem",
				peran: "SISTEM",
				tindakan: "Perubahan status kamera",
				rincian: `${berubah} kamera berubah status — hasil cek: ${summary.online} online, ${summary.offline} offline dari ${summary.diperiksa} kamera diperiksa (${summary.dilewati} dilewati karena status Perbaikan)`,
				wilayah: "Semua",
				tipe: "KONFIGURASI",
			});
		});
	}

	return summary;
}
