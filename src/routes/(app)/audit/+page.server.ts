import { listAuditLog } from "$lib/server/novira/index.js";
import { requireRoleOrRedirect } from "$lib/server/authorize.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, ["admin"]);
	return { auditLogList: await listAuditLog() };
};
