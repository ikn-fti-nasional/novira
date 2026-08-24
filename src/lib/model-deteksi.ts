/**
 * Label model deteksi untuk UI. Satu sumber supaya halaman Pengaturan,
 * Unggah & Analisa, dan triase Laporan Masyarakat tidak lagi menuliskan
 * ternary label masing-masing (yang dulu diam-diam menampilkan model baru
 * sebagai "TACO" karena cabang terakhirnya jadi fallback).
 *
 * Modul ini client-safe: hanya konstanta, tidak menyentuh apa pun dari
 * `$lib/server`.
 */
export const MODEL_TYPES_UI = ["street", "cctv", "taco", "novira"] as const;

export const LABEL_MODEL: Record<string, string> = {
	street: "Street (jalan/trotoar)",
	cctv: "CCTV Apung (sungai/kanal)",
	taco: "TACO (dataset umum)",
	novira: "Novira Vision (multimodal)",
};

export const DESKRIPSI_MODEL: Record<string, string> = {
	street: "Model CCTV jalan/trotoar — default untuk kamera ATCS Bandung.",
	cctv: "Model sampah mengambang — untuk kamera yang mengarah ke sungai/kanal.",
	taco: "Model dataset sampah umum — cakupan kelas luas, presisi lebih rendah.",
	novira: "Model multimodal — untuk foto laporan warga. Tidak bisa dipakai untuk video.",
};

export function labelModel(tipe: string | null | undefined): string {
	if (!tipe) return "—";
	return LABEL_MODEL[tipe] ?? tipe;
}
