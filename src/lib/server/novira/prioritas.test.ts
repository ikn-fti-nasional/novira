import { describe, it, expect } from "vitest";
import {
	hitungPrioritas,
	parseRincian,
	serializeRincian,
	type InputPrioritas,
} from "./prioritas.js";

/**
 * Mesin prioritas menentukan urutan kerja petugas, jadi yang diuji di sini
 * bukan angka persisnya (bobot boleh dikalibrasi ulang) melainkan
 * **kebijakannya**: hal-hal yang tidak boleh berubah tanpa keputusan sadar.
 */

const DASAR: InputPrioritas = {
	jenisSampah: "kantong_plastik",
	durasiJam: 1,
	tingkatKepercayaan: 0.8,
	teksLokasi: "Jl. Anonim",
	kekambuhan: 0,
	laporanWargaMenguatkan: 0,
};

describe("hitungPrioritas", () => {
	it("selalu mengembalikan skor di dalam 0..100", () => {
		const maksimum = hitungPrioritas({
			jenisSampah: "pembuangan_liar_besar",
			durasiJam: 24 * 30,
			tingkatKepercayaan: 1,
			teksLokasi: "SDN 1 dekat sungai pasar terminal",
			kekambuhan: 99,
			laporanWargaMenguatkan: 99,
			dariLaporanWarga: true,
		});
		expect(maksimum.skor).toBeLessThanOrEqual(100);
		expect(maksimum.skor).toBeGreaterThanOrEqual(0);

		const minimum = hitungPrioritas({
			...DASAR,
			jenisSampah: "botol_minuman",
			durasiJam: 0,
			tingkatKepercayaan: 0,
		});
		expect(minimum.skor).toBeGreaterThanOrEqual(0);
	});

	it("memberi prioritas lebih tinggi pada sampah yang lebih lama dibiarkan", () => {
		const baru = hitungPrioritas({ ...DASAR, durasiJam: 1 });
		const lama = hitungPrioritas({ ...DASAR, durasiJam: 40 });
		expect(lama.skor).toBeGreaterThan(baru.skor);
	});

	it("melandaikan bobot durasi — selisih jam-jam awal lebih berarti daripada selisih di hari kedua", () => {
		const a = hitungPrioritas({ ...DASAR, durasiJam: 1 }).skor;
		const b = hitungPrioritas({ ...DASAR, durasiJam: 6 }).skor;
		const c = hitungPrioritas({ ...DASAR, durasiJam: 40 }).skor;
		const d = hitungPrioritas({ ...DASAR, durasiJam: 45 }).skor;
		expect(b - a).toBeGreaterThan(d - c);
	});

	it("menaikkan prioritas di lokasi sensitif", () => {
		const biasa = hitungPrioritas({ ...DASAR, teksLokasi: "Gang Kecil" });
		const sekolah = hitungPrioritas({ ...DASAR, teksLokasi: "Depan SMP Negeri 5" });
		expect(sekolah.skor).toBeGreaterThan(biasa.skor);
	});

	it("tidak menumpuk poin ketika beberapa kata kunci lokasi cocok sekaligus", () => {
		// Kalau bobotnya ditumpuk, satu nama jalan panjang bisa meledakkan skor
		// tanpa alasan substantif.
		const satu = hitungPrioritas({ ...DASAR, teksLokasi: "dekat sungai" });
		const banyak = hitungPrioritas({ ...DASAR, teksLokasi: "dekat sungai pasar sekolah taman" });
		expect(banyak.skor).toBe(satu.skor);
	});

	it("menurunkan prioritas saat kepercayaan model rendah, tapi tidak pernah menaikkannya saat tinggi", () => {
		const ragu = hitungPrioritas({ ...DASAR, tingkatKepercayaan: 0.1 });
		const cukup = hitungPrioritas({ ...DASAR, tingkatKepercayaan: 0.8 });
		const sangatYakin = hitungPrioritas({ ...DASAR, tingkatKepercayaan: 1 });
		expect(ragu.skor).toBeLessThan(cukup.skor);
		expect(sangatYakin.skor).toBe(cukup.skor);
	});

	it("tidak menghukum laporan warga terverifikasi karena skor model rendah", () => {
		// Validitasnya sudah ditegakkan operator; model yang meleset pada foto
		// ponsel tidak boleh menurunkan prioritasnya.
		const wargaRaguModel = hitungPrioritas({
			...DASAR,
			tingkatKepercayaan: 0,
			dariLaporanWarga: true,
		});
		const cctvRaguModel = hitungPrioritas({ ...DASAR, tingkatKepercayaan: 0 });
		expect(wargaRaguModel.skor).toBeGreaterThan(cctvRaguModel.skor);
	});

	it("membatasi kontribusi titik berulang agar satu lokasi tidak mengunci antrian", () => {
		const tiga = hitungPrioritas({ ...DASAR, kekambuhan: 3 });
		const seratus = hitungPrioritas({ ...DASAR, kekambuhan: 100 });
		expect(seratus.skor).toBe(tiga.skor);
	});

	it("menaikkan prioritas ketika beberapa warga melaporkan titik yang sama", () => {
		const sendiri = hitungPrioritas({ ...DASAR, laporanWargaMenguatkan: 0 });
		const ramai = hitungPrioritas({ ...DASAR, laporanWargaMenguatkan: 3 });
		expect(ramai.skor).toBeGreaterThan(sendiri.skor);
	});

	it("menurunkan keparahan dari skor, bukan dari tabel jenis sampah", () => {
		// Botol minuman (bobot jenis terendah) tetap bisa jadi KRITIS kalau
		// konteksnya cukup buruk — inilah alasan tabel statis lama diganti.
		const parah = hitungPrioritas({
			jenisSampah: "botol_minuman",
			durasiJam: 24 * 7,
			tingkatKepercayaan: 0.9,
			teksLokasi: "bantaran sungai depan sekolah",
			kekambuhan: 3,
			laporanWargaMenguatkan: 3,
		});
		expect(parah.keparahan).toBe("KRITIS");

		const ringan = hitungPrioritas({ ...DASAR, jenisSampah: "botol_minuman", durasiJam: 0.2 });
		expect(ringan.keparahan).toBe("RENDAH");
	});

	it("menyertakan rincian yang jumlah poinnya konsisten dengan skor", () => {
		const hasil = hitungPrioritas({ ...DASAR, durasiJam: 10, teksLokasi: "dekat pasar" });
		const total = hasil.rincian.reduce((s, f) => s + f.poin, 0);
		expect(total).toBe(hasil.skor);
		expect(hasil.rincian.length).toBeGreaterThan(1);
	});
});

describe("serialisasi rincian", () => {
	it("bolak-balik tanpa kehilangan data", () => {
		const asli = hitungPrioritas({ ...DASAR, durasiJam: 5 }).rincian;
		expect(parseRincian(serializeRincian(asli))).toEqual(asli);
	});

	it("mengembalikan array kosong untuk kolom kosong atau JSON rusak", () => {
		// Baris insiden yang dibuat sebelum fitur ini ada punya kolom NULL —
		// halaman insiden tidak boleh meledak karenanya.
		expect(parseRincian(null)).toEqual([]);
		expect(parseRincian("")).toEqual([]);
		expect(parseRincian("bukan json")).toEqual([]);
		expect(parseRincian('{"bukan":"array"}')).toEqual([]);
	});

	it("membuang elemen yang bentuknya tidak sesuai", () => {
		expect(parseRincian('[{"label":"ok","poin":1,"keterangan":"x"},{"label":"rusak"}]')).toEqual([
			{ label: "ok", poin: 1, keterangan: "x" },
		]);
	});
});
