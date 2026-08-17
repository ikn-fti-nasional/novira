import { desc, eq, sql } from "drizzle-orm";
import { db } from "$lib/server/db/index.js";
import { cameras, incidents, publicReports } from "$lib/server/db/schema.js";
import { parseTitik, selGrid } from "./geo.js";

/**
 * Analitik turunan: titik kronis dan jam rawan.
 *
 * Tidak ada model di file ini. Semuanya statistik deskriptif di atas riwayat
 * insiden — dan itu memang cukup, karena pertanyaan yang dijawab bukan "ini
 * sampah atau bukan" (itu tugas detektor) melainkan "di mana masalahnya
 * struktural, dan kapan sebaiknya petugas berpatroli". Pertanyaan kedua ini
 * justru tidak butuh ML, dan hasilnya bisa diperiksa ulang oleh siapa pun
 * yang memegang data mentahnya.
 */

/** Sebuah titik disebut kronis bila sudah dibersihkan sebanyak ini lalu kotor lagi. */
const AMBANG_KRONIS = 3;

export type RekomendasiIntervensi =
	| "TAMBAH_TPS"
	| "PENJADWALAN_ULANG"
	| "PENGAWASAN_CCTV"
	| "SOSIALISASI_WARGA";

export interface TitikKronis {
	kunci: string;
	nama: string;
	kecamatan: string;
	kota: string;
	latitude: number | null;
	longitude: number | null;
	/** Berapa kali titik ini pernah dibersihkan (insiden SELESAI). */
	jumlahDibersihkan: number;
	/** Berapa insiden yang masih terbuka di titik ini sekarang. */
	terbukaSekarang: number;
	/** Rata-rata jarak antar kejadian, dalam jam — seberapa cepat kotor lagi. */
	rataRataJedaJam: number;
	rekomendasi: RekomendasiIntervensi;
	alasanRekomendasi: string;
}

/**
 * Titik yang berulang kali dibersihkan lalu kotor lagi.
 *
 * Nilainya untuk pemda: titik seperti ini tidak selesai dengan menambah
 * frekuensi angkut — pola berulang menandakan penyebabnya struktural (tidak
 * ada TPS terdekat, jadwal angkut tidak cocok dengan ritme pasar, atau
 * pembuangan disengaja). Karena itu tiap titik diberi rekomendasi intervensi,
 * bukan sekadar dihitung.
 */
export async function listTitikKronis(): Promise<TitikKronis[]> {
	const rows = await db
		.select({ incident: incidents, camera: cameras })
		.from(incidents)
		.leftJoin(cameras, eq(incidents.cameraId, cameras.id))
		.orderBy(incidents.pertamaDilihat);

	interface Akumulator {
		nama: string;
		kecamatan: string;
		kota: string;
		latitude: number | null;
		longitude: number | null;
		waktuSelesai: number[];
		terbuka: number;
	}

	const perTitik = new Map<string, Akumulator>();

	for (const { incident, camera } of rows) {
		// Kunci pengelompokan: kamera kalau ada (paling stabil), kalau tidak
		// sel grid ~110 m dari koordinat laporan. Insiden tanpa keduanya tidak
		// bisa dilokalisasi, jadi dilewati daripada digabung salah tempat.
		const titik = parseTitik(
			incident.latitude ?? camera?.latitude,
			incident.longitude ?? camera?.longitude
		);
		const kunci = camera?.id ?? (titik ? `geo:${selGrid(titik)}` : null);
		if (!kunci) continue;

		let akun = perTitik.get(kunci);
		if (!akun) {
			akun = {
				nama: camera?.nama ?? incident.lokasiTeks ?? "Titik laporan warga",
				kecamatan: camera?.kecamatan ?? "",
				kota: camera?.kota ?? "",
				latitude: titik?.latitude ?? null,
				longitude: titik?.longitude ?? null,
				waktuSelesai: [],
				terbuka: 0,
			};
			perTitik.set(kunci, akun);
		}

		if (incident.status === "SELESAI") akun.waktuSelesai.push(incident.pertamaDilihat.getTime());
		else if (incident.status === "AKTIF" || incident.status === "PERINGATAN") akun.terbuka++;
	}

	const hasil: TitikKronis[] = [];
	for (const [kunci, akun] of perTitik) {
		if (akun.waktuSelesai.length < AMBANG_KRONIS) continue;

		const jeda: number[] = [];
		for (let i = 1; i < akun.waktuSelesai.length; i++) {
			jeda.push((akun.waktuSelesai[i] - akun.waktuSelesai[i - 1]) / 3600_000);
		}
		const rataRataJedaJam = jeda.length
			? Math.round((jeda.reduce((a, b) => a + b, 0) / jeda.length) * 10) / 10
			: 0;

		const { rekomendasi, alasan } = pilihIntervensi(akun.waktuSelesai.length, rataRataJedaJam);

		hasil.push({
			kunci,
			nama: akun.nama,
			kecamatan: akun.kecamatan,
			kota: akun.kota,
			latitude: akun.latitude,
			longitude: akun.longitude,
			jumlahDibersihkan: akun.waktuSelesai.length,
			terbukaSekarang: akun.terbuka,
			rataRataJedaJam,
			rekomendasi,
			alasanRekomendasi: alasan,
		});
	}

	return hasil.sort((a, b) => b.jumlahDibersihkan - a.jumlahDibersihkan);
}

