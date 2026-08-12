import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types.js";
import {
	MOCK_EKSEKUTIF_KPI,
	MOCK_KECAMATAN_LIST,
	MOCK_TREN_KECAMATAN_MINGGUAN,
	MOCK_TREN_KECAMATAN_BULANAN,
	MOCK_LEADERBOARD_EXPANDED,
	MOCK_PROVINSI,
	MOCK_KABUPATEN_KOTA,
} from "$lib/mock/novira.js";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(302, "/login");
	}

	return {
		user: locals.user,
		kpi: MOCK_EKSEKUTIF_KPI,
		kecamatanList: MOCK_KECAMATAN_LIST,
		trenMingguan: MOCK_TREN_KECAMATAN_MINGGUAN,
		trenBulanan: MOCK_TREN_KECAMATAN_BULANAN,
		leaderboard: MOCK_LEADERBOARD_EXPANDED,
		provinsiList: MOCK_PROVINSI,
		kabupatenKotaList: MOCK_KABUPATEN_KOTA,
	};
};
