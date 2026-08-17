import { describe, it, expect, vi } from "vitest";
import { createTestDb } from "$lib/server/db/test-utils.js";
import { areaSnapshots, cameras, incidents, publicReports } from "$lib/server/db/schema.js";

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return (globalThis as any).__testDb;
	},
}));

const { listTitikKronis, listJamRawan, usulanJadwalPatroli, ringkasanSumberInsiden } =
	await import("./analitik.js");
const { simpanSnapshotHarian, trenArea, punyaHistori, deltaKpi } = await import("./snapshot.js");

type Db = Awaited<ReturnType<typeof createTestDb>>;

async function kamera(db: Db, id: string, nama: string, kecamatan = "Regol") {
	await db.insert(cameras).values({
		id,
		nama,
		kota: "Kota Bandung",
		kecamatan,
		status: "ONLINE",
		latitude: "-6.9218",
		longitude: "107.607",
	});
}

async function insiden(
	db: Db,
	id: string,
	cameraId: string,
	override: Record<string, unknown> = {}
) {
	await db.insert(incidents).values({
		id,
		cameraId,
		jenisSampah: "tumpukan_sampah",
		labelSampah: "Pile",
		pertamaDilihat: new Date(),
		terakhirDilihat: new Date(),
		status: "SELESAI",
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

async function laporan(db: Db, id: string, jamWib: number, kecamatan = "Regol") {
	// Dibuat pada tanggal tetap agar konversi zona waktu deterministik:
	// 05:00 UTC = 12:00 WIB.
	const waktu = new Date(Date.UTC(2026, 0, 15, jamWib - 7, 0, 0));
	await db.insert(publicReports).values({
		id,
		kodeTracking: `LPR-${id.toUpperCase().slice(0, 6).padEnd(6, "X")}`,
		kota: "Kota Bandung",
		kecamatan,
		status: "MENUNGGU",
		createdAt: waktu,
		updatedAt: waktu,
	} as never);
}

describe("listTitikKronis", () => {
	it("mengabaikan titik yang belum mencapai ambang kekambuhan", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await kamera(db, "CAM-1", "CCTV Sekali");
		await insiden(db, "i1", "CAM-1");
		await insiden(db, "i2", "CAM-1");

		expect(await listTitikKronis()).toHaveLength(0);
	});

	it("menandai titik yang berulang kali dibersihkan beserta usulan intervensi", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await kamera(db, "CAM-2", "CCTV Kronis");
		const jam = (n: number) => new Date(Date.now() - n * 3600_000);
		await insiden(db, "k1", "CAM-2", { pertamaDilihat: jam(72) });
		await insiden(db, "k2", "CAM-2", { pertamaDilihat: jam(60) });
		await insiden(db, "k3", "CAM-2", { pertamaDilihat: jam(48) });
		await insiden(db, "k4", "CAM-2", { pertamaDilihat: jam(36), status: "AKTIF" });

		const hasil = await listTitikKronis();
		expect(hasil).toHaveLength(1);
		expect(hasil[0].nama).toBe("CCTV Kronis");
		expect(hasil[0].jumlahDibersihkan).toBe(3);
		expect(hasil[0].terbukaSekarang).toBe(1);
		// Kotor lagi tiap 12 jam → penyebabnya kapasitas, bukan perilaku.
		expect(hasil[0].rekomendasi).toBe("TAMBAH_TPS");
		expect(hasil[0].alasanRekomendasi).not.toBe("");
	});

	it("mengusulkan penjadwalan ulang saat siklusnya harian, bukan jam-jaman", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await kamera(db, "CAM-3", "CCTV Mingguan");
		const hari = (n: number) => new Date(Date.now() - n * 24 * 3600_000);
		await insiden(db, "m1", "CAM-3", { pertamaDilihat: hari(9) });
		await insiden(db, "m2", "CAM-3", { pertamaDilihat: hari(6) });
		await insiden(db, "m3", "CAM-3", { pertamaDilihat: hari(3) });

		const [titik] = await listTitikKronis();
		expect(titik.rekomendasi).toBe("PENJADWALAN_ULANG");
	});
});

describe("listJamRawan", () => {
	it("selalu mengembalikan 24 jam penuh walau sebagian kosong", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const hasil = await listJamRawan();
		expect(hasil).toHaveLength(24);
		expect(hasil.every((j) => j.jumlah === 0)).toBe(true);
	});

	it("mengelompokkan laporan menurut jam WIB", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await laporan(db, "p1", 12);
		await laporan(db, "p2", 12);
		await laporan(db, "p3", 18);

		const hasil = await listJamRawan();
		expect(hasil[12].jumlah).toBe(2);
		expect(hasil[18].jumlah).toBe(1);
		expect(hasil[12].persentase).toBeCloseTo(66.7, 0);
	});
});

