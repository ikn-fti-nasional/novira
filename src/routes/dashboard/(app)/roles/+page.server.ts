import { db } from "$lib/server/db/index.js";
import { users } from "$lib/server/db/schema.js";
import {
	requireRoleOrRedirect,
	requireRoleOrFail,
	isRole,
	SYSTEM_ADMIN_ROLES,
} from "$lib/authorize.js";
import { countAll } from "$lib/server/db/helpers.js";
import { fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

const roleDefinitions = [
	{
		name: "admin" as const,
		description: "IT & super admin sistem — kelola pengguna, peran, pengaturan, dan database.",
		permissions: [
			"Manage users",
			"Manage roles",
			"Manage settings",
			"View database",
			"Manage content",
			"Manage cameras & officers",
			"Verify incidents",
			"Export reports",
		],
	},
	{
		name: "operator" as const,
		description: "Admin DLH / operator command center — kelola operasional harian pemantauan.",
		permissions: [
			"Manage cameras",
			"Manage officers",
			"Verify incidents",
			"Assign petugas",
			"Manage content",
			"Export reports",
		],
	},
	{
		name: "kepala_seksi" as const,
		description: "Kepala seksi kebersihan — pantau operasional dan koordinasi eskalasi SLA.",
		permissions: [
			"View live monitoring",
			"View incidents",
			"Escalate SLA violations",
			"Export reports",
		],
	},
	{
		name: "kepala_dinas" as const,
		description: "Kepala Dinas Lingkungan Hidup — dashboard eksekutif read-only.",
		permissions: [
			"View executive dashboard",
			"View area ranking",
			"View reports",
			"Export reports",
		],
	},
	{
		name: "walikota" as const,
		description: "Wali Kota — dashboard eksekutif read-only.",
		permissions: [
			"View executive dashboard",
			"View area ranking",
			"View reports",
			"Export reports",
		],
	},
	{
		name: "petugas_lapangan" as const,
		description: "Petugas lapangan — menerima dan mengonfirmasi penugasan via WA / mobile.",
		permissions: ["View assigned incidents", "Update incident status"],
	},
];

export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, [...SYSTEM_ADMIN_ROLES]);

	const allUsers = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			role: users.role,
		})
		.from(users)
		.orderBy(users.name);

	const roles = roleDefinitions.map((role) => ({
		...role,
		users: allUsers.filter((u) => u.role === role.name),
		count: allUsers.filter((u) => u.role === role.name).length,
	}));

	return { roles };
};

export const actions: Actions = {
	changeRole: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...SYSTEM_ADMIN_ROLES]);
		if (denied) return denied;

		const formData = await request.formData();
		const userId = formData.get("userId");
		const newRole = formData.get("newRole");

		if (typeof userId !== "string") {
			return fail(400, { message: "User ID is required" });
		}
		if (typeof newRole !== "string" || !isRole(newRole)) {
			return fail(400, { message: "Invalid role" });
		}

		// Prevent demotion of last admin — lookup + count + update atomically
		let result: "ok" | "missing" | "lastAdmin";
		try {
			result = await db.transaction(async (tx) => {
				const [target] = await tx
					.select({ role: users.role })
					.from(users)
					.where(eq(users.id, userId));
				if (!target) return "missing" as const;
				if (target.role === "admin" && newRole !== "admin") {
					const [adminCount] = await tx
						.select({ count: countAll })
						.from(users)
						.where(eq(users.role, "admin"));
					if (adminCount.count <= 1) {
						return "lastAdmin" as const;
					}
				}
				await tx
					.update(users)
					.set({ role: newRole, updatedAt: new Date() })
					.where(eq(users.id, userId));
				return "ok" as const;
			});
		} catch {
			return fail(500, { message: "Role change failed" });
		}

		if (result === "missing") {
			return fail(404, { message: "User not found" });
		}
		if (result === "lastAdmin") {
			return fail(400, { message: "Cannot demote the last admin" });
		}

		return { success: true };
	},
};
