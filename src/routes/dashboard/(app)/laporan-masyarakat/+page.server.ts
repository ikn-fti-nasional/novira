import { db } from "$lib/server/db/index.js";
import { publicReports } from "$lib/server/db/schema.js";
import { requireRoleOrRedirect, requireRoleOrFail, OPERATIONAL_ROLES } from "$lib/authorize.js";
import { fail } from "@sveltejs/kit";
import { eq, desc } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

const STATUSES = ["MENUNGGU", "DIPROSES", "SELESAI", "DITOLAK"] as const;

export const load: PageServerLoad = async ({ locals, url }) => {
	requireRoleOrRedirect(locals.user, [...OPERATIONAL_ROLES]);
	const filter = String(url.searchParams.get("status") ?? "MENUNGGU");
	const status = STATUSES.includes(filter as (typeof STATUSES)[number])
		? (filter as (typeof STATUSES)[number])
		: "MENUNGGU";

	const list = await db
		.select()
		.from(publicReports)
		.where(eq(publicReports.status, status))
		.orderBy(desc(publicReports.createdAt));

	return { reports: list, statusAktif: status, statuses: STATUSES };
};

export const actions: Actions = {
	proses: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...OPERATIONAL_ROLES]);
		if (denied) return denied;
		if (!locals.user) return fail(401, { message: "Unauthorized" });
		const user = locals.user;

		const form = await request.formData();
		const id = String(form.get("id") ?? "");
		const status = String(form.get("status") ?? "");
		const catatan = String(form.get("catatan") ?? "").trim();

		if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
			return fail(400, { message: "Data tidak valid" });
		}
		if (catatan.length > 2000) {
			return fail(400, { message: "Catatan terlalu panjang (maksimal 2000 karakter)" });
		}

		await db
			.update(publicReports)
			.set({
				status: status as (typeof STATUSES)[number],
				catatanPetugas: catatan || null,
				diprosesOleh: user.id,
				updatedAt: new Date(),
			})
			.where(eq(publicReports.id, id));

		return { success: true };
	},
};
