import {
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
import { db } from "$lib/server/db/index.js";
import { cameras } from "$lib/server/db/schema.js";

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
	const rows = await db.select({ kota: cameras.kota }).from(cameras);
	const map = new Map<string, string>();
	for (const row of rows) map.set(kotaKeProvinsi(row.kota), row.kota);
	return [...map.entries()]
		.map(([nama]) => ({ id: `PROV-${nama}`, nama }))
		.sort((a, b) => a.nama.localeCompare(b.nama));
}

export async function listKabupatenKota() {
	const rows = await db.select({ kota: cameras.kota }).from(cameras);
	return [...new Set(rows.map((r) => r.kota).filter(Boolean))]
		.map((kota) => ({
			id: `KAB-${kota}`,
			provinsiId: `PROV-${kotaKeProvinsi(kota)}`,
			nama: kota,
		}))
		.sort((a, b) => a.nama.localeCompare(b.nama));
}

/** Pemetaan kota → provinsi agar filter cuma berisi lokasi yang benar-benar ada kameranya. */
export function kotaKeProvinsi(kota: string): string {
	const map: Record<string, string> = {
		Bandung: "Jawa Barat",
		"Kota Bandung": "Jawa Barat",
		"Kabupaten Cirebon": "Jawa Barat",
		"Kabupaten Bandung Barat": "Jawa Barat",
		"Kabupaten Bandung": "Jawa Barat",
		"Kota Cirebon": "Jawa Barat",
		"Kabupaten Tangerang": "Banten",
		"Kota Palembang": "Sumatera Selatan",
		"Kota Semarang": "Jawa Tengah",
		"Kabupaten Klaten": "Jawa Tengah",
		"Kabupaten Buleleng": "Bali",
		"Jakarta Pusat": "DKI Jakarta",
		Surabaya: "Jawa Timur",
		"Kota Surabaya": "Jawa Timur",
		Yogyakarta: "DI Yogyakarta",
	};
	return map[kota] ?? "Lainnya";
}

export async function listKamera(): Promise<Kamera[]> {
	const rows = await db.select().from(cameras).orderBy(cameras.nama);
	return rows.map((cam) => ({
		id: cam.id,
		nama: cam.nama,
		lokasi: cam.kecamatan ?? cam.kota,
		kelurahan: "",
		kecamatan: cam.kecamatan ?? "",
		kabupatenKota: cam.kota,
		provinsi: kotaKeProvinsi(cam.kota),
		latitude: Number(cam.latitude ?? 0),
		longitude: Number(cam.longitude ?? 0),
		status: cam.status,
		jumlahObjekTerdeteksi: 0,
		statusDeteksi: "NORMAL",
		urlStream: cam.urlStream ?? undefined,
		urlSnapshot: cam.urlSnapshot ?? undefined,
		fps: 0,
	}));
}

export async function listInsiden(): Promise<Insiden[]> {
	return MOCK_INSIDEN;
}

/**
 * Tandai insiden selesai (diangkat) + simpan URL bukti foto penanganan.
 * Insiden masih di-backing mock in-memory, jadi perubahan berlaku selama
 * proses server hidup — kontrak async sama seperti saat adapter Postgres
 * insiden datang nanti.
 */
export async function selesaikanInsiden(insidenId: string, buktiFotoUrl: string): Promise<Insiden | null> {
	const insiden = MOCK_INSIDEN.find((i) => i.id === insidenId);
	if (!insiden) return null;
	insiden.status = "SELESAI";
	// Jangan menimpa riwayat SLA: insiden yang sudah melanggar SLA tetap
	// tercatat MELANGGAR_SLA setelah selesai; hanya yang belum melanggar
	// yang ditandai TEPAT_WAKTU.
	if (insiden.statusSla !== "MELANGGAR_SLA") {
		insiden.statusSla = "TEPAT_WAKTU";
	}
	insiden.buktiFotoUrl = buktiFotoUrl;
	insiden.terakhirDilihat = new Date().toISOString();
	return insiden;
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
	const kamera = await db.select().from(cameras);
	const insidenAktif = MOCK_INSIDEN.filter((i) => i.status === "AKTIF").length;
	const cctvOnline = kamera.filter((c) => c.status === "ONLINE").length;
	const totalCctv = kamera.length;
	const slaMelanggar = MOCK_INSIDEN.filter((i) => i.statusSla === "MELANGGAR_SLA").length;
	// Volume hari ini diambil dari tren mock agar konsisten dengan grafik,
	// bukan konstanta ajaib.
	const volumeSampahHariIniKg = MOCK_TREN_SAMPAH.reduce((sum, t) => sum + t.volumeSampahKg, 0);

	return {
		insidenAktif,
		cctvOnline,
		totalCctv,
		persentaseUptimeCctv: totalCctv === 0 ? 0 : Math.round((cctvOnline / totalCctv) * 100),
		volumeSampahHariIniKg,
		slaMelanggar,
	};
}
