import { db } from "$lib/server/db/index.js";
import {
	users,
	sessions,
	notifications,
	pages,
	passwordResetTokens,
} from "$lib/server/db/schema.js";
import { createUser } from "$lib/server/db/users.js";
import { fail } from "@sveltejs/kit";
import { hashPassword } from "$lib/server/password.js";
import {
	requireRoleOrRedirect,
	requireRoleOrFail,
	isRole,
	SYSTEM_ADMIN_ROLES,
} from "$lib/authorize.js";
import { countAll } from "$lib/server/db/helpers.js";
import { eq, inArray } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

/**
 * Delete a user and everything that references them. Postgres enforces FKs
 * (unlike the old SQLite setup), so child rows must be removed first or the
 * delete fails. Pages are authored by the user and author_id is NOT NULL, so
 * the user's pages are deleted too. Runs in one transaction so a failure
 * can't leave half-deleted users behind.
 */
async function deleteUserRows(ids: string[], tx: Pick<typeof db, "delete"> = db) {
	if (ids.length === 0) return;
	await tx.delete(passwordResetTokens).where(inArray(passwordResetTokens.userId, ids));
	await tx.delete(sessions).where(inArray(sessions.userId, ids));
	await tx.delete(notifications).where(inArray(notifications.userId, ids));
	await tx.delete(pages).where(inArray(pages.authorId, ids));
	await tx.delete(users).where(inArray(users.id, ids));
}

export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, [...SYSTEM_ADMIN_ROLES]);

	const allUsers = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			username: users.username,
			role: users.role,
			createdAt: users.createdAt,
		})
		.from(users)
		.orderBy(users.createdAt);

	return { users: allUsers, currentUserId: locals.user.id };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...SYSTEM_ADMIN_ROLES]);
		if (denied) return denied;
		const formData = await request.formData();
		const name = formData.get("name");
		const email = formData.get("email");
		const username = formData.get("username");
		const password = formData.get("password");
		const role = formData.get("role");

		if (typeof name !== "string" || name.length < 1 || name.length > 100) {
			return fail(400, { message: "Name is required (1-100 characters)" });
		}
		if (typeof email !== "string" || !email.includes("@") || email.length > 255) {
			return fail(400, { message: "Valid email is required" });
		}
		if (
			typeof username !== "string" ||
			username.length < 3 ||
			username.length > 31 ||
			!/^[a-z0-9_-]+$/.test(username)
		) {
			return fail(400, {
				message:
					"Username must be 3-31 characters, lowercase letters, numbers, hyphens, underscores",
			});
		}
		if (typeof password !== "string" || password.length < 6 || password.length > 255) {
			return fail(400, { message: "Password must be 6-255 characters" });
		}
		if (typeof role !== "string" || !isRole(role)) {
			return fail(400, { message: "Invalid role" });
		}

		const passwordHash = await hashPassword(password);

		try {
			await createUser({
				name,
				email,
				username,
				passwordHash,
				role,
			});
		} catch {
			return fail(400, { message: "Username or email already taken" });
		}

		return { success: true };
	},

	update: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...SYSTEM_ADMIN_ROLES]);
		if (denied) return denied;
		const formData = await request.formData();
		const id = formData.get("id");
		const name = formData.get("name");
		const email = formData.get("email");
		const role = formData.get("role");

		if (typeof id !== "string") {
			return fail(400, { message: "User ID is required" });
		}
		if (typeof name !== "string" || name.length < 1 || name.length > 100) {
			return fail(400, { message: "Name is required (1-100 characters)" });
		}
		if (typeof email !== "string" || !email.includes("@") || email.length > 255) {
			return fail(400, { message: "Valid email is required" });
		}
		if (typeof role !== "string" || !isRole(role)) {
			return fail(400, { message: "Invalid role" });
		}

		// Prevent demotion of last admin — lookup + count + update atomically
		let result: "ok" | "missing" | "lastAdmin";
		try {
			result = await db.transaction(async (tx) => {
				const [existing] = await tx
					.select({ role: users.role })
					.from(users)
					.where(eq(users.id, id));
				if (!existing) return "missing" as const;
				if (existing.role === "admin" && role !== "admin") {
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
					.set({
						name,
						email: email.toLowerCase(),
						role,
						updatedAt: new Date(),
					})
					.where(eq(users.id, id));
				return "ok" as const;
			});
		} catch {
			return fail(400, { message: "Email already taken" });
		}

		if (result === "missing") {
			return fail(404, { message: "User not found" });
		}
		if (result === "lastAdmin") {
			return fail(400, { message: "Cannot demote the last admin" });
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...SYSTEM_ADMIN_ROLES]);
		if (denied) return denied;
		const formData = await request.formData();
		const id = formData.get("id");

		if (typeof id !== "string") {
			return fail(400, { message: "User ID is required" });
		}

		// Prevent self-deletion
		if (id === locals.user?.id) {
			return fail(400, { message: "You cannot delete your own account" });
		}

		// Prevent deletion of last admin — lookup + count + delete atomically
		let result: "ok" | "missing" | "lastAdmin";
		try {
			result = await db.transaction(async (tx) => {
				const [target] = await tx.select({ role: users.role }).from(users).where(eq(users.id, id));
				if (!target) return "missing" as const;
				if (target.role === "admin") {
					const [adminCount] = await tx
						.select({ count: countAll })
						.from(users)
						.where(eq(users.role, "admin"));
					if (adminCount.count <= 1) {
						return "lastAdmin" as const;
					}
				}
				await deleteUserRows([id], tx);
				return "ok" as const;
			});
		} catch {
			return fail(500, { message: "Delete failed" });
		}

		if (result === "missing") {
			return fail(404, { message: "User not found" });
		}
		if (result === "lastAdmin") {
			return fail(400, { message: "Cannot delete the last admin" });
		}

		return { success: true };
	},

	bulkDelete: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...SYSTEM_ADMIN_ROLES]);
		if (denied) return denied;
		const formData = await request.formData();
		const idsRaw = formData.get("ids");

		if (typeof idsRaw !== "string" || !idsRaw.trim()) {
			return fail(400, { message: "No users selected" });
		}

		const ids = idsRaw.split(",").filter(Boolean);
		// Cap the list so a crafted submission can't build a huge IN query.
		if (ids.length > 100) {
			return fail(400, { message: "Too many users selected (max 100)" });
		}
		const currentUserId = locals.user?.id;

		// Filter out self
		const toDelete = ids.filter((id) => id !== currentUserId);
		if (toDelete.length === 0) {
			return fail(400, { message: "You cannot delete your own account" });
		}

		// Check if any targets are the last admin — count + delete atomically
		let result: "ok" | "lastAdmin";
		try {
			result = await db.transaction(async (tx) => {
				const admins = await tx.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
				const remainingAdmins = admins.filter((a) => !toDelete.includes(a.id));
				if (remainingAdmins.length === 0) {
					return "lastAdmin" as const;
				}
				await deleteUserRows(toDelete, tx);
				return "ok" as const;
			});
		} catch {
			return fail(500, { message: "Delete failed" });
		}

		if (result === "lastAdmin") {
			return fail(400, { message: "Cannot delete all admin users" });
		}

		return { success: true };
	},
};
