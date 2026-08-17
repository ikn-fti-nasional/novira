import { describe, it, expect, vi } from "vitest";
import {
	createTestDb,
	createTestUser,
	createMockLocals,
	createFormData,
	createMockRequest,
} from "$lib/server/db/test-utils.js";
import { notifications } from "$lib/server/db/schema.js";
import { generateId } from "$lib/server/id.js";
import { eq } from "drizzle-orm";

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return (globalThis as any).__testDb;
	},
}));

async function seedNotification(db: any, userId: string | null, overrides: Partial<any> = {}) {
	const id = overrides.id ?? generateId(10);
	await db.insert(notifications).values({
		id,
		userId,
		title: overrides.title ?? "Test Notification",
		message: overrides.message ?? "Test message",
		type: overrides.type ?? "info",
		read: overrides.read ?? false,
		createdAt: new Date(),
	});
	return id;
}

describe("Notifications page server", () => {
	it("loads notifications for user", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const userId = await createTestUser(db, { role: "admin" });
		await seedNotification(db, userId, { title: "My Alert" });
		const locals = createMockLocals(userId);

		const { load } = await import("./+page.server.js");
		const result: any = await load({ locals } as any);

		expect(result.notifications.length).toBeGreaterThanOrEqual(1);
	});

	it("marks notification as read", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const userId = await createTestUser(db, { role: "admin" });
		const notifId = await seedNotification(db, userId);
		const locals = createMockLocals(userId);
		const formData = createFormData({ id: notifId });
		const request = createMockRequest(formData);

		const { actions } = await import("./+page.server.js");
		const result: any = await actions.markRead({ request, locals } as any);

		expect(result.success).toBe(true);
	});

	it("deletes a notification", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const userId = await createTestUser(db, { role: "admin" });
		const notifId = await seedNotification(db, userId);
		const locals = createMockLocals(userId);
		const formData = createFormData({ id: notifId });
		const request = createMockRequest(formData);

		const { actions } = await import("./+page.server.js");
		const result: any = await actions.delete({ request, locals } as any);

		expect(result.success).toBe(true);
	});

	it("marks all notifications as read", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const userId = await createTestUser(db, { role: "admin" });
		await seedNotification(db, userId, { title: "Notif 1" });
		await seedNotification(db, userId, { title: "Notif 2" });
		const locals = createMockLocals(userId);
		const formData = createFormData({});
		const request = createMockRequest(formData);

		const { actions } = await import("./+page.server.js");
		const result: any = await actions.markAllRead({ request, locals } as any);

		expect(result.success).toBe(true);
	});

	it("marking a global notification as read only affects the acting user", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const userA = await createTestUser(db, {
			role: "admin",
			username: "usera",
			email: "a@test.com",
		});
		const userB = await createTestUser(db, {
			role: "admin",
			username: "userb",
			email: "b@test.com",
		});
		const notifId = await seedNotification(db, null, { title: "Global Alert" });

		const { actions, load } = await import("./+page.server.js");

		const localsA = createMockLocals(userA);
		const readResult: any = await actions.markRead({
			request: createMockRequest(createFormData({ id: notifId })),
			locals: localsA,
		} as any);
		expect(readResult.success).toBe(true);

		const readRows = await db
			.select({ read: notifications.read })
			.from(notifications)
			.where(eq(notifications.id, notifId));
		expect(readRows[0].read).toBe(false);

		const resultA: any = await load({ locals: localsA } as any);
		const notifA = resultA.notifications.find((n: any) => n.id === notifId);
		expect(notifA.read).toBe(true);

		const resultB: any = await load({ locals: createMockLocals(userB) } as any);
		const notifB = resultB.notifications.find((n: any) => n.id === notifId);
		expect(notifB.read).toBe(false);
	});

	it("rejects notification actions when unauthenticated", async () => {
		const db = await createTestDb();
		(globalThis as any).__testDb = db;
		const userId = await createTestUser(db, { role: "admin" });
		const notifId = await seedNotification(db, userId);
		const locals = { user: null, session: null } as any;
		const request = createMockRequest(createFormData({ id: notifId }));

		const { actions } = await import("./+page.server.js");
		await expect(actions.markRead({ request, locals } as any)).rejects.toMatchObject({
			status: 302,
		});
		await expect(actions.delete({ request, locals } as any)).rejects.toMatchObject({ status: 302 });
	});
});
