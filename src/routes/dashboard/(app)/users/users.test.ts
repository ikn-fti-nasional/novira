import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	createTestDb,
	createTestUser,
	createMockLocals,
	createFormData,
	createMockRequest,
} from "$lib/server/db/test-utils.js";

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let adminId: string;

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return testDb;
	},
}));

const { load, actions } = await import("./+page.server.js");

describe("Users page", () => {
	beforeEach(async () => {
		testDb = await createTestDb();
		adminId = await createTestUser(testDb, {
			name: "Admin",
			email: "admin@test.com",
			username: "admin",
			role: "admin",
		});
	});

	describe("load", () => {
		it("returns users array and currentUserId", async () => {
			const result: any = await load({
				locals: createMockLocals(adminId),
			} as any);

			expect(result.users).toBeInstanceOf(Array);
			expect(result.users.length).toBe(1);
			expect(result.users[0]).toHaveProperty("id");
			expect(result.users[0]).toHaveProperty("name");
			expect(result.users[0]).toHaveProperty("email");
			expect(result.users[0]).toHaveProperty("role");
			expect(result.currentUserId).toBe(adminId);
		});
	});

	describe("actions.create", () => {
		it("creates a new user", async () => {
			const formData = createFormData({
				name: "New User",
				email: "new@test.com",
				username: "newuser",
				password: "password123",
				role: "operator",
			});

			const result = await actions.create({
				request: createMockRequest(formData),
				locals: createMockLocals(adminId),
			} as any);

			expect(result).toEqual({ success: true });

			const data: any = await load({
				locals: createMockLocals(adminId),
			} as any);
			expect(data.users.length).toBe(2);
		});

		it("rejects invalid username", async () => {
			const formData = createFormData({
				name: "Bad User",
				email: "bad@test.com",
				username: "AB", // too short
				password: "password123",
				role: "operator",
			});

			const result = await actions.create({
				request: createMockRequest(formData),
				locals: createMockLocals(adminId),
			} as any);

			expect(result).toHaveProperty("status", 400);
		});

		it("rejects duplicate username", async () => {
			await createTestUser(testDb, {
				email: "existing@test.com",
				username: "taken",
				role: "operator",
			});

			const formData = createFormData({
				name: "Duplicate",
				email: "dup@test.com",
				username: "taken",
				password: "password123",
				role: "operator",
			});

			const result = await actions.create({
				request: createMockRequest(formData),
				locals: createMockLocals(adminId),
			} as any);

			expect(result).toHaveProperty("status", 400);
		});
	});

	describe("actions.delete", () => {
		it("prevents self-deletion", async () => {
			const formData = createFormData({ id: adminId });

			const result = await actions.delete({
				request: createMockRequest(formData),
				locals: createMockLocals(adminId),
			} as any);

			expect(result).toHaveProperty("status", 400);
			expect(result).toHaveProperty("data");
		});

		it("denies non-admins from deleting users", async () => {
			const operatorId = await createTestUser(testDb, {
				email: "operator@test.com",
				username: "operator",
				role: "operator",
			});

			// /users mutations are gated on the admin role (requireRoleOrFail), so an
			// operator is rejected with 403 before reaching any deletion guard.
			const formData = createFormData({ id: adminId });

			const result = await actions.delete({
				request: createMockRequest(formData),
				locals: createMockLocals(operatorId, "operator"),
			} as any);

			expect(result).toHaveProperty("status", 403);
		});

		it("allows deletion of non-admin users", async () => {
			const operatorId = await createTestUser(testDb, {
				email: "operator@test.com",
				username: "operator",
				role: "operator",
			});

			const formData = createFormData({ id: operatorId });

			const result = await actions.delete({
				request: createMockRequest(formData),
				locals: createMockLocals(adminId),
			} as any);

			expect(result).toEqual({ success: true });
		});

		it("returns 404 when deleting an unknown user", async () => {
			const formData = createFormData({ id: "no-such-user" });

			const result = await actions.delete({
				request: createMockRequest(formData),
				locals: createMockLocals(adminId),
			} as any);

			expect(result).toHaveProperty("status", 404);
		});
	});

	describe("actions.bulkDelete", () => {
		it("rejects more than 100 ids", async () => {
			const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`).join(",");
			const formData = createFormData({ ids });

			const result = await actions.bulkDelete({
				request: createMockRequest(formData),
				locals: createMockLocals(adminId),
			} as any);

			expect(result).toHaveProperty("status", 400);
		});

		it("refuses to delete the last admin", async () => {
			const formData = createFormData({ ids: adminId });

			const result = await actions.bulkDelete({
				request: createMockRequest(formData),
				locals: createMockLocals(adminId),
			} as any);

			expect(result).toHaveProperty("status", 400);
		});
	});

	describe("actions.update", () => {
		it("prevents demotion of last admin", async () => {
			const formData = createFormData({
				id: adminId,
				name: "Admin",
				email: "admin@test.com",
				role: "operator",
			});

			const result = await actions.update({
				request: createMockRequest(formData),
				locals: createMockLocals(adminId),
			} as any);

			expect(result).toHaveProperty("status", 400);
		});

		it("allows demotion when multiple admins exist", async () => {
			const admin2Id = await createTestUser(testDb, {
				email: "admin2@test.com",
				username: "admin2",
				role: "admin",
			});

			const formData = createFormData({
				id: adminId,
				name: "Admin",
				email: "admin@test.com",
				role: "operator",
			});

			const result = await actions.update({
				request: createMockRequest(formData),
				locals: createMockLocals(admin2Id),
			} as any);

			expect(result).toEqual({ success: true });
		});
	});
});
