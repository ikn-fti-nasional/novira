import {
	requireRoleOrRedirect,
	requireRoleOrFail,
	OPERATIONAL_ROLES,
	SYSTEM_ADMIN_ROLES,
} from "$lib/authorize.js";
import {
	listJamRawan,
	listTitikKronis,
	ringkasanSumberInsiden,
	usulanJadwalPatroli,
} from "$lib/server/novira/analitik.js";
import { ringkasanEskalasiAktif } from "$lib/server/novira/eskalasi.js";
import {
	backfillSnapshot,
	deltaKpi,
	deretSkorHarian,
	punyaHistori,
	simpanSnapshotHarian,
	trenArea,
} from "$lib/server/novira/snapshot.js";
import type { Actions, PageServerLoad } from "./$types.js";

/**
 * Halaman analitik lanjutan — semuanya turunan statistik dari riwayat insiden
 * dan laporan warga, tanpa model tambahan.
 *
 * Aksesnya dibuka juga untuk peran eksekutif karena isinya persis yang
 * dibutuhkan untuk pengambilan keputusan anggaran (titik kronis → usulan TPS,
 * jam rawan → jadwal shift), bukan operasional harian.
 */
export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, [...OPERATIONAL_ROLES, "kepala_dinas", "walikota"]);

	const [titikKronis, jamRawan, patroli, sumber, eskalasi, tren, deret, delta, adaHistori] =
		await Promise.all([
			listTitikKronis(),
			listJamRawan(),
			usulanJadwalPatroli(),
			ringkasanSumberInsiden(),
			ringkasanEskalasiAktif(),
			trenArea(7),
			deretSkorHarian(30),
			deltaKpi(7),
			punyaHistori(),
		]);

	return {
		titikKronis,
		jamRawan,
		patroli,
		sumber,
		eskalasi,
		tren,
		deret,
		delta,
		adaHistori,
		bolehIsiArsip: locals.user.role === "admin",
	};
};

export const actions: Actions = {
	/**
	 * Isi arsip historis dari data insiden yang sudah ada.
	 *
	 * Dibatasi admin karena menulis banyak baris sekaligus. Aman diulang:
	 * `backfillSnapshot` memakai `onConflictDoNothing`, jadi hari yang sudah
	 * punya snapshot asli dari cron tidak akan tertimpa angka rekonstruksi.
	 */
	isiArsip: async ({ locals }) => {
		const denied = requireRoleOrFail(locals.user, [...SYSTEM_ADMIN_ROLES]);
		if (denied) return denied;

		const ditulis = await backfillSnapshot(14);
		await simpanSnapshotHarian();
		return { success: true, message: `Arsip terisi — ${ditulis} baris historis ditulis` };
	},
};
