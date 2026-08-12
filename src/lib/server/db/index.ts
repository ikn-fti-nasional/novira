import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

// tsx (e.g. `pnpm db:seed`) does not auto-load .env the way drizzle-kit or
// SvelteKit do, so load it here when DATABASE_URL is absent.
if (!process.env.DATABASE_URL) {
	try {
		process.loadEnvFile();
	} catch {
		// No .env file present — rely on the real environment.
	}
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL is not set. Point it at your Postgres/Neon connection string.");
}

const client = postgres(connectionString);

export const db = drizzle(client, { schema });
