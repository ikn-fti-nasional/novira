import {
	listEksekutifKpi,
	listKecamatanList,
	listTrenKecamatanMingguan,
	listTrenKecamatanBulanan,
	listLeaderboardExpanded,
	listProvinsi,
	listKabupatenKota,
} from "$lib/server/novira/index.js";
import { requireRoleOrRedirect } from "$lib/server/authorize.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, [
		"admin",
		"admin_dlh",
		"kepala_dinas",
		"walikota",
		"petugas_lapangan",
		"editor",
		"viewer",
	]);

	const [
		kpi,
		kecamatanList,
		trenMingguan,
		trenBulanan,
		leaderboard,
		provinsiList,
		kabupatenKotaList,
	] = await Promise.all([
		listEksekutifKpi(),
		listKecamatanList(),
		listTrenKecamatanMingguan(),
		listTrenKecamatanBulanan(),
		listLeaderboardExpanded(),
		listProvinsi(),
		listKabupatenKota(),
	]);

	return {
		user: locals.user,
		demoData: true,
		kpi,
		kecamatanList,
		trenMingguan,
		trenBulanan,
		leaderboard,
		provinsiList,
		kabupatenKotaList,
	};
};
