import { db } from "$lib/server/db/index.js";
import { notifications, notificationReads } from "$lib/server/db/schema.js";
import { visibleTo, notDismissedBy } from "$lib/server/db/notification-visibility.js";
import { fail, redirect } from "@sveltejs/kit";
import { eq, and, isNull, desc } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, "/login");
	const userId = locals.user.id;

	const items = await db
		.select({
			id: notifications.id,
			userId: notifications.userId,
			title: notifications.title,
			message: notifications.message,
			type: notifications.type,
			createdAt: notifications.createdAt,
			// Global notifications (userId NULL) carry no per-user read column;
			// merge their per-user state from notification_reads.
			read: notifications.read,
			userRead: notificationReads.read,
		})
		.from(notifications)
		.leftJoin(
			notificationReads,
			and(
				eq(notificationReads.notificationId, notifications.id),
				eq(notificationReads.userId, userId)
			)
		)
		.where(and(visibleTo(userId), notDismissedBy(userId)))
		.orderBy(desc(notifications.createdAt))
		.limit(100);

	const result = items.map((n) => ({
		id: n.id,
		userId: n.userId,
		title: n.title,
		message: n.message,
		type: n.type,
		createdAt: n.createdAt,
		read: n.userId === null ? (n.userRead ?? false) : n.read,
	}));

	return { notifications: result };
};

export const actions: Actions = {
	markRead: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");
		const userId = locals.user.id;
		const formData = await request.formData();
		const id = formData.get("id");

		if (typeof id !== "string") {
			return fail(400, { message: "Notification ID is required" });
		}

		const [target] = await db
			.select({ userId: notifications.userId })
			.from(notifications)
			.where(eq(notifications.id, id))
			.limit(1);

		if (!target) return fail(404, { message: "Notification not found" });

		if (target.userId === null) {
			// Global notification: record this user's read state without
			// touching the shared row.
			await db
				.insert(notificationReads)
				.values({ notificationId: id, userId, read: true })
				.onConflictDoUpdate({
					target: [notificationReads.notificationId, notificationReads.userId],
					set: { read: true },
				});
		} else if (target.userId === userId) {
			await db
				.update(notifications)
				.set({ read: true })
				.where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
		}

		return { success: true };
	},

	markAllRead: async ({ locals }) => {
		if (!locals.user) redirect(302, "/login");
		const userId = locals.user.id;

		await db
			.update(notifications)
			.set({ read: true })
			.where(and(eq(notifications.read, false), eq(notifications.userId, userId)));

		// Mark every visible global notification as read for this user.
		const globals = await db
			.select({ id: notifications.id })
			.from(notifications)
			.where(and(isNull(notifications.userId), notDismissedBy(userId)));

		if (globals.length > 0) {
			await db
				.insert(notificationReads)
				.values(globals.map((g) => ({ notificationId: g.id, userId, read: true })))
				.onConflictDoNothing();
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");
		const userId = locals.user.id;
		const formData = await request.formData();
		const id = formData.get("id");

		if (typeof id !== "string") {
			return fail(400, { message: "Notification ID is required" });
		}

		const [target] = await db
			.select({ userId: notifications.userId })
			.from(notifications)
			.where(eq(notifications.id, id))
			.limit(1);

		if (!target) return fail(404, { message: "Notification not found" });

		if (target.userId === null) {
			// Global notification: dismiss it for this user only.
			await db
				.insert(notificationReads)
				.values({ notificationId: id, userId, dismissed: true })
				.onConflictDoUpdate({
					target: [notificationReads.notificationId, notificationReads.userId],
					set: { dismissed: true },
				});
		} else if (target.userId === userId) {
			await db
				.delete(notifications)
				.where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
		}

		return { success: true };
	},
};