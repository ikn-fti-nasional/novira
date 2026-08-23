import type { JenisSampah } from "$lib/types/novira.js";

/**
 * Pemetaan kelas mentah model pLitter → enum `jenisSampah` kami.
 *
 * Satu sumber untuk dua konsumen: siklus deteksi CCTV (`deteksi.ts`) dan
 * alur laporan warga (`laporan.ts`). Sebelumnya duplikat identik di kedua
 * file — kalau satu sisi diubah dan yang lain tidak, insiden CCTV dan
 * laporan warga untuk sampah yang sama akan diklasifikasikan berbeda.
 *
 * Hanya kelas model `street` yang dipetakan hari ini. `Trash bin` adalah
 * perabot kota, bukan sampah, jadi sengaja tidak ada di sini — lihat
 * BANDUNG_FINETUNE.md.
 */
export const CLASS_TO_JENIS: Partial<Record<string, JenisSampah>> = {
	Pile: "tumpukan_sampah",
	Plastic: "kantong_plastik",
	"Face mask": "kantong_plastik",
};
