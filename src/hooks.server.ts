import {
	validateSession,
	setSessionCookie,
	deleteSessionCookie,
	SESSION_COOKIE_NAME,
} from "$lib/server/auth.js";
import { db } from "$lib/server/db/index.js";
import { sessions } from "$lib/server/db/schema.js";
import { migrateLegacyRoles } from "$lib/server/db/migrate-legacy-roles.js";
import { startDetectionScheduler } from "$lib/server/novira/scheduler.js";
import { eq } from "drizzle-orm";
import type { Handle } from "@sveltejs/kit";

// Data migration for legacy roles (viewer/editor/admin_dlh) that may still
// exist in production databases. Idempotent and cheap-to-no-op; runs once per
// process start so no user falls outside the new authorization groups.
await migrateLegacyRoles();

// Twice-daily Bandung CCTV detection cron (12:00 & 15:00 WIB) — see
// $lib/server/novira/deteksi.ts. Runs in-process (adapter-node is a
// long-lived Node process, not serverless) so no external cron/systemd unit
// is required.
startDetectionScheduler();

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE_NAME);
	if (!token) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	try {
		const { session, user } = await validateSession(token);

		if (session) {
			// Refresh cookie with current expiresAt (handles auto-extension)
			setSessionCookie(event.cookies, token, session.expiresAt);

			// Update session metadata only when it actually changed, to avoid a
			// DB write on every single request from a returning user.
			const ua = event.request.headers.get("user-agent") ?? null;
			const ip = event.getClientAddress();
			if (ua !== session.userAgent || ip !== session.ipAddress) {
				await db
					.update(sessions)
					.set({ userAgent: ua, ipAddress: ip })
					.where(eq(sessions.id, session.id));
			}
		} else {
			deleteSessionCookie(event.cookies);
		}

		event.locals.user = user;
		event.locals.session = session;
	} catch {
		// Unexpected error (e.g. DB hiccup) — treat as unauthenticated for this
		// request but keep the cookie so the user isn't logged out on a transient
		// failure. Expired/corrupt sessions are cleaned up inside validateSession.
		event.locals.user = null;
		event.locals.session = null;
	}

	return resolve(event);
};