describe("usulanJadwalPatroli", () => {
	it("tidak mengusulkan apa pun di bawah ambang minimal kejadian", async () => {
		// Lebih baik diam daripada mengirim petugas berdasarkan tiga laporan.
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await laporan(db, "a1", 8);
		await laporan(db, "a2", 9);

		expect(await usulanJadwalPatroli()).toEqual([]);
	});

	it("memilih jendela 3 jam bersambung dengan kemunculan tertinggi", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		for (const [i, jam] of [6, 7, 7, 8, 15].entries()) {
			await laporan(db, `b${i}`, jam);
		}

		const [usulan] = await usulanJadwalPatroli();
		expect(usulan.kecamatan).toBe("Regol");
		expect(usulan.jamMulai).toBe(6);
		expect(usulan.jamSelesai).toBe(9);
		expect(usulan.alasan).toContain("4 dari 5");
	});
});

describe("ringkasanSumberInsiden", () => {
	it("memisahkan insiden CCTV dari insiden laporan warga", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await kamera(db, "CAM-4", "CCTV Campur");
		await insiden(db, "s1", "CAM-4", { sumber: "CCTV" });
		await insiden(db, "s2", "CAM-4", { sumber: "LAPORAN_WARGA" });
		await insiden(db, "s3", "CAM-4", { sumber: "LAPORAN_WARGA" });

		expect(await ringkasanSumberInsiden()).toEqual({ cctv: 1, warga: 2, total: 3 });
	});
});

describe("snapshot harian", () => {
	it("menulis satu baris per kecamatan dan idempoten dalam hari yang sama", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await kamera(db, "CAM-5", "CCTV A", "Regol");
		await kamera(db, "CAM-6", "CCTV B", "Andir");

		await simpanSnapshotHarian();
		const sekali = await db.select().from(areaSnapshots);

		await simpanSnapshotHarian();
		const duaKali = await db.select().from(areaSnapshots);

		expect(sekali).toHaveLength(2);
		expect(duaKali).toHaveLength(2);
	});

	it("menurunkan skor kebersihan seiring bertambahnya insiden", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await kamera(db, "CAM-7", "CCTV Kotor");
		await simpanSnapshotHarian();
		const [bersih] = await db.select().from(areaSnapshots);

		await insiden(db, "d1", "CAM-7", { status: "AKTIF" });
		await insiden(db, "d2", "CAM-7", { status: "AKTIF" });
		await db.delete(areaSnapshots);
		await simpanSnapshotHarian();
		const [kotor] = await db.select().from(areaSnapshots);

		expect(kotor.skorKebersihan).toBeLessThan(bersih.skorKebersihan);
	});
});

describe("tren dari arsip", () => {
	it("menyatakan histori belum cukup alih-alih mengarang tren", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await kamera(db, "CAM-8", "CCTV Baru");
		await simpanSnapshotHarian();

		expect(await punyaHistori()).toBe(false);
		expect(await deltaKpi(7)).toBeNull();
	});

	it("mengembalikan skorSebelumnya null saat arsip lebih pendek dari rentang yang diminta", async () => {
		// Membandingkan dengan kemarin lalu melabelinya "tren 7 hari" akan
		// menyesatkan pembaca laporan.
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await db.insert(areaSnapshots).values([
			{
				id: "s1",
				tanggal: "2026-01-14",
				kecamatan: "Regol",
				kota: "Kota Bandung",
				skorKebersihan: 70,
				createdAt: new Date(),
			},
			{
				id: "s2",
				tanggal: "2026-01-15",
				kecamatan: "Regol",
				kota: "Kota Bandung",
				skorKebersihan: 80,
				createdAt: new Date(),
			},
		] as never);

		const [tren] = await trenArea(7);
		expect(tren.skorSekarang).toBe(80);
		expect(tren.skorSebelumnya).toBeNull();
		expect(tren.tren).toBe("stabil");
	});

	it("menghitung delta ketika arsipnya sudah cukup panjang", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await db.insert(areaSnapshots).values([
			{
				id: "t1",
				tanggal: "2026-01-01",
				kecamatan: "Regol",
				kota: "Kota Bandung",
				skorKebersihan: 60,
				createdAt: new Date(),
			},
			{
				id: "t2",
				tanggal: "2026-01-15",
				kecamatan: "Regol",
				kota: "Kota Bandung",
				skorKebersihan: 85,
				createdAt: new Date(),
			},
		] as never);

		const [tren] = await trenArea(7);
		expect(tren.skorSebelumnya).toBe(60);
		expect(tren.delta).toBe(25);
		expect(tren.tren).toBe("naik");
	});
});
