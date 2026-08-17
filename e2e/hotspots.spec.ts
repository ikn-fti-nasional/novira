import { test, expect } from "@playwright/test";
import { login } from "./helpers.js";

/**
 * Peta titik rawan hanya bisa dibuktikan di peramban sungguhan: Leaflet
 * dimuat dinamis di klien, sehingga render sisi server tidak menghasilkan
 * satu pun penanda. Uji ini memastikan peta benar-benar terbentuk — bukan
 * sekadar halamannya membalas HTTP 200.
 */
test.describe("Peta titik rawan", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
		await page.goto("/dashboard/hotspots");
	});

	test("membangun peta Leaflet dengan ubin dan atribusi", async ({ page }) => {
		await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
		// Ubin peta betul-betul diminta, bukan wadah kosong.
		await expect(page.locator(".leaflet-tile").first()).toBeAttached({ timeout: 15000 });
		// Atribusi OpenStreetMap wajib tampil — syarat lisensi ubinnya.
		await expect(page.locator(".leaflet-control-attribution")).toContainText("OpenStreetMap");
	});

	test("menggambar penanda kamera dari koordinat sungguhan", async ({ page }) => {
		await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
		// Kamera dikelompokkan, jadi yang muncul bisa berupa cluster atau
		// penanda lingkaran — keduanya menandakan data sudah masuk ke peta.
		const penanda = page.locator(".leaflet-marker-icon, .leaflet-interactive");
		await expect(penanda.first()).toBeVisible({ timeout: 15000 });
		expect(await penanda.count()).toBeGreaterThan(0);
	});

	test("popup penanda menampilkan detail lokasi", async ({ page }) => {
		await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
		const penanda = page.locator(".leaflet-marker-icon, .leaflet-interactive").first();
		await penanda.click();
		await expect(page.locator(".leaflet-popup-content")).toBeVisible({ timeout: 10000 });
	});

	test("tombol lapisan menyembunyikan penanda kamera", async ({ page }) => {
		await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });

		// Kamera dimuat bertahap (`chunkedLoading`), jadi menghitung penanda
		// terlalu dini akan mengukur peta yang belum selesai tergambar.
		// Menunggu cluster pertama muncul membuat uji ini deterministik.
		const cluster = page.locator(".marker-cluster");
		await expect(cluster.first()).toBeVisible({ timeout: 20000 });

		await page.getByRole("button", { name: "Titik rawan" }).click();
		await expect(cluster).toHaveCount(0, { timeout: 10000 });

		await page.getByRole("button", { name: "Kamera" }).click();
		await expect(cluster.first()).toBeVisible({ timeout: 20000 });
	});

	test("ringkasan menyebut jumlah kamera yang terpetakan", async ({ page }) => {
		await expect(page.getByText(/\d+ kamera terpetakan/)).toBeVisible();
	});
});
