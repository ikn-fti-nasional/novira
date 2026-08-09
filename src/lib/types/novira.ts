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

export interface Insiden {
	id: string;
	kameraId: string;
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
	petugasDitugaskan?: string;
	statusSla: "TEPAT_WAKTU" | "HAMPIR_BREACH" | "MELANGGAR_SLA";
	bbox: { x: number; y: number; width: number; height: number };
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
	tipe: "DETEKSI_AI" | "TUGAS_PETUGAS" | "UBAH_STATUS" | "KONFIGURASI";
}
