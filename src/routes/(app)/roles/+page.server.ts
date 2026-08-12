import { db } from "$lib/server/db/index.js";
import { users } from "$lib/server/db/schema.js";
import { requireRoleOrRedirect, requireRoleOrFail, type Role } from "$lib/server/authorize.js";
import { countAll } from "$lib/server/db/helpers.js";
import { fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

const VALID_ROLES: readonly Role[] = [
	"admin",
	"admin_dlh",
	"kepala_dinas",
	"walikota",
	"petugas_lapangan",
	"editor",
	"viewer",
];

function isRole(value: string): value is Role {
	return VALID_ROLES.includes(value as Role);
}

const roleDefinitions = [
	{
		name: "admin" as const,
		description: "Full system access. Can manage users, content, settings, and view database info.",
		permissions: [
			"Manage users",
			"Manage content",
			"Manage settings",
			"View database",
			"Manage roles",
		],
	},
	{
		name: "admin_dlh" as const,
		description: "Super admin lingkungan hidup nasional. Akses penuh operasional dan tata kelola.",
		permissions: [
			"Manage cameras",
			"Manage officers",
			"Manage incidents",
			"Manage settings",
			"View analytics",
		],
	},
	{
		name: "kepala_dinas" as const,
		description: "Kepala Dinas Lingkungan Hidup — dashboard eksekutif read-only.",
		permissions: [
			"View executive dashboard",
			"View area ranking",
			"View analytics",
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
			"View analytics",
			"View reports",
			"Export reports",
		],
	},
	{
		name: "petugas_lapangan" as const,
		description: "Petugas lapangan — memantau penugasan dan insiden di wilayahnya.",
		permissions: ["View assigned incidents", "View cameras", "Update incident status"],
	},
	{
		name: "editor" as const,
		description: "Can create and edit content. Cannot manage users or system settings.",
		permissions: ["Create content", "Edit content", "Delete own content", "View analytics"],
	},
	{
		name: "viewer" as const,
		description: "Read-only access. Can view content and their own profile.",
		permissions: ["View content", "View dashboard", "Edit own profile"],
	},
];

export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, ["admin"]);

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
		const denied = requireRoleOrFail(locals.user, ["admin"]);
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

		// Prevent demotion of last admin
		const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
		if (target?.role === "admin" && newRole !== "admin") {
			const [adminCount] = await db
				.select({ count: countAll })
				.from(users)
				.where(eq(users.role, "admin"));
			if (adminCount.count <= 1) {
				return fail(400, { message: "Cannot demote the last admin" });
			}
		}

		await db
			.update(users)
			.set({ role: newRole, updatedAt: new Date() })
			.where(eq(users.id, userId));

		return { success: true };
	},
};
