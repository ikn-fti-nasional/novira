import type { JenisSampah, TingkatTingkatKeparahan } from "$lib/types/novira.js";

/**
 * Mesin prioritas NOVIRA — mengubah sebuah insiden menjadi skor 0..100 yang
 * BISA DIJELASKAN.
 *
 * Kenapa bukan sekadar tabel jenis→keparahan seperti sebelumnya: dua tumpukan
 * sampah dengan label model yang sama sama sekali tidak setara kalau satu ada
 * di depan sekolah dan sudah 30 jam dibiarkan sementara yang lain di gang
 * sepi dan baru muncul 20 menit lalu. Petugas terbatas, jadi urutan
 * pengerjaan adalah keputusan kebijakan — dan keputusan kebijakan harus bisa
 * dipertanggungjawabkan.
 *
 * Karena itu fungsi ini tidak hanya mengembalikan angka, tapi juga daftar
 * faktor pembentuknya (`rincian`), yang ditampilkan apa adanya di UI dan
 * ikut tersimpan di kolom `incidents.rincianPrioritas`. Operator bisa melihat
 * "kenapa 87", dan auditor bisa memeriksa apakah bobotnya masuk akal.
 *
 * Seluruh isi file ini murni fungsi tanpa efek samping dan tanpa akses DB —
 * pemanggil yang menyiapkan datanya. Itu disengaja supaya bobot kebijakan
 * bisa diuji unit tanpa database (lihat `prioritas.test.ts`).
 */

/** Satu baris penjelasan skor. `poin` boleh negatif (faktor yang menurunkan prioritas). */
export interface FaktorPrioritas {
	label: string;
	poin: number;
	keterangan: string;
}

export interface HasilPrioritas {
	skor: number;
	keparahan: TingkatTingkatKeparahan;
	rincian: FaktorPrioritas[];
}

export interface InputPrioritas {
	jenisSampah: JenisSampah;
	/** Berapa lama sampah sudah dibiarkan, dalam jam. */
	durasiJam: number;
	/** Skor kepercayaan detektor, 0..1. */
	tingkatKepercayaan: number;
	/** Teks lokasi bebas (nama kamera + kecamatan + deskripsi) untuk dicocokkan ke daftar lokasi sensitif. */
	teksLokasi: string;
	/**
	 * Berapa kali titik ini pernah punya insiden SELESAI sebelumnya. Titik yang
	 * berulang kotor adalah masalah struktural, bukan insidentil.
	 */
	kekambuhan: number;
	/** Jumlah laporan warga berbeda yang menguatkan insiden ini. */
	laporanWargaMenguatkan: number;
	/** Insiden yang lahir dari laporan warga terverifikasi = sudah dikonfirmasi manusia di lapangan. */
	dariLaporanWarga?: boolean;
}

/**
 * Bobot dasar per jenis sampah. Urutannya mencerminkan biaya penanganan dan
 * dampak kesehatan: pembuangan liar besar dan puing butuh armada/alat berat,
 * botol tunggal tidak.
 */
const BOBOT_JENIS: Record<JenisSampah, number> = {
	pembuangan_liar_besar: 30,
	tumpukan_sampah: 24,
	puing_bangunan: 22,
	kardus_kemasan: 14,
	kantong_plastik: 12,
	botol_minuman: 8,
};

const LABEL_JENIS: Record<JenisSampah, string> = {
	pembuangan_liar_besar: "Pembuangan liar besar",
	tumpukan_sampah: "Tumpukan sampah",
	puing_bangunan: "Puing bangunan",
	kardus_kemasan: "Kardus/kemasan",
	kantong_plastik: "Kantong plastik",
	botol_minuman: "Botol minuman",
};

/**
 * Lokasi sensitif: dicocokkan sebagai kata kunci pada nama kamera/kecamatan/
 * deskripsi laporan. Pendekatan kata kunci dipilih karena kita belum punya
 * data guna-lahan (land use) resmi dari pemda — begitu ada, ganti bagian ini
 * dengan spatial join, bentuk fungsinya tidak berubah.
 *
 * Sungai diberi bobot tertinggi karena sampah di badan air berpindah ke hilir
 * dan menyumbat drainase (risiko banjir), bukan cuma masalah estetika.
 */
const LOKASI_SENSITIF: { kata: string[]; poin: number; alasan: string }[] = [
	{
		kata: ["sungai", "kali", "sekitar sungai", "jembatan", "drainase", "gorong"],
		poin: 18,
		alasan: "badan air / drainase — risiko sumbatan & banjir",
	},
	{
		kata: ["sekolah", "sd ", "smp", "sma", "smk", "kampus", "universitas", "paud"],
		poin: 15,
		alasan: "kawasan pendidikan — paparan anak",
	},
	{
		kata: ["rumah sakit", "puskesmas", "klinik", "posyandu"],
		poin: 15,
		alasan: "fasilitas kesehatan",
	},
	{
		kata: ["pasar", "terminal", "stasiun", "alun-alun", "alun alun"],
		poin: 12,
		alasan: "kawasan keramaian publik",
	},
	{
		kata: ["wisata", "taman", "monumen", "museum"],
		poin: 10,
		alasan: "kawasan wisata — citra kota",
	},
];

const SKOR_MAKS = 100;

/** Ambang skor → label keparahan. Satu-satunya tempat pemetaan ini didefinisikan. */
function keparahanDariSkor(skor: number): TingkatTingkatKeparahan {
	if (skor >= 75) return "KRITIS";
	if (skor >= 55) return "TINGGI";
	if (skor >= 35) return "SEDANG";
	return "RENDAH";
}

