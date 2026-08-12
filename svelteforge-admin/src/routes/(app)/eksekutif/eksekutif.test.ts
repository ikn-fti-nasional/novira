import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, createTestUser, createMockLocals } from "$lib/server/db/test-utils.js";

let testDb: ReturnType<typeof createTestDb>;
let kepalaDinasId: string;

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return testDb;
	},
}));

const { load } = await import("./+page.server.js");

describe("Executive Dashboard (/eksekutif)", () => {
	beforeEach(async () => {
		testDb = createTestDb();
		kepalaDinasId = await createTestUser(testDb, {
			name: "Kepala Dinas LH",
			email: "kadinis@bandung.go.id",
			username: "kadinis",
			role: "kepala_dinas",
		});
	});

	it("returns executive KPI stats and leaderboard data", async () => {
		const result: any = await load({
			locals: createMockLocals(kepalaDinasId, "kepala_dinas"),
		} as any);

		expect(result).toHaveProperty("kpi");
		expect(result).toHaveProperty("leaderboard");
		expect(result).toHaveProperty("trenMingguan");
		expect(result).toHaveProperty("trenBulanan");

		expect(result.kpi.skorRataRata).toBe(83.4);
		expect(result.leaderboard.length).toBeGreaterThan(0);
		expect(result.trenMingguan.length).toBe(7);
	});
});
