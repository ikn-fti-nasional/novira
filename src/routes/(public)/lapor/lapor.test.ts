import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestDb } from "$lib/server/db/test-utils.js";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return testDb;
	},
}));

vi.mock("$lib/server/uploads.js", () => ({
	validateUpload: () => null,
	storeUpload: async () => "/uploads/mock.jpg",
}));

const { actions } = await import("./+page.server.js");

function makeForm(entries: Record<string, string | File | null>): FormData {
	const form = new FormData();
	for (const [k, v] of Object.entries(entries)) {
		if (v !== null) form.set(k, v);
	}
	return form;
}

describe("Public report (/lapor)", () => {
	beforeEach(async () => {
		testDb = await createTestDb();
	});

	it("stores a report with photo and location", async () => {
		const form = makeForm({
			foto: new File(["abc"], "sampah.jpg", { type: "image/jpeg" }),
			pelaporNama: "Budi",
			latitude: "-6.9175",
			longitude: "107.6191",
			deskripsi: "Tumpukan di lampu merah",
		});

		await expect(
			actions.default({
				request: { formData: async () => form },
				getClientAddress: () => "127.0.0.1",
			} as any)
		).rejects.toMatchObject({ status: 303 });

		const { publicReports } = await import("$lib/server/db/schema.js");
		const rows = await testDb.select().from(publicReports);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			pelaporNama: "Budi",
			latitude: "-6.9175",
			status: "MENUNGGU",
			urlFoto: "/uploads/mock.jpg",
		});
	});

	it("rejects a submission without any attachment", async () => {
		const form = makeForm({ kota: "Bandung", deskripsi: "tidak ada file" });

		const result = await actions.default({
			request: { formData: async () => form },
			getClientAddress: () => "127.0.0.2",
		} as any);

		expect(result).toMatchObject({ status: 400 });
	});

	it("rejects bot honeypot submissions", async () => {
		const form = makeForm({
			foto: new File(["abc"], "x.jpg", { type: "image/jpeg" }),
			kota: "Bandung",
			website: "http://spam",
		});

		const result = await actions.default({
			request: { formData: async () => form },
			getClientAddress: () => "127.0.0.3",
		} as any);

		expect(result).toMatchObject({ status: 400 });
	});
});
