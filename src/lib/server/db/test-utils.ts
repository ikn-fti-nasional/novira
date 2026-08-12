import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema.js";
import { hashPassword } from "../password.js";
import { generateId } from "../id.js";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
	id text PRIMARY KEY NOT NULL,
	email text NOT NULL,
	username text NOT NULL,
	password_hash text NOT NULL,
	name text NOT NULL,
	avatar_url text,
	role text DEFAULT 'viewer' NOT NULL,
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username);

CREATE TABLE IF NOT EXISTS sessions (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL REFERENCES users(id),
	expires_at bigint NOT NULL,
	user_agent text,
	ip_address text,
	created_at timestamp
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL REFERENCES users(id),
	token_hash text NOT NULL,
	expires_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
	id text PRIMARY KEY NOT NULL,
	title text NOT NULL,
	slug text NOT NULL,
	content text DEFAULT '' NOT NULL,
	template text DEFAULT 'default' NOT NULL,
	status text DEFAULT 'draft' NOT NULL,
	author_id text NOT NULL REFERENCES users(id),
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL,
	published_at timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS pages_slug_unique ON pages (slug);

CREATE TABLE IF NOT EXISTS notifications (
	id text PRIMARY KEY NOT NULL,
	user_id text REFERENCES users(id),
	title text NOT NULL,
	message text NOT NULL,
	type text DEFAULT 'info' NOT NULL,
	read boolean DEFAULT false NOT NULL,
	created_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
	key text PRIMARY KEY NOT NULL,
	value text NOT NULL,
	updated_at timestamp NOT NULL
);
`;

export async function createTestDb() {
	const client = new PGlite();
	const db = drizzle(client, { schema });
	await client.exec(SCHEMA_SQL);
	return db;
}

export async function createTestUser(
	db: Awaited<ReturnType<typeof createTestDb>>,
	overrides: Partial<{
		id: string;
		name: string;
		email: string;
		username: string;
		role: "admin" | "editor" | "viewer";
	}> = {}
) {
	const id = overrides.id ?? generateId(10);
	const passwordHash = await hashPassword("password123");

	await db.insert(schema.users).values({
		id,
		name: overrides.name ?? "Test User",
		email: overrides.email ?? `${id}@test.com`,
		username: overrides.username ?? `user_${id.slice(0, 8)}`,
		passwordHash,
		role: overrides.role ?? "viewer",
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	return id;
}

export function createMockLocals(userId: string, role: string = "admin") {
	return {
		user: {
			id: userId,
			name: "Test User",
			email: "test@test.com",
			username: "testuser",
			role,
		},
		session: { id: "test-session", userId, expiresAt: Date.now() + 86400000 },
	};
}

export function createFormData(entries: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [key, value] of Object.entries(entries)) {
		fd.set(key, value);
	}
	return fd;
}

export function createMockRequest(formData: FormData): Request {
	return new Request("http://localhost", {
		method: "POST",
		body: formData,
	});
}
