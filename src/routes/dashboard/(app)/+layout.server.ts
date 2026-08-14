import { redirect, error } from "@sveltejs/kit";
import { db } from "$lib/server/db/index.js";
import { notifications, appSettings } from "$lib/server/db/schema.js";
import { visibleTo } from "$lib/server/db/notification-visibility.js";
import { countAll } from "$lib/server/db/helpers.js";
import { EXECUTIVE_ROLES, hasRole } from "$lib/authorize.js";
import { eq, and, desc } from "drizzle-orm";
import type { LayoutServerLoad } from "./$types.js";

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(302, "/login");
	}

	// Read-only access guard for executive roles
	if (hasRole(locals.user, EXECUTIVE_ROLES)) {
		const restrictedPaths = [
			"/dashboard/cameras",
			"/dashboard/users",
			"/dashboard/settings",
			"/dashboard/roles",
			"/dashboard/database",
			"/dashboard/monitoring",
			"/dashboard/incidents",
		];
		if (restrictedPaths.some((path) => url.pathname.startsWith(path))) {
			redirect(302, "/dashboard/eksekutif");
		}
	}

	// Check maintenance mode
	const maintenanceSetting = await db.query.appSettings.findFirst({
		where: eq(appSettings.key, "maintenanceMode"),
	});
	if (maintenanceSetting?.value === "true" && locals.user.role !== "admin") {
		error(503, "The application is currently under maintenance. Please check back later.");
	}

	const userNotificationFilter = visibleTo(locals.user.id);

	const [countResult] = await db
		.select({ count: countAll })
		.from(notifications)
		.where(and(eq(notifications.read, false), userNotificationFilter));

	const recentNotifications = await db
		.select({
			id: notifications.id,
			title: notifications.title,
			message: notifications.message,
			type: notifications.type,
			createdAt: notifications.createdAt,
		})
		.from(notifications)
		.where(and(eq(notifications.read, false), userNotificationFilter))
		.orderBy(desc(notifications.createdAt))
		.limit(5);

	return {
		user: locals.user,
		unreadNotificationCount: countResult?.count ?? 0,
		recentNotifications,
	};
};
