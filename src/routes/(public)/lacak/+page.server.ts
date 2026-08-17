import { lacakLaporan } from "$lib/server/novira/laporan.js";
import type { PageServerLoad } from "./$types.js";

/**
 * Pelacakan laporan publik — tanpa akun, tanpa sesi.
 *
 * Kodenya dibaca dari query string (bukan form POST) supaya tautan
 * `/lacak?kode=LPR-XXXXXX` bisa dikirim langsung ke pelapor lewat pesan
 * singkat dan halaman berhasil bisa menautkannya. Konsekuensinya kode itu
 * masuk ke riwayat peramban dan log server — itu sebabnya `lacakLaporan()`
 * sengaja tidak pernah mengembalikan nama atau nomor telepon pelapor.
 */
export const load: PageServerLoad = async ({ url }) => {
	const kode = url.searchParams.get("kode")?.trim() ?? "";
	if (!kode) return { kode: "", hasil: null, tidakDitemukan: false };

	const hasil = await lacakLaporan(kode);
	return { kode, hasil, tidakDitemukan: hasil === null };
};
