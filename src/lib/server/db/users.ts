import { db } from "./index.js";
import { users } from "./schema.js";
import { generateId } from "../id.js";
import type { Role } from "../authorize.js";

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
 */
export async function createUser(input: CreateUserInput): Promise<string> {
	const id = generateId(10);
	await db.insert(users).values({
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
