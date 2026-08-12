import { listProvinsi, listKabupatenKota, listSkorWilayah } from "$lib/server/novira/index.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
	const [provinsiList, kabupatenKotaList, skorWilayahList] = await Promise.all([
		listProvinsi(),
		listKabupatenKota(),
		listSkorWilayah(),
	]);
	return { provinsiList, kabupatenKotaList, skorWilayahList };
};
