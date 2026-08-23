/**
 * Rumus skor kebersihan 0..100 — satu-satunya sumber kebenaran.
 *
 * Dipakai di `index.ts` (hitungSkorWilayah) & `snapshot.ts` (arsip harian).
 * Sebelumnya duplikat: 100 - n*5 - durasi. Kalau satu sisi diubah tanpa yang lain,
 * skor "hari ini" tidak nyambung dengan historisnya.
 */
export function hitungSkorKebersihan(jumlahInsiden: number, rataRataDurasiJam: number): number {
	const durasi = Number(rataRataDurasiJam);
	return Math.min(100, Math.max(0, Math.round(100 - jumlahInsiden * 5 - durasi)));
}
