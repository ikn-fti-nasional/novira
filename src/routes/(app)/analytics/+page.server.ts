import { db } from "$lib/server/db/index.js";
import { users, pages, notifications } from "$lib/server/db/schema.js";
import { countAll } from "$lib/server/db/helpers.js";
import { sql, eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
	// User signups per month
	const signupsPerMonth = await db
		.select({
			month: sql<string>`to_char(created_at, 'YYYY-MM-01')`,
			count: countAll,
		})
		.from(users)
		.groupBy(sql`to_char(created_at, 'YYYY-MM-01')`)
		.orderBy(sql`to_char(created_at, 'YYYY-MM-01')`);

	// Content creation per month
	const pagesPerMonth = await db
		.select({
			month: sql<string>`to_char(created_at, 'YYYY-MM-01')`,
			count: countAll,
		})
		.from(pages)
		.groupBy(sql`to_char(created_at, 'YYYY-MM-01')`)
		.orderBy(sql`to_char(created_at, 'YYYY-MM-01')`);

	// Pages by status
	const pagesByStatus = await db
		.select({
			status: pages.status,
			count: countAll,
		})
		.from(pages)
		.groupBy(pages.status);

	// Notifications by type
	const notificationsByType = await db
		.select({
			type: notifications.type,
			count: countAll,
		})
		.from(notifications)
		.groupBy(notifications.type);

	// Top authors by page count
	const topAuthors = await db
		.select({
			name: users.name,
			pageCount: sql<number>`count(${pages.id})::int`,
		})
		.from(pages)
		.innerJoin(users, eq(pages.authorId, users.id))
		.groupBy(users.id)
		.orderBy(sql`count(${pages.id}) desc`)
		.limit(5);

	return {
		signupsPerMonth,
		pagesPerMonth,
		pagesByStatus,
		notificationsByType,
		topAuthors,
	};
};
