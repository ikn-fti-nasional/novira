import { db } from "$lib/server/db/index.js";
import { notifications } from "$lib/server/db/schema.js";
import { visibleTo } from "$lib/server/db/notification-visibility.js";
import { fail, redirect } from "@sveltejs/kit";
import { eq, and, desc } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, "/login");

	const items = await db
		.select()
		.from(notifications)
		.where(visibleTo(locals.user.id))
		.orderBy(desc(notifications.createdAt))
		.limit(100);

	return { notifications: items };
};

export const actions: Actions = {
	markRead: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get("id");

		if (typeof id !== "string") {
			return fail(400, { message: "Notification ID is required" });
		}

		await db
			.update(notifications)
			.set({ read: true })
			.where(and(eq(notifications.id, id), visibleTo(locals.user!.id)));

		return { success: true };
	},

	markAllRead: async ({ locals }) => {
		await db
			.update(notifications)
			.set({ read: true })
			.where(and(eq(notifications.read, false), visibleTo(locals.user!.id)));

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get("id");

		if (typeof id !== "string") {
			return fail(400, { message: "Notification ID is required" });
		}

		await db.delete(notifications).where(and(eq(notifications.id, id), visibleTo(locals.user!.id)));

		return { success: true };
	},
};
