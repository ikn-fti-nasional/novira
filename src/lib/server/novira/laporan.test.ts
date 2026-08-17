import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, createTestUser } from "$lib/server/db/test-utils.js";
import {
	auditLog,
	cameras,
	incidents,
	publicReports,
	reporterTrust,
} from "$lib/server/db/schema.js";

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return (globalThis as any).__testDb;
	},
}));

const {
	buatKodeTracking,
	cariDuplikat,
	hitungRekomendasi,
	lacakLaporan,
	perbaruiReputasi,
	tandaiDuplikat,
	tolakLaporan,
	verifikasiLaporan,
} = await import("./laporan.js");

type Db = Awaited<ReturnType<typeof createTestDb>>;

const AKTOR = { id: "", nama: "Operator Uji", peran: "operator" };

/** Titik acuan: Alun-alun Bandung. */
const LAT = "-6.9218";
const LON = "107.607";

async function buatLaporan(db: Db, id: string, override: Record<string, unknown> = {}) {
	await db.insert(publicReports).values({
		id,
		kodeTracking: `LPR-${id.toUpperCase().slice(0, 6).padEnd(6, "X")}`,
		pelaporNama: "Warga Uji",
		pelaporTelepon: "08123456789",
		deskripsi: "Tumpukan sampah di trotoar",
		jenisSampah: "tumpukan_sampah",
		urlFoto: "/uploads/foto.jpg",
		latitude: LAT,
		longitude: LON,
		kota: "Kota Bandung",
		kecamatan: "Regol",
		status: "MENUNGGU",
		...override,
	} as never);
}

describe("buatKodeTracking", () => {
	it("memakai awalan LPR- dan menghindari karakter yang mudah tertukar", () => {
		for (let i = 0; i < 50; i++) {
			const kode = buatKodeTracking();
			expect(kode).toMatch(/^LPR-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
			// 0/O/1/I/L sengaja tidak ada — kode ini sering dibacakan lewat telepon.
			expect(kode.slice(4)).not.toMatch(/[01OIL]/);
		}
	});
});

describe("hitungRekomendasi", () => {
	const dasar = {
		skorAi: 0.6,
		jumlahDeteksi: 2,
		punyaFoto: true,
		punyaKoordinat: true,
		punyaDeskripsi: true,
		skorReputasi: null,
	};

	it("menandai laporan lengkap dengan deteksi kuat sebagai sangat mungkin valid", () => {
		expect(hitungRekomendasi(dasar).rekomendasi).toBe("SANGAT_MUNGKIN_VALID");
	});

	it("TIDAK menuduh spam hanya karena AI tidak menemukan apa pun", () => {
		// Model dilatih pada citra CCTV; meleset pada foto ponsel itu wajar dan
		// tidak boleh menghukum pelapor yang jujur dan melapor dengan lengkap.
		const hasil = hitungRekomendasi({ ...dasar, skorAi: 0, jumlahDeteksi: 0 });
		expect(hasil.rekomendasi).toBe("PERLU_TINJAUAN");
	});

	it("menandai spam hanya saat sinyal lemah bertemu reputasi buruk", () => {
		const hasil = hitungRekomendasi({
			...dasar,
			skorAi: 0,
			jumlahDeteksi: 0,
			punyaKoordinat: false,
			punyaDeskripsi: false,
			skorReputasi: 10,
		});
		expect(hasil.rekomendasi).toBe("KEMUNGKINAN_SPAM");
	});

	it("selalu menyertakan alasan yang bisa dibaca operator", () => {
		const hasil = hitungRekomendasi(dasar);
		expect(hasil.rincian.length).toBeGreaterThan(0);
		for (const f of hasil.rincian) expect(f.keterangan).not.toBe("");
	});
});

describe("verifikasiLaporan", () => {
	it("menaikkan laporan menjadi insiden dengan skor prioritas dan jejak audit", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const aktor = { ...AKTOR, id: await createTestUser(db) };
		await buatLaporan(db, "lap-1");

		const hasil = await verifikasiLaporan("lap-1", aktor);
		expect(hasil.ok).toBe(true);

		const [insiden] = await db.select().from(incidents);
		expect(insiden.sumber).toBe("LAPORAN_WARGA");
		expect(insiden.laporanId).toBe("lap-1");
		expect(insiden.status).toBe("AKTIF");
		expect(insiden.skorPrioritas).toBeGreaterThan(0);
		expect(insiden.rincianPrioritas).toBeTruthy();

		const [laporan] = await db.select().from(publicReports).where(eq(publicReports.id, "lap-1"));
		expect(laporan.status).toBe("DIPROSES");
		expect(laporan.insidenId).toBe(insiden.id);

		const jejak = await db.select().from(auditLog).where(eq(auditLog.tipe, "LAPORAN_WARGA"));
		expect(jejak).toHaveLength(1);
		expect(jejak[0].pengguna).toBe("Operator Uji");
	});

	it("menjalankan timer SLA sejak warga melapor, bukan sejak operator memverifikasi", async () => {
		// Kalau tidak, keterlambatan verifikasi internal akan tersembunyi dari
		// statistik waktu tanggap.
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const aktor = { ...AKTOR, id: await createTestUser(db) };
		const duaHariLalu = new Date(Date.now() - 48 * 3600_000);
		await buatLaporan(db, "lap-lama", { createdAt: duaHariLalu, updatedAt: duaHariLalu });

		await verifikasiLaporan("lap-lama", aktor);
		const [insiden] = await db.select().from(incidents);
		expect(insiden.pertamaDilihat.getTime()).toBe(duaHariLalu.getTime());
	});

	it("menautkan insiden ke kamera terdekat bila ada dalam radius", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const aktor = { ...AKTOR, id: await createTestUser(db) };
		await db.insert(cameras).values({
			id: "CAM-dekat",
			nama: "CCTV Alun-alun",
			kota: "Kota Bandung",
			kecamatan: "Regol",
			status: "ONLINE",
			latitude: LAT,
			longitude: LON,
		});
		await buatLaporan(db, "lap-2");

		await verifikasiLaporan("lap-2", aktor);
		const [insiden] = await db.select().from(incidents);
		expect(insiden.cameraId).toBe("CAM-dekat");
		expect(insiden.lokasiTeks).toBe("CCTV Alun-alun");
	});

	it("tetap membuat insiden tanpa kamera bila tak ada kamera di sekitar", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const aktor = { ...AKTOR, id: await createTestUser(db) };
		await db.insert(cameras).values({
			id: "CAM-jauh",
			nama: "CCTV Jakarta",
			kota: "Jakarta Pusat",
			status: "ONLINE",
			latitude: "-6.1754",
			longitude: "106.8272",
		});
		await buatLaporan(db, "lap-3");

		await verifikasiLaporan("lap-3", aktor);
		const [insiden] = await db.select().from(incidents);
		expect(insiden.cameraId).toBeNull();
		expect(insiden.latitude).toBe(LAT);
	});

	it("menolak verifikasi ganda pada laporan yang sudah jadi insiden", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const aktor = { ...AKTOR, id: await createTestUser(db) };
		await buatLaporan(db, "lap-4");

		await verifikasiLaporan("lap-4", aktor);
		const kedua = await verifikasiLaporan("lap-4", aktor);

		expect(kedua.ok).toBe(false);
		expect(await db.select().from(incidents)).toHaveLength(1);
	});

	it("menaikkan reputasi pelapor", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const aktor = { ...AKTOR, id: await createTestUser(db) };
		await buatLaporan(db, "lap-5");

		await verifikasiLaporan("lap-5", aktor);
		const [trust] = await db.select().from(reporterTrust);
		expect(trust.telepon).toBe("628123456789");
		expect(trust.laporanValid).toBe(1);
		expect(trust.skor).toBeGreaterThan(50);
	});
});

