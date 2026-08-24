import cron from "node-cron";
import { lte } from "drizzle-orm";
import { db } from "$lib/server/db/index.js";
import { sessions } from "$lib/server/db/schema.js";
import { jalankanSiklusDeteksi } from "./deteksi.js";
import { periksaKesehatanKamera } from "./kesehatanKamera.js";
import { jalankanEskalasiSla } from "./eskalasi.js";
import { simpanSnapshotHarian } from "./snapshot.js";

// Module-level guard: hooks.server.ts calls this once at import time, but
// dev-server module re-evaluation (or any future double-import) must not
// register the same cron jobs twice.
let started = false;

/**
 * Registers:
 * - twice-daily (12:00 & 15:00 WIB) Bandung CCTV detection cron
 * - every-15-minutes camera health check (all cities) -- cheap reachability
 *   probe, not detection, so it can run far more often than the detection
 *   cycle. Without this, `cameras.status` for every non-Bandung camera was
 *   just a frozen seed value that never reflected real uptime.
 */
export function startDetectionScheduler(): void {
	if (started) return;
	started = true;

	for (const expression of ["0 12 * * *", "0 15 * * *"]) {
		cron.schedule(
			expression,
			() => {
				jalankanSiklusDeteksi().catch((err) => {
					console.error("[novira] Siklus deteksi CCTV Bandung gagal:", err);
				});
			},
			{ timezone: "Asia/Jakarta" }
		);
	}

	cron.schedule(
		"*/15 * * * *",
		() => {
			periksaKesehatanKamera().catch((err) => {
				console.error("[novira] Cek kesehatan kamera gagal:", err);
			});
		},
		{ timezone: "Asia/Jakarta" }
	);

	// Eskalasi SLA tiap jam. Frekuensinya sengaja jauh lebih tinggi daripada
	// siklus deteksi: ambang SLA (12/24/48 jam) harus terdeteksi mendekati
	// waktu terlewatnya, bukan menunggu siklus deteksi berikutnya. Aman
	// dijalankan sesering ini karena `jalankanEskalasiSla` monoton — jenjang
	// yang sudah dilewati tidak dikirim ulang.
	cron.schedule(
		"5 * * * *",
		() => {
			jalankanEskalasiSla().catch((err) => {
				console.error("[novira] Eskalasi SLA gagal:", err);
			});
		},
		{ timezone: "Asia/Jakarta" }
	);

	// Arsip skor kebersihan harian, 23:50 WIB — cukup dekat ke akhir hari
	// untuk mewakili hari itu, dan menyisakan jeda sebelum tengah malam kalau
	// eksekusinya lambat, supaya baris tidak tercatat di tanggal berikutnya.
	cron.schedule(
		"50 23 * * *",
		() => {
			simpanSnapshotHarian().catch((err) => {
				console.error("[novira] Snapshot skor harian gagal:", err);
			});
		},
		{ timezone: "Asia/Jakarta" }
	);

	// Bersihkan session kedaluwarsa sekali sehari. Tanpa ini baris session
	// hanya terhapus kalau token-nya kebetulan dipakai lagi (validateSession)
	// — session yang ditinggal begitu saja menumpuk di DB selamanya.
	cron.schedule(
		"0 3 * * *",
		() => {
			void db
				.delete(sessions)
				// expiresAt disimpan sebagai epoch ms (mode number), bukan Date.
				.where(lte(sessions.expiresAt, Date.now()))
				.catch((err) => {
					console.error("[novira] Bersih-bersih session kedaluwarsa gagal:", err);
				});
		},
		{ timezone: "Asia/Jakarta" }
	);

	console.log(
		"[novira] Jadwal aktif — deteksi CCTV Bandung 12:00 & 15:00 WIB, cek kesehatan kamera tiap 15 menit, " +
			"eskalasi SLA tiap jam, snapshot skor harian 23:50 WIB, pembersihan session harian 03:00 WIB"
	);
}
