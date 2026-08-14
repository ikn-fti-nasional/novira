import { db } from "./index.js";
import { users } from "./schema.js";
import { generateId } from "../id.js";
import type { Role } from "$lib/authorize.js";

export interface CreateUserInput {
	name: string;
	email: string;
	username: string;
	/** Pre-hashed password (callers hash with hashPassword once and reuse). */
	passwordHash: string;
	role: Role;
	createdAt?: Date;
	updatedAt?: Date;
}

/**
 * Insert a user and return the new user's id. Email/username are normalized
 * to lowercase; the caller supplies a pre-hashed password so argon2 runs only
 * once per distinct password (seed hashes the shared default password once and
 * reuses it across all users).
 *
 * `client` defaults to the shared `db`; pass a transaction handle when the
 * insert must join an on-going transaction (e.g. first-user bootstrap).
 */
export async function createUser(
	input: CreateUserInput,
	client: { insert: typeof db.insert } = db
): Promise<string> {
	const id = generateId(10);
	await client.insert(users).values({
		id,
		name: input.name,
		email: input.email.toLowerCase(),
		username: input.username.toLowerCase(),
		passwordHash: input.passwordHash,
		role: input.role,
		createdAt: input.createdAt ?? new Date(),
		updatedAt: input.updatedAt ?? new Date(),
	});
	return id;
}
