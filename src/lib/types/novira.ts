/** Kategori baris audit. `LAPORAN_WARGA` dan `ESKALASI` menyusul fitur triase laporan & tangga SLA. */
export type TipeAudit =
	"DETEKSI_AI" | "TUGAS_PETUGAS" | "UBAH_STATUS" | "KONFIGURASI" | "LAPORAN_WARGA" | "ESKALASI";

export type TingkatTingkatKeparahan = "KRITIS" | "TINGGI" | "SEDANG" | "RENDAH";

export type StatusInsiden = "AKTIF" | "PERINGATAN" | "SELESAI" | "POSITIF_PALSU";

export type JenisSampah =
	| "tumpukan_sampah"
	| "kantong_plastik"
	| "kardus_kemasan"
	| "botol_minuman"
	| "pembuangan_liar_besar"
	| "puing_bangunan";

export type StatusKamera = "ONLINE" | "OFFLINE" | "PERBAIKAN";

export interface WilayahScope {
	provinsiId: string;
	provinsiNama: string;
	kabupatenKotaId: string;
	kabupatenKotaNama: string;
}

export interface Kamera {
	id: string;
	nama: string;
	lokasi: string;
	kelurahan: string;
	kecamatan: string;
	kabupatenKota: string;
	provinsi: string;
	latitude: number;
	longitude: number;
	status: StatusKamera;
	jumlahObjekTerdeteksi: number;
	statusDeteksi: "NORMAL" | "PERINGATAN" | "KRITIS";
	urlStream?: string;
	urlSnapshot?: string;
	fps: number;
}

/** Satu baris penjelasan skor prioritas — bentuknya cermin `FaktorPrioritas` di server. */
export interface FaktorPrioritasView {
	label: string;
	poin: number;
	keterangan: string;
}

export interface Insiden {
	id: string;
	/** `null` untuk insiden hasil laporan warga yang tidak dekat kamera mana pun. */
	kameraId: string | null;
	/** Asal insiden — menentukan ikon/badge sumber di UI. */
	sumber: "CCTV" | "LAPORAN_WARGA";
	/** Kode laporan warga asal (kalau ada), supaya operator bisa membuka laporannya. */
	kodeLaporan?: string;
	/** Skor prioritas 0..100 beserta faktor pembentuknya. */
	skorPrioritas: number;
	rincianPrioritas: FaktorPrioritasView[];
	/** 0 = belum dieskalasi, 1 petugas, 2 kepala seksi, 3 kepala dinas. */
	tingkatEskalasi: number;
	/**
	 * Koordinat insiden untuk pemetaan. Diambil dari kamera (sumber CCTV) atau
	 * dari koordinat GPS laporan warga. `null` bila keduanya tidak tersedia —
	 * insiden seperti itu tidak bisa dipetakan dan sengaja tidak digambar
	 * di titik tebakan mana pun.
	 */
	latitude: number | null;
	longitude: number | null;
	namaKamera: string;
	lokasi: string;
	kelurahan: string;
	kecamatan: string;
	kabupatenKota: string;
	provinsi: string;
	trackId: string;
	jenisSampah: JenisSampah;
	labelSampah: string;
	pertamaDilihat: string;
	terakhirDilihat: string;
	durasiMenit: number;
	status: StatusInsiden;
	keparahan: TingkatTingkatKeparahan;
	tingkatKepercayaan: number; // 0.0 - 1.0
	urlSnapshot: string;
	urlSnapshotPertama?: string;
	petugasDitugaskan?: string;
	buktiFotoUrl?: string;
	catatanPenyelesaian?: string;
	statusSla: "TEPAT_WAKTU" | "HAMPIR_BREACH" | "MELANGGAR_SLA";
	bbox: { x: number; y: number; width: number; height: number };
}

/** Satu baris jejak audit yang sudah difilter untuk satu insiden spesifik -- dipakai di halaman detail/timeline insiden. */
export interface RiwayatInsidenEntry {
	id: string;
	waktu: string;
	pengguna: string;
	peran: string;
	tindakan: string;
	rincian: string;
	tipe: TipeAudit;
}

export interface SkorKebersihanWilayah {
	peringkat: number;
	kelurahan: string;
	kecamatan: string;
	kabupatenKota: string;
	provinsi: string;
	jumlahInsiden: number;
	rataRataDurasiSampahJam: number;
	skorKebersihan: number; // 0 - 100
	tren: "membaik" | "menurun" | "stabil";
	persentaseTren: number;
}

export interface PetugasLapangan {
	id: string;
	nama: string;
	peran: string;
	telepon: string;
	wilayahTugas: string;
	status: "SIAP_TUGAS" | "SEDANG_BERTUGAS" | "OFFLINE";
	jumlahTugasAktif: number;
	avatar?: string;
	/** Akun login (role petugas_lapangan) yang terhubung ke petugas ini, kalau ada. */
	userId?: string;
}

export interface TrenSampahJam {
	jam: string;
	insidenAktif: number;
	insidenSelesai: number;
	volumeSampahKg: number;
}

export interface LogAuditSistem {
	id: string;
	waktu: string;
	pengguna: string;
	peran: string;
	tindakan: string;
	rincian: string;
	wilayah: string;
	tipe: TipeAudit;
}

export interface TrenSkorKecamatan {
	label: string; // "Senin", "Selasa" or "Jan", "Feb"
	rataRataKota: number;
	lengkong: number;
	cicendo: number;
	regol: number;
	coblong: number;
	andir: number;
	bandungWetan: number;
}

export interface EksekutifKpiStats {
	skorRataRata: number;
	kategoriSkor: string;
	trenSkor: string; // "+3.2%"
	insidenAktif: number;
	trenInsiden: string; // "-12%"
	persentaseSlaMelanggar: number;
	trenSla: string; // "-1.5%"
	indeksTrenMingguan: string; // "+5.4%"
}
