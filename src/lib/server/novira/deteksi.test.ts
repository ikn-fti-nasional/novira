import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { createTestDb } from "$lib/server/db/test-utils.js";
import { auditLog, cameras, incidents } from "$lib/server/db/schema.js";
import { storeUpload } from "$lib/server/uploads.js";

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return (globalThis as any).__testDb;
	},
}));

vi.mock("$lib/server/uploads.js", () => ({
	storeUpload: vi.fn(async () => "/uploads/mock-snapshot.jpg"),
}));

const mockedStoreUpload = vi.mocked(storeUpload);

const { jalankanAnalisaManual, verifikasiTemuanManual } = await import("./deteksi.js");

type Db = Awaited<ReturnType<typeof createTestDb>>;

async function buatFotoAsli(width = 200, height = 200): Promise<Buffer> {
	return sharp({ create: { width, height, channels: 3, background: { r: 20, g: 20, b: 20 } } })
		.jpeg()
		.toBuffer();
}

function snapshotResponse(
	detections: { class_name: string; score: number }[],
	foto: Buffer,
	width = 200,
	height = 200
) {
	return {
		ok: true,
		status: 200,
		json: async () => ({
			source: "mock",
			model_type: "street",
			width,
			height,
			captured_at: new Date().toISOString(),
			image_base64: foto.toString("base64"),
			vehicle_blockers: 0,
			detections: detections.map((d) => ({
				class_id: 0,
				class_name: d.class_name,
				score: d.score,
				box: [10, 10, 110, 110] as [number, number, number, number],
			})),
		}),
	};
}

async function siapkanKamera(db: Db, id: string, nama = "CCTV Uji") {
	await db
		.insert(cameras)
		.values({
			id,
			nama,
			kota: "Kota Bandung",
			kecamatan: "Regol",
			status: "OFFLINE",
			urlStream: "https://pelindung.bandung.go.id:3443/video/uji.m3u8",
		})
		.onConflictDoNothing();
}

describe("jalankanAnalisaManual / verifikasiTemuanManual", () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	let fotoAsli: Buffer;

	beforeEach(async () => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		fotoAsli = await buatFotoAsli();
		mockedStoreUpload.mockClear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("analisa manual tidak menulis apa pun ke tabel incidents", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await siapkanKamera(db, "CAM-1");

		fetchMock.mockResolvedValue(snapshotResponse([{ class_name: "Pile", score: 0.82 }], fotoAsli));

		const ringkasan = await jalankanAnalisaManual({ nama: "Operator Uji", peran: "operator" });

		expect(ringkasan.camerasProcessed).toBe(1);
		expect(ringkasan.camerasFailed).toBe(0);
		expect(ringkasan.temuan).toHaveLength(1);
		expect(ringkasan.temuan[0].jenisSampah).toBe("tumpukan_sampah");
		expect(ringkasan.temuan[0].cameraId).toBe("CAM-1");

		const rows = await db.select().from(incidents);
		expect(rows).toHaveLength(0);

		// Cycle-level audit entry is still recorded even though nothing was persisted as an incident.
		const logs = await db.select().from(auditLog);
		expect(logs).toHaveLength(1);
		expect(logs[0].tindakan).toBe("Analisa manual CCTV dijalankan");
	});

	it("mengabaikan kelas yang tidak relevan (mis. Trash bin)", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await siapkanKamera(db, "CAM-1");

		fetchMock.mockResolvedValue(snapshotResponse([{ class_name: "Trash bin", score: 0.9 }], fotoAsli));

		const ringkasan = await jalankanAnalisaManual({ nama: "Operator Uji", peran: "operator" });
		expect(ringkasan.temuan).toHaveLength(0);
	});

	it("verifikasi menyimpan temuan sebagai insiden baru dan mencatat audit log", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await siapkanKamera(db, "CAM-1");
		fetchMock.mockResolvedValue(snapshotResponse([{ class_name: "Pile", score: 0.82 }], fotoAsli));

		const ringkasan = await jalankanAnalisaManual({ nama: "Operator Uji", peran: "operator" });
		const temuan = ringkasan.temuan[0];

		const hasil = await verifikasiTemuanManual(temuan, { nama: "Operator Uji", peran: "operator" });
		expect(hasil.baru).toBe(true);

		const rows = await db.select().from(incidents);
		expect(rows).toHaveLength(1);
		expect(rows[0].id).toBe(hasil.insidenId);
		expect(rows[0].cameraId).toBe("CAM-1");
		expect(rows[0].jenisSampah).toBe("tumpukan_sampah");
		expect(rows[0].status).toBe("AKTIF");

		const logs = await db.select().from(auditLog).where(eq(auditLog.incidentId, hasil.insidenId));
		expect(logs).toHaveLength(1);
		expect(logs[0].tindakan).toContain("insiden baru");
	});

	it("verifikasi temuan kedua yang tumpang tindih memperbarui insiden yang sama, bukan membuat duplikat", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await siapkanKamera(db, "CAM-1");
		fetchMock.mockResolvedValue(snapshotResponse([{ class_name: "Pile", score: 0.7 }], fotoAsli));

		const ringkasanPertama = await jalankanAnalisaManual({ nama: "Op", peran: "operator" });
		const hasilPertama = await verifikasiTemuanManual(ringkasanPertama.temuan[0], {
			nama: "Op",
			peran: "operator",
		});

		const ringkasanKedua = await jalankanAnalisaManual({ nama: "Op", peran: "operator" });
		const hasilKedua = await verifikasiTemuanManual(ringkasanKedua.temuan[0], {
			nama: "Op",
			peran: "operator",
		});

		expect(hasilKedua.baru).toBe(false);
		expect(hasilKedua.insidenId).toBe(hasilPertama.insidenId);

		const rows = await db.select().from(incidents);
		expect(rows).toHaveLength(1);
	});

	it("menggambar kotak deteksi ke foto yang disimpan saat ada temuan relevan", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await siapkanKamera(db, "CAM-1");
		fetchMock.mockResolvedValue(snapshotResponse([{ class_name: "Pile", score: 0.82 }], fotoAsli));

		await jalankanAnalisaManual({ nama: "Op", peran: "operator" });

		expect(mockedStoreUpload).toHaveBeenCalledTimes(1);
		const [file] = mockedStoreUpload.mock.calls[0];
		const tersimpan = Buffer.from(await (file as File).arrayBuffer());
		// Foto yang disimpan harus sudah dikompositkan dengan kotak deteksi --
		// bukan cuplikan mentah dari kamera.
		expect(tersimpan.equals(fotoAsli)).toBe(false);
	});

	it("tidak mengubah foto kalau tidak ada temuan relevan untuk digambar", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		await siapkanKamera(db, "CAM-1");
		fetchMock.mockResolvedValue(snapshotResponse([{ class_name: "Trash bin", score: 0.9 }], fotoAsli));

		await jalankanAnalisaManual({ nama: "Op", peran: "operator" });

		expect(mockedStoreUpload).toHaveBeenCalledTimes(1);
		const [file] = mockedStoreUpload.mock.calls[0];
		const tersimpan = Buffer.from(await (file as File).arrayBuffer());
		expect(tersimpan.equals(fotoAsli)).toBe(true);
	});
});
