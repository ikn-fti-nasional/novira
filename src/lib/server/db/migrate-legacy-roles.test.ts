import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb } from "$lib/server/db/test-utils.js";
import { users, appSettings } from "$lib/server/db/schema.js";
import { generateId } from "$lib/server/id.js";
import { eq } from "drizzle-orm";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return testDb;
	},
}));

const { migrateLegacyRoles } = await import("./migrate-legacy-roles.js");

function insertUser(username: string, role: string) {
	return testDb.insert(users).values({
		id: generateId(10),
		name: username,
		email: `${username}@test.com`,
		username,
		passwordHash: "x",
		role: role as never,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

describe("migrateLegacyRoles", () => {
	beforeEach(async () => {
		testDb = await createTestDb();
	});

	it("maps legacy roles to their approved replacements", async () => {
		await insertUser("legacy_admin", "admin_dlh");
		await insertUser("legacy_editor", "editor");
		await insertUser("legacy_viewer", "viewer");

		await migrateLegacyRoles();

		const rows = await testDb.select().from(users);
		const byName = Object.fromEntries(rows.map((r) => [r.username, r.role]));
		expect(byName.legacy_admin).toBe("admin");
		expect(byName.legacy_editor).toBe("operator");
		expect(byName.legacy_viewer).toBe("operator");
	});

	it("does not touch users with valid roles", async () => {
		await insertUser("normal", "operator");
		await insertUser("admin", "admin");

		await migrateLegacyRoles();

		const rows = await testDb.select().from(users);
		const byName = Object.fromEntries(rows.map((r) => [r.username, r.role]));
		expect(byName.normal).toBe("operator");
		expect(byName.admin).toBe("admin");
	});

	it("is idempotent across repeated runs", async () => {
		await insertUser("legacy", "viewer");

		await migrateLegacyRoles();
		await expect(migrateLegacyRoles()).resolves.toBe(0);

		const [row] = await testDb.select().from(users);
		expect(row.role).toBe("operator");
	});

	it("normalizes a legacy registration default role", async () => {
		await testDb.insert(appSettings).values({
			key: "defaultRole",
			value: "viewer",
			updatedAt: new Date(),
		});

		await migrateLegacyRoles();

		const [row] = await testDb.select().from(appSettings).where(eq(appSettings.key, "defaultRole"));
		expect(row.value).toBe("operator");
	});
});
