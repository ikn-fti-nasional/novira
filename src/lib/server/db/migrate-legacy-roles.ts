import { db } from "./index.js";
import { users, appSettings } from "./schema.js";
import { eq, and, inArray } from "drizzle-orm";
import type { Role } from "$lib/authorize.js";

/**
 * Legacy roles that existed before the current authorization model and their
 * approved replacements. `editor`/`viewer` map to `operator` (the system's
 * mid-level writer role); `admin_dlh` maps to `admin` (system administrator).
 */
const LEGACY_ROLE_MAP: Record<string, Role> = {
	admin_dlh: "admin",
	editor: "operator",
	viewer: "operator",
};

/**
 * Idempotent data migration: rewrites any users (and the registration
 * default) still holding a legacy role to its approved replacement so they
 * stay covered by EXECUTIVE_ROLES / OPERATIONAL_ROLES / SYSTEM_ADMIN_ROLES.
 *
 * Safe to re-run — once every legacy value is gone the UPDATEs match zero
 * rows. Call once at server boot before request handling.
 */
export async function migrateLegacyRoles(): Promise<number> {
	const legacyRoles = Object.keys(LEGACY_ROLE_MAP);
	let migrated = 0;

	for (const [legacy, target] of Object.entries(LEGACY_ROLE_MAP)) {
		const result = (await db
			.update(users)
			.set({ role: target as Role, updatedAt: new Date() })
			.where(eq(users.role, legacy as Role))) as unknown as { rowCount: number };
		migrated += result.rowCount ?? 0;
	}

	// Keep the registration default valid too.
	await db
		.update(appSettings)
		.set({ value: "operator", updatedAt: new Date() })
		.where(and(eq(appSettings.key, "defaultRole"), inArray(appSettings.value, legacyRoles)));

	return migrated;
}
