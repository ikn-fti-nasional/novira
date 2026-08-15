import { and, or, eq, isNull, sql, type SQL } from "drizzle-orm";
import { notifications } from "./schema.js";

/**
 * Visibility condition for notification queries: a user sees both their
 * per-user notifications and the global ones (`userId = NULL`). This is the
 * canonical filter documented in CLAUDE.md — kept in one place so the policy
 * can't drift between layout, the notifications page, search, and the
 * dashboard badge.
 */
export function visibleTo(userId: string): SQL | undefined {
	return or(eq(notifications.userId, userId), isNull(notifications.userId));
}

/**
 * Excludes global notifications the user has dismissed (deleted). User-owned
 * rows are always visible; a dismissed global row only disappears for the
 * dismissing user via `notification_reads`.
 */
export function notDismissedBy(userId: string): SQL {
	return (
		or(
			sql`${notifications.userId} IS NOT NULL`,
			sql`NOT EXISTS (
			SELECT 1 FROM notification_reads
			WHERE notification_id = ${notifications.id}
				AND user_id = ${userId}
				AND dismissed = true
		)`
		) ?? sql`1 = 1`
	);
}

/**
 * Unread condition scoped to one user: their own unread rows plus global
 * rows the user hasn't read or dismissed yet. Global read/dismissed state
 * lives in `notification_reads` (the shared row is never mutated).
 */
export function unreadFilter(userId: string): SQL {
	return (
		or(
			and(eq(notifications.userId, userId), eq(notifications.read, false)),
			and(
				isNull(notifications.userId),
				sql`NOT EXISTS (
				SELECT 1 FROM notification_reads
				WHERE notification_id = ${notifications.id}
					AND user_id = ${userId}
					AND (read = true OR dismissed = true)
			)`
			)
		) ?? sql`1 = 1`
	);
}