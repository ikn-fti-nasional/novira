import type { JenisSampah } from "$lib/types/novira.js";

/**
 * Pemetaan kelas mentah model → enum `jenisSampah` kami.
 *
 * Satu sumber untuk dua konsumen: siklus deteksi CCTV (`deteksi.ts`) dan
 * alur laporan warga (`laporan.ts`). Sebelumnya duplikat identik di kedua
 * file — kalau satu sisi diubah dan yang lain tidak, insiden CCTV dan
 * laporan warga untuk sampah yang sama akan diklasifikasikan berbeda.
 *
 * `Trash bin` adalah perabot kota, bukan sampah, jadi sengaja tidak ada di sini.
 * Empat kelas berikut hanya pernah muncul dari model Novira — pLitter tidak
 * mengenalinya. Aman disatukan di sini karena pemetaan berbasis nama kelas.
 */
export const CLASS_TO_JENIS: Partial<Record<string, JenisSampah>> = {
	Pile: "tumpukan_sampah",
	Plastic: "kantong_plastik",
	"Face mask": "kantong_plastik",
	Bottle: "botol_minuman",
	Cardboard: "kardus_kemasan",
	"Bulky waste": "pembuangan_liar_besar",
	"Construction debris": "puing_bangunan",
};
