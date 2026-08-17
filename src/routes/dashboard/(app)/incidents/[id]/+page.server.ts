import { error } from "@sveltejs/kit";
import { getInsidenDetail } from "$lib/server/novira/index.js";
import { requireRoleOrRedirect, NON_EXECUTIVE_ROLES } from "$lib/authorize.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals, params }) => {
	requireRoleOrRedirect(locals.user, [...NON_EXECUTIVE_ROLES]);

	const detail = await getInsidenDetail(params.id);
	if (!detail) error(404, "Insiden tidak ditemukan");

	return detail;
};
