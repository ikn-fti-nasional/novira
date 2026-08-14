import { json, error } from "@sveltejs/kit";
import { db } from "$lib/server/db/index.js";
import { users, pages, notifications } from "$lib/server/db/schema.js";
import { visibleTo } from "$lib/server/db/notification-visibility.js";
import { sql, or, and } from "drizzle-orm";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		error(401, "Unauthorized");
	}

	const q = url.searchParams.get("q")?.trim() ?? "";
	if (q.length < 2) {
		return json([]);
	}

	// Escape LIKE wildcards (% _ \) so the query matches literally.
	const escaped = q.replace(/[\\%_]/g, "\\$&");
	const pattern = `%${escaped}%`;

	// User search returns emails — restrict it to admins.
	const userSearch =
		locals.user.role === "admin"
			? db
					.select({ id: users.id, name: users.name, email: users.email })
					.from(users)
					.where(or(sql`${users.name} ILIKE ${pattern}`, sql`${users.email} ILIKE ${pattern}`))
					.limit(5)
			: Promise.resolve([]);

	const [userResults, pageResults, notificationResults] = await Promise.all([
		userSearch,
		db
			.select({ id: pages.id, title: pages.title, slug: pages.slug })
			.from(pages)
			.where(sql`${pages.title} ILIKE ${pattern}`)
			.limit(5),
		db
			.select({ id: notifications.id, title: notifications.title, message: notifications.message })
			.from(notifications)
			.where(and(sql`${notifications.title} ILIKE ${pattern}`, visibleTo(locals.user.id)))
			.limit(5),
	]);

	const results = [
		...userResults.map((u) => ({
			type: "user" as const,
			id: u.id,
			title: u.name,
			subtitle: u.email,
			href: "/dashboard/users",
		})),
		...pageResults.map((p) => ({
			type: "page" as const,
			id: p.id,
			title: p.title,
			subtitle: `/${p.slug}`,
			href: `/dashboard/content/${p.id}/edit`,
		})),
		...notificationResults.map((n) => ({
			type: "notification" as const,
			id: n.id,
			title: n.title,
			subtitle: n.message.slice(0, 50),
			href: "/dashboard/notifications",
		})),
	];

	return json(results);
};
