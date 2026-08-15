import { listKamera } from "$lib/server/novira/index.js";
import { db } from "$lib/server/db/index.js";
import { cameras } from "$lib/server/db/schema.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
	const [kameraList, rows] = await Promise.all([listKamera(), db.select().from(cameras)]);
	const kotaList = [...new Set(rows.map((c) => c.kota))].sort();
	return { kameraList, kotaList };
};
