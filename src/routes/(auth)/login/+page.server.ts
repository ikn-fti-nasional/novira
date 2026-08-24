import { generateSessionToken, createSession, setSessionCookie } from "$lib/server/auth.js";
import { db } from "$lib/server/db/index.js";
import { users } from "$lib/server/db/schema.js";
import { verifyPassword } from "$lib/server/password.js";
import { EXECUTIVE_ROLES, hasRole } from "$lib/authorize.js";
import { dev } from "$app/environment";
import { fail, redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

// Throttle brute force per kombinasi IP+username. ponytail: in-memory berarti
// batasnya per-instance dan hilang saat restart — cukup untuk deployment
// single-instance; pindah ke tabel DB/Redis saat scale-out multi-instance.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failedLogins = new Map<string, { count: number; at: number }>();

function catatGagalLogin(key: string): void {
	const now = Date.now();
	const entry = failedLogins.get(key);
	if (!entry || now - entry.at > WINDOW_MS) {
		failedLogins.set(key, { count: 1, at: now });
	} else {
		entry.count++;
		entry.at = now;
	}
	// Map tak dibersihkan bisa tumbuh tanpa batas — buang entri basi saat besar.
	if (failedLogins.size > 5000) {
		for (const [k, v] of failedLogins) if (now - v.at > WINDOW_MS) failedLogins.delete(k);
		// Safety cap: kalau masih >5000 setelah cleanup (flood IP unik),
		// potong oldest untuk mencegah OOM.
		if (failedLogins.size > 5000) {
			const toDelete = failedLogins.size - 5000;
			let i = 0;
			for (const k of failedLogins.keys()) {
				if (i++ >= toDelete) break;
				failedLogins.delete(k);
			}
		}
	}
}

function loginTerblokir(key: string): boolean {
	const entry = failedLogins.get(key);
	return !!entry && entry.count >= MAX_ATTEMPTS && Date.now() - entry.at <= WINDOW_MS;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		redirect(302, hasRole(locals.user, EXECUTIVE_ROLES) ? "/dashboard/eksekutif" : "/dashboard");
	}
	return {
		// Only surface pre-filled demo credentials when the public demo is on —
		// or in local dev, where the seeded accounts are the only ones that exist
		// and hiding them just slows everyone down.
		demoMode: process.env.DEMO_MODE === "true" || dev,
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

		const throttleKey = `${getClientAddress()}:${username.toLowerCase()}`;
		if (loginTerblokir(throttleKey)) {
			return fail(429, {
				message: "Terlalu banyak percobaan gagal — coba lagi dalam 15 menit.",
			});
		}

		const existingUser = await db.query.users.findFirst({
			where: eq(users.username, username.toLowerCase()),
		});

		if (!existingUser) {
			catatGagalLogin(throttleKey);
			return fail(400, { message: "Incorrect username or password" });
		}

		const validPassword = await verifyPassword(existingUser.passwordHash, password);

		if (!validPassword) {
			catatGagalLogin(throttleKey);
			return fail(400, { message: "Incorrect username or password" });
		}

		// Sukses: reset counter supaya percobaan lama tidak menghukum login berikutnya.
		failedLogins.delete(throttleKey);

		const token = generateSessionToken();
		const ua = request.headers.get("user-agent");
		const ip = getClientAddress();
		const session = await createSession(token, existingUser.id, {
			userAgent: ua,
			ipAddress: ip,
		});
		setSessionCookie(cookies, token, session.expiresAt);

		if (hasRole(existingUser, EXECUTIVE_ROLES)) {
			redirect(302, "/dashboard/eksekutif");
		}

		redirect(302, "/dashboard");
	},
};