/**
 * Aturan intervensi.
 *
 * Sengaja berupa aturan eksplisit dan bukan model: pejabat yang menerima
 * rekomendasi "bangun TPS di sini" berhak tahu persis kenapa, dan aturan
 * sederhana yang bisa dibantah jauh lebih berguna di rapat daripada skor
 * kotak hitam.
 */
function pilihIntervensi(
	jumlah: number,
	jedaJam: number
): { rekomendasi: RekomendasiIntervensi; alasan: string } {
	if (jedaJam > 0 && jedaJam < 24) {
		return {
			rekomendasi: "TAMBAH_TPS",
			alasan: `kotor lagi rata-rata tiap ${Math.round(jedaJam)} jam — warga tidak punya tempat pembuangan terdekat`,
		};
	}
	if (jedaJam >= 24 && jedaJam <= 24 * 8) {
		return {
			rekomendasi: "PENJADWALAN_ULANG",
			alasan: `siklus kotor ±${Math.round(jedaJam / 24)} hari — jadwal angkut belum sinkron dengan ritme lokasi`,
		};
	}
	if (jumlah >= 6) {
		return {
			rekomendasi: "PENGAWASAN_CCTV",
			alasan: `berulang ${jumlah}× dengan jeda panjang — pola pembuangan disengaja, perlu pengawasan & penindakan`,
		};
	}
	return {
		rekomendasi: "SOSIALISASI_WARGA",
		alasan: `berulang ${jumlah}× dengan jeda tidak teratur — indikasi perilaku, bukan kapasitas`,
	};
}

export interface JamRawan {
	jam: number;
	label: string;
	jumlah: number;
	/** Persentase dari total kejadian pada jam ini. */
	persentase: number;
}

/**
 * Distribusi jam kemunculan sampah, untuk menyusun jadwal patroli.
 *
 * Catatan kejujuran metodologis yang penting untuk dibaca sebelum memakai
 * angkanya: siklus deteksi CCTV saat ini hanya berjalan dua kali sehari
 * (12:00 & 15:00 WIB, lihat `scheduler.ts`), jadi jam kemunculan dari sumber
 * CCTV terkumpul di dua jam itu dan BUKAN cerminan jam sebenarnya sampah
 * dibuang. Karena itu fungsi ini hanya menghitung insiden dari **laporan
 * warga**, yang waktunya adalah waktu nyata warga melihat sampahnya.
 *
 * Begitu siklus deteksi dijalankan tiap jam, hilangkan filter sumbernya dan
 * angkanya langsung jadi jauh lebih kaya.
 */
export async function listJamRawan(): Promise<JamRawan[]> {
	const rows = await db
		.select({
			jam: sql<number>`extract(hour from (${publicReports.createdAt} at time zone 'UTC') at time zone 'Asia/Jakarta')::int`,
			jumlah: sql<number>`count(*)::int`,
		})
		.from(publicReports)
		.groupBy(
			sql`extract(hour from (${publicReports.createdAt} at time zone 'UTC') at time zone 'Asia/Jakarta')`
		);

	const total = rows.reduce((sum, r) => sum + r.jumlah, 0);
	const perJam = new Map(rows.map((r) => [r.jam, r.jumlah]));

	return Array.from({ length: 24 }, (_, jam) => {
		const jumlah = perJam.get(jam) ?? 0;
		return {
			jam,
			label: `${String(jam).padStart(2, "0")}:00`,
			jumlah,
			persentase: total === 0 ? 0 : Math.round((jumlah / total) * 1000) / 10,
		};
	});
}

export interface UsulanPatroli {
	kecamatan: string;
	jamMulai: number;
	jamSelesai: number;
	alasan: string;
}

/**
 * Usulan jendela patroli: tiga jam berturut-turut dengan kemunculan tertinggi.
 *
 * Jendela 3 jam dipilih karena itu durasi satu shift patroli realistis; window
 * bergerak memastikan yang diusulkan adalah blok waktu yang benar-benar
 * bersambung, bukan tiga jam terpisah yang mustahil dipatroli sekaligus.
 */
