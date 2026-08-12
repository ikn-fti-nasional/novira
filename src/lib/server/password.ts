import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id parameters used everywhere in the app for password hashing.
 *
 * These used to be hand-rolled at every call site (login, register, settings,
 * users, reset-password, lock, seed, tests), which made it trivial for a
 * tuning change to drift between paths. Centralized here so one edit re-tunes
 * every hashing/verification site.
 */
const ARGON2_CONFIG = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1,
};

/** Hash a plaintext password with the app-wide Argon2id parameters. */
export async function hashPassword(password: string): Promise<string> {
	return hash(password, ARGON2_CONFIG);
}

/** Verify a plaintext password against an Argon2id hash. */
export async function verifyPassword(
	passwordHash: string,
	password: string
): Promise<boolean> {
	return verify(passwordHash, password, ARGON2_CONFIG);
}
