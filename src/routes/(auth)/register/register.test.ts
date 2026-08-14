import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, createFormData, createMockRequest } from "$lib/server/db/test-utils.js";
import { users } from "$lib/server/db/schema.js";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return testDb;
	},
}));

const { actions } = await import("./+page.server.js");

function mockActionContext(formData: FormData) {
	return {
		request: createMockRequest(formData),
		cookies: { set: vi.fn(), delete: vi.fn() },
		getClientAddress: () => "127.0.0.1",
	} as any;
}

function registrationForm(username: string) {
	return createFormData({
		name: "Test User",
		email: `${username}@test.com`,
		username,
		password: "password123",
	});
}

// SvelteKit's redirect() throws instead of returning — normalize that.
async function run(formData: FormData) {
	try {
		return await actions.default(mockActionContext(formData));
	} catch (err) {
		return err;
	}
}

describe("Register action", () => {
	beforeEach(async () => {
		testDb = await createTestDb();
	});

	it("makes the very first registered user an admin", async () => {
		const result = await run(registrationForm("first"));

		expect(result).toMatchObject({ status: 302, location: "/dashboard" });

		const [row] = await testDb.select().from(users);
		expect(row.role).toBe("admin");
	});

	it("registers subsequent users as operator", async () => {
		await run(registrationForm("first"));
		await run(registrationForm("second"));

		const rows = await testDb.select().from(users);
		const second = rows.find((r) => r.username === "second");
		expect(second?.role).toBe("operator");
	});

	it("rejects duplicate usernames", async () => {
		await run(registrationForm("dup"));
		const result = await run(registrationForm("dup"));

		expect(result).toMatchObject({ status: 400 });
	});
});
