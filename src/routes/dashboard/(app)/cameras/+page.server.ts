import { db } from "$lib/server/db/index.js";
import { cameras } from "$lib/server/db/schema.js";
import { requireRoleOrRedirect, requireRoleOrFail, OPERATIONAL_ROLES } from "$lib/authorize.js";
import { generateId } from "$lib/server/id.js";
import { fail } from "@sveltejs/kit";
import { eq, desc } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, [...OPERATIONAL_ROLES]);
	const list = await db.select().from(cameras).orderBy(desc(cameras.createdAt));
	const kotaList = [...new Set(list.map((c) => c.kota))].sort();
	return { kameraList: list, kotaList };
};

export const actions: Actions = {
	tambah: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...OPERATIONAL_ROLES]);
		if (denied) return denied;

		const form = await request.formData();
		const nama = String(form.get("nama") ?? "").trim();
		const kota = String(form.get("kota") ?? "").trim();
		const kecamatan = String(form.get("kecamatan") ?? "").trim();
		const urlStream = String(form.get("urlStream") ?? "").trim();
		const urlSnapshot = String(form.get("urlSnapshot") ?? "").trim();
		const status = String(form.get("status") ?? "OFFLINE");

		if (!nama || !kota) {
			return fail(400, { message: "Nama dan kota wajib diisi" });
		}

		await db.insert(cameras).values({
			id: generateId(16),
			nama,
			kota,
			kecamatan: kecamatan || null,
			urlStream: urlStream || null,
			urlSnapshot: urlSnapshot || null,
			status: (["ONLINE", "OFFLINE", "PERBAIKAN"] as const).includes(
				status as "ONLINE" | "OFFLINE" | "PERBAIKAN"
			)
				? (status as "ONLINE" | "OFFLINE" | "PERBAIKAN")
				: "OFFLINE",
		});
		return { success: true };
	},

	hapus: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...OPERATIONAL_ROLES]);
		if (denied) return denied;

		const form = await request.formData();
		const id = String(form.get("id") ?? "");
		if (!id) return fail(400, { message: "ID kamera tidak valid" });

		await db.delete(cameras).where(eq(cameras.id, id));
		return { success: true };
	},

	ubahStatus: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...OPERATIONAL_ROLES]);
		if (denied) return denied;

		const form = await request.formData();
		const id = String(form.get("id") ?? "");
		const status = String(form.get("status") ?? "OFFLINE");
		if (!id) return fail(400, { message: "ID kamera tidak valid" });

		await db
			.update(cameras)
			.set({
				status: (["ONLINE", "OFFLINE", "PERBAIKAN"] as const).includes(
					status as "ONLINE" | "OFFLINE" | "PERBAIKAN"
				)
					? (status as "ONLINE" | "OFFLINE" | "PERBAIKAN")
					: "OFFLINE",
				updatedAt: new Date(),
			})
			.where(eq(cameras.id, id));
		return { success: true };
	},
};