/**
 * Poin durasi tumbuh cepat di awal lalu melandai (logaritmik): selisih 1 jam
 * vs 6 jam jauh lebih berarti daripada 40 jam vs 45 jam — yang terakhir
 * sama-sama sudah gagal. Dibatasi 25 poin supaya insiden lama tidak
 * selamanya mengunci puncak antrian dan menenggelamkan insiden baru yang
 * lebih berbahaya.
 */
function poinDurasi(durasiJam: number): number {
	if (durasiJam <= 0) return 0;
	return Math.min(25, Math.round(Math.log2(durasiJam + 1) * 6));
}

export function hitungPrioritas(input: InputPrioritas): HasilPrioritas {
	const rincian: FaktorPrioritas[] = [];

	const bobotJenis = BOBOT_JENIS[input.jenisSampah] ?? 10;
	rincian.push({
		label: "Jenis sampah",
		poin: bobotJenis,
		keterangan: LABEL_JENIS[input.jenisSampah] ?? input.jenisSampah,
	});

	const durasi = poinDurasi(input.durasiJam);
	if (durasi > 0) {
		rincian.push({
			label: "Durasi dibiarkan",
			poin: durasi,
			keterangan: `${formatDurasi(input.durasiJam)} sejak terdeteksi`,
		});
	}

	const lokasi = cocokkanLokasiSensitif(input.teksLokasi);
	if (lokasi) {
		rincian.push({ label: "Sensitivitas lokasi", poin: lokasi.poin, keterangan: lokasi.alasan });
	}

	if (input.kekambuhan > 0) {
		// Dibatasi 15 supaya satu titik bermasalah tidak mendominasi antrian
		// selamanya — penanganan strukturalnya ada di halaman Titik Kronis,
		// bukan dengan terus menaikkan prioritas harian.
		const poin = Math.min(15, input.kekambuhan * 5);
		rincian.push({
			label: "Titik berulang",
			poin,
			keterangan: `sudah ${input.kekambuhan}× dibersihkan lalu kotor lagi`,
		});
	}

	if (input.laporanWargaMenguatkan > 0) {
		const poin = Math.min(12, input.laporanWargaMenguatkan * 4);
		rincian.push({
			label: "Dikuatkan laporan warga",
			poin,
			keterangan: `${input.laporanWargaMenguatkan} laporan warga di lokasi yang sama`,
		});
	}

	if (input.dariLaporanWarga) {
		rincian.push({
			label: "Terverifikasi manusia",
			poin: 8,
			keterangan: "berasal dari laporan warga yang sudah diverifikasi operator",
		});
	}

	// Kepercayaan model hanya MENGURANGI, tidak pernah menambah. Alasannya:
	// model yang sangat yakin tetap bisa salah, jadi kita tidak memberi hadiah
	// atas keyakinan; tapi deteksi yang ragu-ragu memang layak turun antrian
	// supaya petugas tidak dikirim ke lokasi berdasarkan tebakan lemah.
	// Insiden dari laporan warga terverifikasi dikecualikan — validitasnya
	// sudah ditegakkan manusia, bukan oleh skor model.
	if (!input.dariLaporanWarga && input.tingkatKepercayaan < 0.5) {
		const poin = -Math.round((0.5 - clamp01(input.tingkatKepercayaan)) * 30);
		rincian.push({
			label: "Kepercayaan deteksi rendah",
			poin,
			keterangan: `model hanya ${Math.round(clamp01(input.tingkatKepercayaan) * 100)}% yakin`,
		});
	}

	const total = rincian.reduce((sum, f) => sum + f.poin, 0);
	const skor = Math.max(0, Math.min(SKOR_MAKS, total));

	return { skor, keparahan: keparahanDariSkor(skor), rincian };
}

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.min(1, n));
}

/** Ambil satu kecocokan lokasi sensitif dengan poin tertinggi (tidak ditumpuk, supaya skor tidak meledak). */
function cocokkanLokasiSensitif(teks: string): { poin: number; alasan: string } | null {
	const lower = teks.toLowerCase();
	let terbaik: { poin: number; alasan: string } | null = null;
	for (const entry of LOKASI_SENSITIF) {
		if (!entry.kata.some((k) => lower.includes(k))) continue;
		if (!terbaik || entry.poin > terbaik.poin) terbaik = { poin: entry.poin, alasan: entry.alasan };
	}
	return terbaik;
}

export function formatDurasi(jam: number): string {
	if (jam < 1) return `${Math.max(1, Math.round(jam * 60))} menit`;
	if (jam < 24) return `${Math.round(jam)} jam`;
	const hari = Math.floor(jam / 24);
	const sisa = Math.round(jam % 24);
	return sisa === 0 ? `${hari} hari` : `${hari} hari ${sisa} jam`;
}

/** Serialisasi rincian untuk kolom `incidents.rincianPrioritas`. */
export function serializeRincian(rincian: FaktorPrioritas[]): string {
	return JSON.stringify(rincian);
}

/** Kebalikannya — tahan terhadap JSON rusak / kolom kosong (baris lama sebelum fitur ini ada). */
export function parseRincian(json: string | null | undefined): FaktorPrioritas[] {
	if (!json) return [];
	try {
		const parsed = JSON.parse(json);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(f): f is FaktorPrioritas =>
				!!f &&
				typeof f.label === "string" &&
				typeof f.poin === "number" &&
				typeof f.keterangan === "string"
		);
	} catch {
		return [];
	}
}
