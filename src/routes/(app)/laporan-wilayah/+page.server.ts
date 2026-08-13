import { listProvinsi, listKabupatenKota, listSkorWilayah } from "$lib/server/novira/index.js";
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
	const [provinsiList, kabupatenKotaList, skorWilayahList] = await Promise.all([
		listProvinsi(),
		listKabupatenKota(),
		listSkorWilayah(),
	]);
	return { provinsiList, kabupatenKotaList, skorWilayahList };
};
