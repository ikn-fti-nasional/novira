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
		"operator",
		"kepala_seksi",
		"kepala_dinas",
		"walikota",
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
