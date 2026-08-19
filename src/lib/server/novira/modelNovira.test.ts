import { describe, expect, it } from "vitest";
import { petakanDeteksiNovira } from "./modelNovira.js";

/**
 * Keluaran model diperlakukan sebagai input tak tepercaya: kotaknya bisa
 * terbalik, keluar bingkai, atau berlabel di luar daftar. Yang diuji di sini
 * adalah lapisan pembersihnya, bukan modelnya.
 */
describe("petakanDeteksiNovira", () => {
	const kotak = (x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2 });

	it("mengubah kotak ternormalisasi menjadi piksel", () => {
		const hasil = petakanDeteksiNovira(
			[{ label: "Pile", confidence: 0.9, box: kotak(0.1, 0.2, 0.5, 0.6) }],
			1000,
			500,
			0.2
		);
		expect(hasil).toHaveLength(1);
		expect(hasil[0].box).toEqual([100, 100, 500, 300]);
		expect(hasil[0].class_name).toBe("Pile");
		expect(hasil[0].detector).toBe("novira");
	});

	it("membetulkan kotak yang terbalik dan memotong yang keluar bingkai", () => {
		const hasil = petakanDeteksiNovira(
			[{ label: "Plastic", confidence: 0.5, box: kotak(0.9, 1.4, 0.4, -0.3) }],
			100,
			100,
			0.2
		);
		expect(hasil[0].box).toEqual([40, 0, 90, 100]);
	});

	it("membuang deteksi di bawah ambang kepercayaan", () => {
		const hasil = petakanDeteksiNovira(
			[
				{ label: "Pile", confidence: 0.15, box: kotak(0, 0, 1, 1) },
				{ label: "Pile", confidence: 0.35, box: kotak(0, 0, 1, 1) },
			],
			100,
			100,
			0.3
		);
		expect(hasil).toHaveLength(1);
		expect(hasil[0].score).toBe(0.35);
	});

	it("membuang label di luar daftar kelas", () => {
		const hasil = petakanDeteksiNovira(
			[{ label: "Kucing", confidence: 0.99, box: kotak(0, 0, 1, 1) }],
			100,
			100,
			0.2
		);
		expect(hasil).toEqual([]);
	});

	it("membuang kotak yang menciut jadi nol piksel", () => {
		const hasil = petakanDeteksiNovira(
			[{ label: "Bottle", confidence: 0.8, box: kotak(0.5, 0.5, 0.5001, 0.5001) }],
			100,
			100,
			0.2
		);
		expect(hasil).toEqual([]);
	});

	it("mengurutkan dari skor tertinggi dan membatasi 25 deteksi", () => {
		const banyak = Array.from({ length: 40 }, (_, i) => ({
			label: "Plastic",
			confidence: (i + 1) / 100,
			box: kotak(0, 0, 1, 1),
		}));
		const hasil = petakanDeteksiNovira(banyak, 100, 100, 0.05);
		expect(hasil).toHaveLength(25);
		expect(hasil[0].score).toBe(0.4);
		expect(hasil.at(-1)!.score).toBeCloseTo(0.16, 5);
	});

	it("mengembalikan daftar kosong untuk keluaran yang tidak berbentuk array", () => {
		expect(petakanDeteksiNovira(null, 100, 100, 0.2)).toEqual([]);
		expect(petakanDeteksiNovira({ detections: [] }, 100, 100, 0.2)).toEqual([]);
	});
});