describe("tolakLaporan", () => {
	it("menyimpan alasan, menurunkan reputasi, dan tidak membuat insiden", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const aktor = { ...AKTOR, id: await createTestUser(db) };
		await buatLaporan(db, "lap-6");

		const hasil = await tolakLaporan("lap-6", aktor, "Foto bukan sampah");
		expect(hasil.ok).toBe(true);

		const [laporan] = await db.select().from(publicReports);
		expect(laporan.status).toBe("DITOLAK");
		expect(laporan.catatanPetugas).toBe("Foto bukan sampah");
		expect(await db.select().from(incidents)).toHaveLength(0);

		const [trust] = await db.select().from(reporterTrust);
		expect(trust.laporanDitolak).toBe(1);
		expect(trust.skor).toBeLessThan(50);
	});

	it("menolak menutup laporan yang sudah terlanjur jadi insiden", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const aktor = { ...AKTOR, id: await createTestUser(db) };
		await buatLaporan(db, "lap-7");
		await verifikasiLaporan("lap-7", aktor);

		const hasil = await tolakLaporan("lap-7", aktor, "berubah pikiran");
		expect(hasil.ok).toBe(false);
	});
});

describe("perbaruiReputasi", () => {
	it("tidak melompat ke ekstrem setelah satu keputusan", async () => {
		// Prior Laplace: butuh pola konsisten sebelum seseorang diperlakukan
		// sebagai tepercaya atau sebagai pengirim spam.
		const db = await createTestDb();
		(globalThis as any).__testDb = db;

		await perbaruiReputasi("08123456789", "valid");
		const [satu] = await db.select().from(reporterTrust);
		expect(satu.skor).toBeLessThan(100);
		expect(satu.skor).toBeGreaterThan(50);

		for (let i = 0; i < 8; i++) await perbaruiReputasi("08123456789", "valid");
		const [banyak] = await db.select().from(reporterTrust);
		expect(banyak.skor).toBeGreaterThan(satu.skor);
	});

	it("mengabaikan pelapor anonim tanpa nomor telepon", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await perbaruiReputasi(null, "valid");
		await perbaruiReputasi("bukan nomor", "ditolak");
		expect(await db.select().from(reporterTrust)).toHaveLength(0);
	});
});

