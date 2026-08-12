import { or, eq, isNull, type SQL } from "drizzle-orm";
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
