import {
	MOCK_PROVINSI,
	MOCK_KABUPATEN_KOTA,
	MOCK_KAMERA,
	MOCK_INSIDEN,
	MOCK_SKOR_WILAYAH,
	MOCK_PETUGAS,
	MOCK_TREN_SAMPAH,
	MOCK_AUDIT_LOG,
	MOCK_EKSEKUTIF_KPI,
	MOCK_KECAMATAN_LIST,
	MOCK_TREN_KECAMATAN_MINGGUAN,
	MOCK_TREN_KECAMATAN_BULANAN,
	MOCK_LEADERBOARD_EXPANDED,
} from "$lib/mock/novira.js";
import type {
	Kamera,
	Insiden,
	SkorKebersihanWilayah,
	PetugasLapangan,
	TrenSampahJam,
	LogAuditSistem,
	TrenSkorKecamatan,
	EksekutifKpiStats,
} from "$lib/types/novira.js";

/**
 * Seam data domain NOVIRA — satu-satunya pintu masuk data operasional
 * (kamera CCTV, insiden, skor wilayah, petugas, tren, log audit).
 *
 * Sebelumnya 9 halaman mengimpor `mock/novira.js` langsung, jadi menukar
 * sumber data (mis. tabel Postgres kamera/insiden + servis inference YOLOv8)
 * berarti menyentuh 9 file. Lewat modul ini, tukar cukup terjadi di sini —
 * konsumen tidak berubah. Saat ini di-backing mock; fungsi bersifat async
 * supaya kontraknya tetap sama saat adapter Postgres asli datang.
 *
 * Catatan: bentuk data sengaja TIDAK didesain ulang di sini — hanya
 * mengkonsolidasi bentuk yang sudah ada (`types/novira.ts` + mock), supaya
 * tidak jadi premature abstraction sebelum skema DB kamera/insiden final.
 */

export async function listProvinsi() {
	return MOCK_PROVINSI;
}

export async function listKabupatenKota() {
	return MOCK_KABUPATEN_KOTA;
}

export async function listKamera(): Promise<Kamera[]> {
	return MOCK_KAMERA;
}

export async function listInsiden(): Promise<Insiden[]> {
	return MOCK_INSIDEN;
}

export async function listSkorWilayah(): Promise<SkorKebersihanWilayah[]> {
	return MOCK_SKOR_WILAYAH;
}

export async function listPetugas(): Promise<PetugasLapangan[]> {
	return MOCK_PETUGAS;
}

export async function listTrenSampah(): Promise<TrenSampahJam[]> {
	return MOCK_TREN_SAMPAH;
}

export async function listAuditLog(): Promise<LogAuditSistem[]> {
	return MOCK_AUDIT_LOG;
}

/** Data dashboard eksekutif (kepala dinas/walikota) — KPI ringkas + tren + leaderboard. */
export async function listEksekutifKpi(): Promise<EksekutifKpiStats> {
	return MOCK_EKSEKUTIF_KPI;
}

export async function listKecamatanList(): Promise<string[]> {
	return MOCK_KECAMATAN_LIST;
}

export async function listTrenKecamatanMingguan(): Promise<TrenSkorKecamatan[]> {
	return MOCK_TREN_KECAMATAN_MINGGUAN;
}

export async function listTrenKecamatanBulanan(): Promise<TrenSkorKecamatan[]> {
	return MOCK_TREN_KECAMATAN_BULANAN;
}

export async function listLeaderboardExpanded(): Promise<SkorKebersihanWilayah[]> {
	return MOCK_LEADERBOARD_EXPANDED;
}

/** KPI domain NOVIRA — diturunkan dari data kamera/insiden/tren (bukan DB user). */
export async function ringkasanKpi() {
	const insidenAktif = MOCK_INSIDEN.filter((i) => i.status === "AKTIF").length;
	const cctvOnline = MOCK_KAMERA.filter((c) => c.status === "ONLINE").length;
	const totalCctv = MOCK_KAMERA.length;
	const slaMelanggar = MOCK_INSIDEN.filter((i) => i.statusSla === "MELANGGAR_SLA").length;
	// Volume hari ini diambil dari tren mock agar konsisten dengan grafik,
	// bukan konstanta ajaib.
	const volumeSampahHariIniKg = MOCK_TREN_SAMPAH.reduce((sum, t) => sum + t.volumeSampahKg, 0);

	return {
		insidenAktif,
		cctvOnline,
		totalCctv,
		persentaseUptimeCctv: Math.round((cctvOnline / totalCctv) * 100),
		volumeSampahHariIniKg,
		slaMelanggar,
	};
}
