import { test, expect } from "@playwright/test";
import { login, expectHeading } from "./helpers.js";

test.describe("Navigation", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test("sidebar link to users works", async ({ page }) => {
		await page.click('a[href="/dashboard/users"]');
		await page.waitForURL("/dashboard/users");
		await expectHeading(page, "Users");
	});

	test("sidebar link to notifications works", async ({ page }) => {
		await page.click('a[href="/dashboard/notifications"]');
		await page.waitForURL("/dashboard/notifications");
		await expectHeading(page, "Notifications");
	});

	test("sidebar link to settings works", async ({ page }) => {
		await page.click('a[href="/dashboard/settings"]');
		await page.waitForURL("/dashboard/settings");
		await expectHeading(page, "Settings");
	});

	test("sidebar link to roles works", async ({ page }) => {
		await page.click('a[href="/dashboard/roles"]');
		await page.waitForURL("/dashboard/roles");
		await expectHeading(page, "Roles");
	});

	test("breadcrumbs update on navigation", async ({ page }) => {
		await page.click('a[href="/dashboard/users"]');
		await page.waitForURL("/dashboard/users");
		await expect(page.locator("nav[aria-label='breadcrumb']")).toContainText("Users");
	});
});