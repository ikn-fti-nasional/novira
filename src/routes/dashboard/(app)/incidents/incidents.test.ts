import { describe, it, expect, vi } from "vitest";
import { createTestDb, createTestUser, createMockLocals } from "$lib/server/db/test-utils.js";
import { listInsiden } from "$lib/server/novira/index.js";

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return (globalThis as any).__testDb;
	},
}));

vi.mock("$lib/server/uploads.js", () => ({
	storeUpload: vi.fn(async () => "/uploads/mock-bukti.jpg"),
	validateUpload: vi.fn(() => null),
}));

const { actions } = await import("./+page.server.js");

function formDataDenganBukti(insidenId: string): FormData {
	const fd = new FormData();
	fd.set("insidenId", insidenId);
	fd.set("buktiFoto", new File(["foto"], "bukti.jpg", { type: "image/jpeg" }));
	return fd;
}

describe("Insiden page server", () => {
	it("menandai insiden selesai + menyimpan URL bukti foto", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const userId = await createTestUser(db);
		const locals = createMockLocals(userId);
		const request = new Request("http://localhost", {
			method: "POST",
			body: formDataDenganBukti("INS-2026-0842"),
		});

		const result: any = await actions.selesaikanTugas({ request, locals } as any);

		expect(result.success).toBe(true);
		expect(result.buktiFotoUrl).toBe("/uploads/mock-bukti.jpg");

		const insiden = (await listInsiden()).find((i) => i.id === "INS-2026-0842");
		expect(insiden?.status).toBe("SELESAI");
		expect(insiden?.buktiFotoUrl).toBe("/uploads/mock-bukti.jpg");
	});

	it("menolak tanpa foto bukti", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const userId = await createTestUser(db);
		const locals = createMockLocals(userId);

		const fd = new FormData();
		fd.set("insidenId", "INS-2026-0841");
		const request = new Request("http://localhost", { method: "POST", body: fd });

		const result: any = await actions.selesaikanTugas({ request, locals } as any);

		expect(result.status).toBe(400);
	});

	it("menolak insiden yang tidak dikenal tanpa menyimpan upload", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const userId = await createTestUser(db);
		const locals = createMockLocals(userId);

		const { storeUpload } = await import("$lib/server/uploads.js");
		const storeUploadMock = storeUpload as ReturnType<typeof vi.fn>;
		storeUploadMock.mockClear();

		const request = new Request("http://localhost", {
			method: "POST",
			body: formDataDenganBukti("INS-TIDAK-ADA"),
		});

		const result: any = await actions.selesaikanTugas({ request, locals } as any);

		expect(result.status).toBe(404);
		expect(storeUploadMock).not.toHaveBeenCalled();
	});
});