describe("cariDuplikat", () => {
	it("menemukan laporan lain di radius 150 m dalam 48 jam", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await buatLaporan(db, "lap-a");
		// ~50 m dari titik acuan.
		await buatLaporan(db, "lap-b", { latitude: "-6.92225", longitude: "107.6073" });

		const hasil = await cariDuplikat("lap-b");
		expect(hasil).toHaveLength(1);
		expect(hasil[0].laporanId).toBe("lap-a");
		expect(hasil[0].jarakMeter).toBeLessThan(150);
	});

	it("mengabaikan laporan jauh dan laporan yang sudah ditolak", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await buatLaporan(db, "lap-jauh", { latitude: "-6.95", longitude: "107.65" });
		await buatLaporan(db, "lap-ditolak", { status: "DITOLAK" });
		await buatLaporan(db, "lap-c");

		expect(await cariDuplikat("lap-c")).toHaveLength(0);
	});

	it("mengembalikan kosong untuk laporan tanpa koordinat", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await buatLaporan(db, "lap-d", { latitude: null, longitude: null });
		expect(await cariDuplikat("lap-d")).toEqual([]);
	});
});

describe("tandaiDuplikat", () => {
	it("menggabungkan laporan TANPA menurunkan reputasi pelapor", async () => {
		// Melaporkan masalah nyata yang kebetulan sudah dilaporkan orang lain
		// bukan kesalahan pelapor.
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const aktor = { ...AKTOR, id: await createTestUser(db) };
		await buatLaporan(db, "induk");
		await buatLaporan(db, "anak");

		const hasil = await tandaiDuplikat("anak", "induk", aktor);
		expect(hasil.ok).toBe(true);

		const [anak] = await db.select().from(publicReports).where(eq(publicReports.id, "anak"));
		expect(anak.status).toBe("DUPLIKAT");
		expect(anak.duplikatDariId).toBe("induk");
		expect(await db.select().from(reporterTrust)).toHaveLength(0);
	});

	it("mencegah rantai duplikat berlapis", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const aktor = { ...AKTOR, id: await createTestUser(db) };
		await buatLaporan(db, "l1");
		await buatLaporan(db, "l2");
		await buatLaporan(db, "l3");

		await tandaiDuplikat("l2", "l1", aktor);
		const hasil = await tandaiDuplikat("l3", "l2", aktor);
		expect(hasil.ok).toBe(false);
	});

	it("menolak laporan yang menunjuk dirinya sendiri", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const aktor = { ...AKTOR, id: await createTestUser(db) };
		await buatLaporan(db, "l4");
		expect((await tandaiDuplikat("l4", "l4", aktor)).ok).toBe(false);
	});
});

describe("lacakLaporan", () => {
	it("mengembalikan linimasa tanpa membocorkan identitas pelapor", async () => {
		// Siapa pun yang memegang kode bisa membacanya, dan kode itu sering
		// dibagikan lewat pesan singkat.
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await buatLaporan(db, "lap-lacak");
		const [row] = await db.select().from(publicReports);

		const hasil = await lacakLaporan(row.kodeTracking);
		expect(hasil).not.toBeNull();
		expect(JSON.stringify(hasil)).not.toContain("Warga Uji");
		expect(JSON.stringify(hasil)).not.toContain("08123456789");
		expect(hasil!.linimasa[0].selesai).toBe(true);
	});

	it("tidak peka huruf besar/kecil dan spasi berlebih", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await buatLaporan(db, "lap-case");
		const [row] = await db.select().from(publicReports);

		expect(await lacakLaporan(`  ${row.kodeTracking.toLowerCase()}  `)).not.toBeNull();
	});

	it("mengembalikan null untuk kode yang tidak ada", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		expect(await lacakLaporan("LPR-ZZZZZZ")).toBeNull();
		expect(await lacakLaporan("")).toBeNull();
	});

	it("menghilangkan langkah pembersihan pada laporan yang ditolak", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const aktor = { ...AKTOR, id: await createTestUser(db) };
		await buatLaporan(db, "lap-tolak");
		const [row] = await db.select().from(publicReports);
		await tolakLaporan("lap-tolak", aktor, "Bukan sampah");

		const hasil = await lacakLaporan(row.kodeTracking);
		expect(hasil!.linimasa.some((l) => l.judul === "Dibersihkan")).toBe(false);
		expect(hasil!.linimasa.at(-1)!.keterangan).toContain("Bukan sampah");
	});
});
