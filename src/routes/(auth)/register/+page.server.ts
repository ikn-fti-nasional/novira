import { generateSessionToken, createSession, setSessionCookie } from "$lib/server/auth.js";
import { db } from "$lib/server/db/index.js";
import { users } from "$lib/server/db/schema.js";
import { createUser } from "$lib/server/db/users.js";
import { hashPassword } from "$lib/server/password.js";
import { countAll } from "$lib/server/db/helpers.js";
import { sql } from "drizzle-orm";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, "/dashboard");
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const formData = await request.formData();
		const name = formData.get("name");
		const email = formData.get("email");
		const username = formData.get("username");
		const password = formData.get("password");

		if (typeof name !== "string" || name.length < 1 || name.length > 100) {
			return fail(400, { message: "Name is required (1-100 characters)" });
		}
		if (typeof email !== "string" || !email.includes("@") || email.length > 255) {
			return fail(400, { message: "Valid email is required" });
		}
		if (
			typeof username !== "string" ||
			username.length < 3 ||
			username.length > 31 ||
			!/^[a-z0-9_-]+$/.test(username)
		) {
			return fail(400, {
				message:
					"Username must be 3-31 characters, lowercase letters, numbers, hyphens, underscores",
			});
		}
		if (typeof password !== "string" || password.length < 6 || password.length > 255) {
			return fail(400, { message: "Password must be 6-255 characters" });
		}

		const passwordHash = await hashPassword(password);

		let userId: string;
		try {
			// Only the very first registered user becomes admin; everyone else is
			// an operator. Serialized with an advisory lock so two concurrent
			// first registrations can't both count zero and create two admins.
			userId = await db.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtext('novira_first_user_bootstrap'))`
				);
				const [existing] = await tx.select({ count: countAll }).from(users);
				return createUser(
					{
						name,
						email,
						username,
						passwordHash,
						role: existing.count === 0 ? "admin" : "operator",
					},
					tx
				);
			});
		} catch {
			return fail(400, { message: "Username or email already taken" });
		}

		const token = generateSessionToken();
		const ua = request.headers.get("user-agent");
		const ip = getClientAddress();
		const session = await createSession(token, userId, {
			userAgent: ua,
			ipAddress: ip,
		});
		setSessionCookie(cookies, token, session.expiresAt);

		redirect(302, "/dashboard");
	},
};
