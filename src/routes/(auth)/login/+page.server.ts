import { generateSessionToken, createSession, setSessionCookie } from "$lib/server/auth.js";
import { db } from "$lib/server/db/index.js";
import { users } from "$lib/server/db/schema.js";
import { verifyPassword } from "$lib/server/password.js";
import { EXECUTIVE_ROLES, hasRole } from "$lib/server/authorize.js";
import { fail, redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, "/");
	return {
		// Only surface pre-filled demo credentials when the public demo is on.
		demoMode: process.env.DEMO_MODE === "true",
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const formData = await request.formData();
		const username = formData.get("username");
		const password = formData.get("password");

		if (typeof username !== "string" || username.length < 3 || username.length > 31) {
			return fail(400, { message: "Invalid username (3-31 characters required)" });
		}
		if (typeof password !== "string" || password.length < 6 || password.length > 255) {
			return fail(400, { message: "Invalid password (6-255 characters required)" });
		}

		const existingUser = await db.query.users.findFirst({
			where: eq(users.username, username.toLowerCase()),
		});

		if (!existingUser) {
			return fail(400, { message: "Incorrect username or password" });
		}

		const validPassword = await verifyPassword(existingUser.passwordHash, password);

		if (!validPassword) {
			return fail(400, { message: "Incorrect username or password" });
		}

		const token = generateSessionToken();
		const ua = request.headers.get("user-agent");
		const ip = getClientAddress();
		const session = await createSession(token, existingUser.id, {
			userAgent: ua,
			ipAddress: ip,
		});
		setSessionCookie(cookies, token, session.expiresAt);

		if (hasRole(existingUser, EXECUTIVE_ROLES)) {
			redirect(302, "/eksekutif");
		}

		redirect(302, "/");
	},
};
