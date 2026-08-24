/**
 * Label peran untuk UI. Client-safe: hanya konstanta, dipakai dialog tambah
 * pengguna dan dialog ubah peran supaya keduanya tidak menulis daftar sendiri.
 */
export const OPSI_PERAN = [
	{ value: "admin", label: "Admin (IT Sistem)" },
	{ value: "operator", label: "Operator DLH" },
	{ value: "kepala_seksi", label: "Kepala Seksi" },
	{ value: "kepala_dinas", label: "Kepala Dinas Lingkungan Hidup" },
	{ value: "walikota", label: "Wali Kota" },
	{ value: "petugas_lapangan", label: "Petugas Lapangan" },
] as const;

export function labelPeran(peran: string | null | undefined): string {
	if (!peran) return "—";
	return OPSI_PERAN.find((o) => o.value === peran)?.label ?? peran;
}