export async function usulanJadwalPatroli(minimalKejadian = 5): Promise<UsulanPatroli[]> {
	const rows = await db
		.select({
			kecamatan: publicReports.kecamatan,
			jam: sql<number>`extract(hour from (${publicReports.createdAt} at time zone 'UTC') at time zone 'Asia/Jakarta')::int`,
			jumlah: sql<number>`count(*)::int`,
		})
		.from(publicReports)
		.groupBy(
			publicReports.kecamatan,
			sql`extract(hour from (${publicReports.createdAt} at time zone 'UTC') at time zone 'Asia/Jakarta')`
		);

	const perKecamatan = new Map<string, number[]>();
	for (const r of rows) {
		if (!r.kecamatan) continue;
		const arr = perKecamatan.get(r.kecamatan) ?? new Array(24).fill(0);
		arr[r.jam] = r.jumlah;
		perKecamatan.set(r.kecamatan, arr);
	}

	const usulan: UsulanPatroli[] = [];
	for (const [kecamatan, perJam] of perKecamatan) {
		const total = perJam.reduce((a, b) => a + b, 0);
		// Di bawah ambang ini polanya belum bisa dibedakan dari kebetulan —
		// lebih baik tidak mengusulkan apa-apa daripada mengirim petugas
		// berdasarkan tiga laporan.
		if (total < minimalKejadian) continue;

		let terbaikMulai = 0;
		let terbaikJumlah = -1;
		for (let mulai = 0; mulai <= 21; mulai++) {
			const jumlah = perJam[mulai] + perJam[mulai + 1] + perJam[mulai + 2];
			if (jumlah > terbaikJumlah) {
				terbaikJumlah = jumlah;
				terbaikMulai = mulai;
			}
		}
		if (terbaikJumlah <= 0) continue;

		usulan.push({
			kecamatan,
			jamMulai: terbaikMulai,
			jamSelesai: terbaikMulai + 3,
			alasan: `${terbaikJumlah} dari ${total} laporan (${Math.round((terbaikJumlah / total) * 100)}%) muncul di rentang ini`,
		});
	}

	return usulan.sort((a, b) => a.kecamatan.localeCompare(b.kecamatan));
}

/** Ringkasan sumber insiden — berapa dari CCTV vs berapa dari laporan warga. */
export async function ringkasanSumberInsiden() {
	const rows = await db
		.select({ sumber: incidents.sumber, jumlah: sql<number>`count(*)::int` })
		.from(incidents)
		.groupBy(incidents.sumber);

	const cctv = rows.find((r) => r.sumber === "CCTV")?.jumlah ?? 0;
	const warga = rows.find((r) => r.sumber === "LAPORAN_WARGA")?.jumlah ?? 0;
	return { cctv, warga, total: cctv + warga };
}

/** Statistik triase laporan warga — bahan kartu KPI di halaman laporan & eksekutif. */
export async function ringkasanTriase() {
	const rows = await db
		.select({ status: publicReports.status, jumlah: sql<number>`count(*)::int` })
		.from(publicReports)
		.groupBy(publicReports.status);

	const ambil = (s: string) => rows.find((r) => r.status === s)?.jumlah ?? 0;
	const total = rows.reduce((sum, r) => sum + r.jumlah, 0);
	const diverifikasi = ambil("DIPROSES") + ambil("SELESAI");
	const diputuskan = diverifikasi + ambil("DITOLAK");

	return {
		total,
		menunggu: ambil("MENUNGGU"),
		diproses: ambil("DIPROSES"),
		selesai: ambil("SELESAI"),
		ditolak: ambil("DITOLAK"),
		duplikat: ambil("DUPLIKAT"),
		// Dari laporan yang sudah diputuskan (duplikat tidak dihitung — bukan
		// penilaian benar/salah), berapa persen yang terbukti valid.
		persenValid: diputuskan === 0 ? 0 : Math.round((diverifikasi / diputuskan) * 100),
	};
}

/** Laporan warga terbaru yang menunggu triase — dipakai kartu ringkas di dashboard utama. */
export async function laporanMenunggu(limit = 5) {
	return db
		.select({
			id: publicReports.id,
			kodeTracking: publicReports.kodeTracking,
			kecamatan: publicReports.kecamatan,
			kota: publicReports.kota,
			aiRekomendasi: publicReports.aiRekomendasi,
			createdAt: publicReports.createdAt,
		})
		.from(publicReports)
		.where(eq(publicReports.status, "MENUNGGU"))
		.orderBy(desc(publicReports.createdAt))
		.limit(limit);
}
