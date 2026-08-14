import { db } from "$lib/server/db/index.js";
import { users, sessions, pages, notifications, appSettings } from "$lib/server/db/schema.js";
import { requireRoleOrRedirect, SYSTEM_ADMIN_ROLES } from "$lib/authorize.js";
import { countAll } from "$lib/server/db/helpers.js";
import { sql } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, [...SYSTEM_ADMIN_ROLES]);

	// Get table row counts
	const [usersCount] = await db.select({ count: countAll }).from(users);
	const [sessionsCount] = await db.select({ count: countAll }).from(sessions);
	const [pagesCount] = await db.select({ count: countAll }).from(pages);
	const [notificationsCount] = await db.select({ count: countAll }).from(notifications);
	const [settingsCount] = await db.select({ count: countAll }).from(appSettings);

	// Get replication/WAL mode (Postgres equivalent of SQLite's journal_mode)
	const [walResult] = await db.execute<{ wal_level: string }>(sql`SHOW wal_level`);

	// Get DB size directly from Postgres — there's no local file to stat on Neon.
	// pg_database_size returns bigint; ::int would overflow past ~2 GB, so cast to
	// text and parse into a JS number.
	const [sizeResult] = await db.execute<{ size: string }>(
		sql`SELECT pg_database_size(current_database())::text AS size`
	);

	const tables = [
		{ name: "users", rows: usersCount.count },
		{ name: "sessions", rows: sessionsCount.count },
		{ name: "pages", rows: pagesCount.count },
		{ name: "notifications", rows: notificationsCount.count },
		{ name: "app_settings", rows: settingsCount.count },
	];

	return {
		dbSize: Number(sizeResult?.size ?? 0),
		walLevel: walResult?.wal_level ?? "unknown",
		tables,
		totalRows: tables.reduce((sum, t) => sum + t.rows, 0),
	};
};
