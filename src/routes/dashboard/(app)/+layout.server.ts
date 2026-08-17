import { redirect, error } from "@sveltejs/kit";
import { db } from "$lib/server/db/index.js";
import { notifications, appSettings, incidents } from "$lib/server/db/schema.js";
import { unreadFilter, notDismissedBy } from "$lib/server/db/notification-visibility.js";
import { countAll } from "$lib/server/db/helpers.js";
import { EXECUTIVE_ROLES, PAGE_ACCESS, canAccessRole, hasRole } from "$lib/authorize.js";
import { eq, and, desc, inArray } from "drizzle-orm";
import type { LayoutServerLoad } from "./$types.js";

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(302, "/login");
	}

	// Read-only access guard for executive roles — derived from PAGE_ACCESS
	// (the single source of truth also used by the sidebar and per-page guards)
	// so this can never drift into under- or over-restricting a route.
	if (hasRole(locals.user, EXECUTIVE_ROLES)) {
		const matchedPath = Object.keys(PAGE_ACCESS)
			.filter((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))
			.sort((a, b) => b.length - a.length)[0];
		if (matchedPath && !canAccessRole(locals.user.role, matchedPath)) {
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

	const userUnreadFilter = unreadFilter(locals.user.id);
	const userNotDismissedFilter = notDismissedBy(locals.user.id);

	const [countResult] = await db
		.select({ count: countAll })
		.from(notifications)
		.where(and(userUnreadFilter, userNotDismissedFilter));

	const recentNotifications = await db
		.select({
			id: notifications.id,
			title: notifications.title,
			message: notifications.message,
			type: notifications.type,
			createdAt: notifications.createdAt,
		})
		.from(notifications)
		.where(and(userUnreadFilter, userNotDismissedFilter))
		.orderBy(desc(notifications.createdAt))
		.limit(5);

	const [incidentCountResult] = await db
		.select({ count: countAll })
		.from(incidents)
		.where(inArray(incidents.status, ["AKTIF", "PERINGATAN"]));

	return {
		user: locals.user,
		unreadNotificationCount: countResult?.count ?? 0,
		activeIncidentCount: incidentCountResult?.count ?? 0,
		recentNotifications,
	};
};
