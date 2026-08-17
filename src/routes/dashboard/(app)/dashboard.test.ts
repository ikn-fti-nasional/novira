import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, createTestUser, createMockLocals } from "$lib/server/db/test-utils.js";
import { notifications, appSettings } from "$lib/server/db/schema.js";
import { generateId } from "$lib/server/id.js";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let adminId: string;

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return testDb;
	},
}));

const { load } = await import("./+page.server.js");

describe("Dashboard page", () => {
	beforeEach(async () => {
		testDb = await createTestDb();
		adminId = await createTestUser(testDb, {
			name: "Admin",
			email: "admin@test.com",
			username: "admin",
			role: "admin",
		});
	});

	it("returns kpi with correct shape", async () => {
		const result: any = await load({
			locals: createMockLocals(adminId),
		} as any);

		expect(result.kpi).toHaveProperty("insidenAktif");
		expect(result.kpi).toHaveProperty("cctvOnline");
		expect(result.kpi).toHaveProperty("totalCctv");
		expect(result.kpi).toHaveProperty("persentaseUptimeCctv");
		expect(result.kpi).toHaveProperty("insidenBaruHariIni");
		expect(result.kpi).toHaveProperty("insidenSelesaiHariIni");
		expect(result.kpi).toHaveProperty("titikPantauTerdampak");
		expect(result.kpi).toHaveProperty("slaMelanggar");
		expect(result.kpi).toHaveProperty("totalPengguna");
		expect(result.kpi).toHaveProperty("notifikasiBelumDibaca");
		expect(typeof result.kpi.totalPengguna).toBe("number");
		expect(result.kpi.totalPengguna).toBe(1);
	});

	it("counts unread notifications correctly", async () => {
		await testDb.insert(notifications).values([
			{
				id: generateId(10),
				userId: adminId,
				title: "Unread 1",
				message: "test",
				read: false,
				createdAt: new Date(),
			},
			{
				id: generateId(10),
				userId: adminId,
				title: "Unread 2",
				message: "test",
				read: false,
				createdAt: new Date(),
			},
			{
				id: generateId(10),
				userId: adminId,
				title: "Already read",
				message: "test",
				read: true,
				createdAt: new Date(),
			},
		]);

		const result: any = await load({
			locals: createMockLocals(adminId),
		} as any);

		expect(typeof result.kpi.notifikasiBelumDibaca).toBe("number");
		expect(result.kpi.notifikasiBelumDibaca).toBe(2);
	});

	it("returns Novira mock data lists", async () => {
		const result: any = await load({
			locals: createMockLocals(adminId),
		} as any);

		expect(result.provinsiList).toBeInstanceOf(Array);
		expect(result.kabupatenKotaList).toBeInstanceOf(Array);
		expect(result.kameraList).toBeInstanceOf(Array);
		expect(result.insidenList).toBeInstanceOf(Array);
		expect(result.skorWilayahList).toBeInstanceOf(Array);
		expect(result.petugasList).toBeInstanceOf(Array);
		expect(result.trenSampahList).toBeInstanceOf(Array);
		expect(result.auditLogList).toBeInstanceOf(Array);
	});

	it("defaults maintenanceMode to false when no setting is stored", async () => {
		const result: any = await load({
			locals: createMockLocals(adminId),
		} as any);

		expect(result.systemStatus).toHaveProperty("maintenanceMode");
		expect(result.systemStatus.maintenanceMode).toBe(false);
	});

	it("exposes audit log records to admins only", async () => {
		const operatorId = await createTestUser(testDb, {
			name: "Operator",
			email: "operator@test.com",
			username: "operator",
			role: "operator",
		});

		const adminResult: any = await load({
			locals: createMockLocals(adminId),
		} as any);
		const operatorResult: any = await load({
			locals: createMockLocals(operatorId, "operator"),
		} as any);

		expect(adminResult.auditLogList).toBeInstanceOf(Array);
		expect(operatorResult.auditLogList).toEqual([]);
	});

	it("reflects maintenanceMode when the setting is stored as true", async () => {
		await testDb.insert(appSettings).values({
			key: "maintenanceMode",
			value: "true",
			updatedAt: new Date(),
		});

		const result: any = await load({
			locals: createMockLocals(adminId),
		} as any);

		expect(result.systemStatus.maintenanceMode).toBe(true);
	});
});
