import { listKamera, listInsiden } from "$lib/server/novira/index.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
	const [kameraList, insidenList] = await Promise.all([listKamera(), listInsiden()]);
	return { kameraList, insidenList };
};
