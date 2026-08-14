import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, createTestUser, createMockLocals } from "$lib/server/db/test-utils.js";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return testDb;
	},
}));

const { load } = await import("./+page.server.js");

describe("Camera Monitoring (/cameras)", () => {
	beforeEach(async () => {
		testDb = await createTestDb();
		userId = await createTestUser(testDb, {
			name: "Operator",
			email: "operator@test.com",
			username: "operator",
			role: "operator",
		});
	});

	it("allows operational roles and returns camera list", async () => {
		const result: any = await load({
			locals: createMockLocals(userId, "operator"),
		} as any);

		expect(result).toHaveProperty("kameraList");
		expect(result.kameraList).toBeInstanceOf(Array);
	});

	it("denies access to field officers", async () => {
		const petugasId = await createTestUser(testDb, {
			name: "Petugas",
			email: "petugas@test.com",
			username: "petugas_guard",
			role: "petugas_lapangan",
		});

		await expect(
			load({
				locals: createMockLocals(petugasId, "petugas_lapangan"),
			} as any)
		).rejects.toMatchObject({ status: 403 });
	});
});
