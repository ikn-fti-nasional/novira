import { error, fail, redirect } from "@sveltejs/kit";
import type { ActionFailure } from "@sveltejs/kit";
import type { SessionUser } from "$lib/server/auth.js";

export type Role =
	| "admin"
	| "operator"
	| "kepala_seksi"
	| "kepala_dinas"
	| "walikota"
	| "petugas_lapangan";

export const ALL_ROLES: readonly Role[] = [
	"admin",
	"operator",
	"kepala_seksi",
	"kepala_dinas",
	"walikota",
	"petugas_lapangan",
];

export function isRole(value: string): value is Role {
	return (ALL_ROLES as readonly string[]).includes(value);
}

/** Roles whose default landing page after login is the executive dashboard. */
export const EXECUTIVE_ROLES: readonly Role[] = ["kepala_dinas", "walikota"];

/** Roles that can access the operational command pages (not just read reports). */
export const OPERATIONAL_ROLES: readonly Role[] = ["admin", "operator", "kepala_seksi"];

/** Roles that can access system administration (users, roles, settings, database). */
export const SYSTEM_ADMIN_ROLES: readonly Role[] = ["admin"];

/**
 * Single source of truth for "who may see which page" — consumed by the
 * sidebar, apps menu, command palette, and the server-side route guards, so
 * the visible navigation can never drift from what the guards enforce.
 */
export const PAGE_ACCESS: Record<string, readonly Role[]> = {
	"/": ALL_ROLES,
	"/eksekutif": ["admin", "kepala_dinas", "walikota"],
	"/monitoring": ALL_ROLES,
	"/incidents": ALL_ROLES,
	"/hotspots": ALL_ROLES,
	"/analytics": ["admin", "operator", "kepala_seksi", "kepala_dinas", "walikota"],
	"/cameras": OPERATIONAL_ROLES,
	"/officers": OPERATIONAL_ROLES,
	"/area-ranking": ALL_ROLES,
	"/laporan-wilayah": ["admin", "operator", "kepala_seksi", "kepala_dinas", "walikota"],
	"/audit": SYSTEM_ADMIN_ROLES,
	"/notifications": ALL_ROLES,
	"/settings": ALL_ROLES,
	"/users": SYSTEM_ADMIN_ROLES,
	"/roles": SYSTEM_ADMIN_ROLES,
	"/database": SYSTEM_ADMIN_ROLES,
	"/content": OPERATIONAL_ROLES,
};

/** Pure predicate — may `role` open `path`? */
export function canAccessRole(role: string, path: string): boolean {
	const allowed = PAGE_ACCESS[path];
	return !!allowed && (allowed as readonly string[]).includes(role);
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Admin access required" / "Admin or editor access required". */
function accessMessage(roles: readonly Role[]): string {
	return `${roles.map(capitalize).join(" or ")} access required`;
}

/**
 * Pure predicate — does the user hold any of the allowed roles?
 * The "who may do what" policy lives here and nowhere else; route guards just
 * call this and decide how to respond.
 */
export function hasRole(user: SessionUser | null | undefined, roles: readonly Role[]): boolean {
	return !!user && roles.includes(user.role);
}

/**
 * Guard for load functions (throw contexts).
 *
 * - unauthenticated → redirect(302, "/login")
 * - wrong role      → error(403)
 *
 * Both redirect() and error() throw, so the load is aborted. The assertion
 * signature narrows the user to non-null afterward, so callers can use
 * `locals.user` without a non-null assertion.
 */
export function requireRoleOrRedirect(
	user: SessionUser | null | undefined,
	roles: readonly Role[]
): asserts user is SessionUser {
	if (!user) {
		redirect(302, "/login");
	}
	if (!hasRole(user, roles)) {
		error(403, accessMessage(roles));
	}
}

/**
 * Guard for form actions. Returns a 403 `fail()` object — which keeps the user
 * on the same page with an in-form error, never a full page navigation — when
 * the user lacks the required role, or `null` when allowed. Callers
 * short-circuit:
 *
 *     const denied = requireRoleOrFail(locals.user, ["admin"]);
 *     if (denied) return denied;
 */
export function requireRoleOrFail(
	user: SessionUser | null | undefined,
	roles: readonly Role[]
): ActionFailure<{ message: string }> | null {
	if (!hasRole(user, roles)) {
		return fail(403, { message: accessMessage(roles) });
	}
	return null;
}
