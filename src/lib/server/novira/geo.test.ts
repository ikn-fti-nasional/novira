import { describe, it, expect } from "vitest";
import { cariTerdekat, jarakMeter, normalisasiTelepon, parseTitik, selGrid } from "./geo.js";

describe("jarakMeter", () => {
	it("nol untuk titik yang sama", () => {
		const t = { latitude: -6.9175, longitude: 107.6191 };
		expect(jarakMeter(t, t)).toBe(0);
	});

	it("cocok dengan jarak nyata Bandung–Jakarta dalam toleransi wajar", () => {
		// Alun-alun Bandung → Monas ≈ 120 km garis lurus.
		const jarak = jarakMeter(
			{ latitude: -6.9218, longitude: 107.607 },
			{ latitude: -6.1754, longitude: 106.8272 }
		);
		expect(jarak).toBeGreaterThan(115_000);
		expect(jarak).toBeLessThan(125_000);
	});

	it("simetris", () => {
		const a = { latitude: -6.9, longitude: 107.6 };
		const b = { latitude: -6.91, longitude: 107.61 };
		expect(jarakMeter(a, b)).toBeCloseTo(jarakMeter(b, a), 6);
	});
});

describe("parseTitik", () => {
	it("menerima koordinat teks yang valid", () => {
		expect(parseTitik("-6.9175", "107.6191")).toEqual({ latitude: -6.9175, longitude: 107.6191 });
	});

	it("menolak nilai kosong, bukan angka, dan di luar rentang", () => {
		expect(parseTitik(null, "107.6")).toBeNull();
		expect(parseTitik("-6.9", null)).toBeNull();
		expect(parseTitik("abc", "107.6")).toBeNull();
		expect(parseTitik("-91", "107.6")).toBeNull();
		expect(parseTitik("-6.9", "181")).toBeNull();
	});
});

describe("cariTerdekat", () => {
	const acuan = { latitude: -6.9175, longitude: 107.6191 };
	const kandidat = [
		{ id: "jauh", lat: "-6.95", lon: "107.65" },
		{ id: "dekat", lat: "-6.9176", lon: "107.6192" },
		{ id: "tanpa-koordinat", lat: null, lon: null },
	];
	const titikDari = (k: (typeof kandidat)[number]) => parseTitik(k.lat, k.lon);

	it("memilih kandidat terdekat di dalam radius", () => {
		const hasil = cariTerdekat(acuan, kandidat, titikDari, 1000);
		expect(hasil?.item.id).toBe("dekat");
	});

	it("mengembalikan null kalau semua kandidat di luar radius", () => {
		expect(cariTerdekat(acuan, kandidat, titikDari, 5)).toBeNull();
	});

	it("melewati kandidat tanpa koordinat alih-alih error", () => {
		const hasil = cariTerdekat(acuan, [kandidat[2]], titikDari, 100_000);
		expect(hasil).toBeNull();
	});
});

describe("selGrid", () => {
	it("menyatukan dua titik yang berjarak beberapa puluh meter", () => {
		expect(selGrid({ latitude: -6.91751, longitude: 107.61911 })).toBe(
			selGrid({ latitude: -6.91753, longitude: 107.61914 })
		);
	});

	it("memisahkan titik yang berjarak ratusan meter", () => {
		expect(selGrid({ latitude: -6.9175, longitude: 107.6191 })).not.toBe(
			selGrid({ latitude: -6.9205, longitude: 107.6231 })
		);
	});
});

describe("normalisasiTelepon", () => {
	it("menyatukan semua penulisan nomor yang sama menjadi satu kunci", () => {
		// Ini syarat mutlak reputasi pelapor: kalau tidak, seseorang bisa
		// mereset reputasinya cukup dengan mengubah format nomornya.
		const kanonik = "628123456789";
		expect(normalisasiTelepon("08123456789")).toBe(kanonik);
		expect(normalisasiTelepon("+62 812-3456-789")).toBe(kanonik);
		expect(normalisasiTelepon("628123456789")).toBe(kanonik);
		expect(normalisasiTelepon("8123456789")).toBe(kanonik);
	});

	it("mengembalikan null untuk input yang bukan nomor Indonesia yang masuk akal", () => {
		expect(normalisasiTelepon(null)).toBeNull();
		expect(normalisasiTelepon("")).toBeNull();
		expect(normalisasiTelepon("bukan nomor")).toBeNull();
		expect(normalisasiTelepon("12345")).toBeNull();
		expect(normalisasiTelepon("442071234567")).toBeNull();
		expect(normalisasiTelepon("6281234567890123456")).toBeNull();
	});
});
