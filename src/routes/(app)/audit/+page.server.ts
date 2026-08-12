import { listAuditLog } from "$lib/server/novira/index.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
	return { auditLogList: await listAuditLog() };
};
