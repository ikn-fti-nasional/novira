import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, createTestUser, createMockLocals } from "$lib/server/db/test-utils.js";
import { cameras, incidents } from "$lib/server/db/schema.js";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return testDb;
	},
}));

const { load } = await import("./+page.server.js");

describe("Executive Dashboard (/eksekutif)", () => {
	beforeEach(async () => {
		testDb = await createTestDb();
		userId = await createTestUser(testDb, {
			name: "Kepala Dinas LH",
			email: "kadinis@bandung.go.id",
			username: "kadinis",
			role: "kepala_dinas",
		});
	});

	it("returns executive KPI stats and leaderboard data", async () => {
		// Skor kebersihan wilayah dihitung dari incidents+cameras nyata, jadi
		// perlu fixture -- lihat rumus di src/lib/server/novira/index.ts
		// (hitungSkorWilayah): 1 kecamatan, 2 insiden, durasi 0 -> skor 100-2*5=90.
		await testDb.insert(cameras).values({
			id: "CAM-EKSEKUTIF-1",
			nama: "CCTV Test",
			kota: "Kota Bandung",
			kecamatan: "Andir",
			status: "ONLINE",
		});
		for (const id of ["INS-FIXTURE-1", "INS-FIXTURE-2"]) {
			const now = new Date();
			await testDb.insert(incidents).values({
				id,
				cameraId: "CAM-EKSEKUTIF-1",
				jenisSampah: "tumpukan_sampah",
				labelSampah: "Pile",
				pertamaDilihat: now,
				terakhirDilihat: now,
				status: "AKTIF",
				keparahan: "SEDANG",
				tingkatKepercayaan: "0.5",
				urlSnapshot: "/uploads/snapshot.jpg",
				statusSla: "TEPAT_WAKTU",
				bboxX: "0.1",
				bboxY: "0.1",
				bboxWidth: "0.2",
				bboxHeight: "0.2",
			});
		}

		const result: any = await load({
			locals: createMockLocals(userId, "kepala_dinas"),
		} as any);

		expect(result).toHaveProperty("kpi");
		expect(result).toHaveProperty("leaderboard");
		expect(result).toHaveProperty("trenMingguan");
		expect(result).toHaveProperty("trenBulanan");

		expect(result.kpi.skorRataRata).toBe(90);
		expect(result.leaderboard.length).toBeGreaterThan(0);
		expect(result.trenMingguan.length).toBe(7);
	});

	it("returns kecamatan and wilayah lists", async () => {
		const result: any = await load({
			locals: createMockLocals(userId, "kepala_dinas"),
		} as any);

		expect(result.kecamatanList).toBeInstanceOf(Array);
		expect(result.provinsiList).toBeInstanceOf(Array);
		expect(result.kabupatenKotaList).toBeInstanceOf(Array);
	});

	it("denies access to operational roles that are not authorized", async () => {
		const operatorId = await createTestUser(testDb, {
			name: "Operator",
			email: "operator@test.com",
			username: "operator",
			role: "operator",
		});

		await expect(
			load({
				locals: createMockLocals(operatorId, "operator"),
			} as any)
		).rejects.toMatchObject({ status: 403 });
	});
});
