import { listProvinsi, listKabupatenKota, listSkorWilayah } from "$lib/server/novira/index.js";
import { requireRoleOrRedirect, PAGE_ACCESS } from "$lib/server/authorize.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, [...PAGE_ACCESS["/laporan-wilayah"]]);
	const [provinsiList, kabupatenKotaList, skorWilayahList] = await Promise.all([
		listProvinsi(),
		listKabupatenKota(),
		listSkorWilayah(),
	]);
	return { provinsiList, kabupatenKotaList, skorWilayahList };
};
