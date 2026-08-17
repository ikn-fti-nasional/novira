import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, createTestUser } from "$lib/server/db/test-utils.js";
import { auditLog, cameras, incidents, notifications } from "$lib/server/db/schema.js";

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return (globalThis as any).__testDb;
	},
}));

const { jalankanEskalasiSla, ringkasanEskalasiAktif } = await import("./eskalasi.js");

type Db = Awaited<ReturnType<typeof createTestDb>>;

async function siapkanInsiden(
	db: Db,
	id: string,
	umurJam: number,
	override: Record<string, unknown> = {}
) {
	await db
		.insert(cameras)
		.values({
			id: "CAM-1",
			nama: "CCTV Uji",
			kota: "Kota Bandung",
			kecamatan: "Regol",
			status: "ONLINE",
		})
		.onConflictDoNothing();

	const pertama = new Date(Date.now() - umurJam * 3600_000);
	await db.insert(incidents).values({
		id,
		cameraId: "CAM-1",
		jenisSampah: "tumpukan_sampah",
		labelSampah: "Pile",
		pertamaDilihat: pertama,
		terakhirDilihat: new Date(),
		status: "AKTIF",
		keparahan: "SEDANG",
		tingkatKepercayaan: "0.7",
		urlSnapshot: "/uploads/s.jpg",
		statusSla: "TEPAT_WAKTU",
		bboxX: "0",
		bboxY: "0",
		bboxWidth: "0.1",
		bboxHeight: "0.1",
		...override,
	} as never);
}

describe("jalankanEskalasiSla", () => {
	it("tidak mengeskalasi insiden yang masih di dalam SLA", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await siapkanInsiden(db, "INS-baru", 2);

		const hasil = await jalankanEskalasiSla();
		expect(hasil.dieskalasi).toBe(0);

		const [insiden] = await db.select().from(incidents);
		expect(insiden.tingkatEskalasi).toBe(0);
		expect(insiden.status).toBe("AKTIF");
	});

	it("mengeskalasi ke jenjang 1 setelah 12 jam", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await createTestUser(db, { role: "operator", username: "op", email: "op@test.id" });
		await siapkanInsiden(db, "INS-12", 13);

		const hasil = await jalankanEskalasiSla();
		expect(hasil.dieskalasi).toBe(1);

		const [insiden] = await db.select().from(incidents);
		expect(insiden.tingkatEskalasi).toBe(1);
		expect(insiden.statusSla).toBe("HAMPIR_BREACH");
		expect(insiden.status).toBe("PERINGATAN");
	});

	it("melompat langsung ke jenjang tertinggi yang ambangnya sudah terlewat", async () => {
		// Insiden berumur 3 hari tidak boleh butuh tiga kali cron untuk sampai
		// ke kepala dinas.
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await siapkanInsiden(db, "INS-72", 72);

		await jalankanEskalasiSla();
		const [insiden] = await db.select().from(incidents);
		expect(insiden.tingkatEskalasi).toBe(3);
		expect(insiden.statusSla).toBe("MELANGGAR_SLA");
	});

	it("idempoten — cron yang jalan berulang tidak mengirim notifikasi ganda", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await createTestUser(db, { role: "kepala_seksi", username: "ks", email: "ks@test.id" });
		await siapkanInsiden(db, "INS-24", 25);

		const pertama = await jalankanEskalasiSla();
		const notifSetelahSekali = await db.select().from(notifications);

		const kedua = await jalankanEskalasiSla();
		const ketiga = await jalankanEskalasiSla();
		const notifSetelahTigaKali = await db.select().from(notifications);

		expect(pertama.dieskalasi).toBe(1);
		expect(kedua.dieskalasi).toBe(0);
		expect(ketiga.dieskalasi).toBe(0);
		expect(notifSetelahTigaKali).toHaveLength(notifSetelahSekali.length);
	});

	it("mengirim notifikasi ke pemegang peran tujuan, bukan notifikasi global", async () => {
		// Kalau semua orang menerimanya, tidak ada yang merasa itu tugasnya.
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const ksId = await createTestUser(db, {
			role: "kepala_seksi",
			username: "ks2",
			email: "ks2@test.id",
		});
		await siapkanInsiden(db, "INS-ks", 25);

		await jalankanEskalasiSla();
		const notif = await db.select().from(notifications);
		expect(notif.length).toBeGreaterThan(0);
		expect(notif.every((n) => n.userId !== null)).toBe(true);
		expect(notif.some((n) => n.userId === ksId)).toBe(true);
	});

	it("menaikkan skor prioritas seiring insiden mandek", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await siapkanInsiden(db, "INS-prio", 50, { skorPrioritas: 10 });

		await jalankanEskalasiSla();
		const [insiden] = await db.select().from(incidents);
		expect(insiden.skorPrioritas).toBeGreaterThan(10);
		expect(insiden.rincianPrioritas).toBeTruthy();
	});

	it("mencatat jejak audit bertipe ESKALASI yang tertaut ke insidennya", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await siapkanInsiden(db, "INS-audit", 25);

		await jalankanEskalasiSla();
		const jejak = await db.select().from(auditLog).where(eq(auditLog.tipe, "ESKALASI"));
		expect(jejak).toHaveLength(1);
		expect(jejak[0].incidentId).toBe("INS-audit");
	});

	it("mengabaikan insiden yang sudah selesai atau positif palsu", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await siapkanInsiden(db, "INS-selesai", 100, { status: "SELESAI" });
		await siapkanInsiden(db, "INS-palsu", 100, { status: "POSITIF_PALSU" });

		const hasil = await jalankanEskalasiSla();
		expect(hasil.diperiksa).toBe(0);
		expect(hasil.dieskalasi).toBe(0);
	});
});

describe("ringkasanEskalasiAktif", () => {
	it("menghitung insiden terbuka per jenjang", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await siapkanInsiden(db, "INS-a", 13);
		await siapkanInsiden(db, "INS-b", 25);
		await siapkanInsiden(db, "INS-c", 72);
		await jalankanEskalasiSla();

		const ringkasan = await ringkasanEskalasiAktif();
		expect(ringkasan.total).toBe(3);
		expect(ringkasan.diingatkan).toBe(1);
		expect(ringkasan.kepalaSeksi).toBe(1);
		expect(ringkasan.kepalaDinas).toBe(1);
	});
});
