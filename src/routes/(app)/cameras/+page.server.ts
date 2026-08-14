import { listKamera } from "$lib/server/novira/index.js";
import { requireRoleOrRedirect, OPERATIONAL_ROLES } from "$lib/authorize.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, [...OPERATIONAL_ROLES]);
	return { kameraList: await listKamera() };
};
