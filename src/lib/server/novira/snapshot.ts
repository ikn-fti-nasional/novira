import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "$lib/server/db/index.js";
import { areaSnapshots, auditLog, cameras, incidents } from "$lib/server/db/schema.js";
import { generateId } from "$lib/server/id.js";
import { hitungSkorKebersihan } from "./skor.js";

/**
 * Arsip skor kebersihan harian per kecamatan.
 *
 * Latar belakangnya: seluruh angka tren di aplikasi ini (panah naik/turun di
 * peringkat wilayah, delta KPI eksekutif, grafik mingguan/bulanan) sebelumnya
 * terpaksa dikembalikan sebagai "stabil"/"+0.0%" — bukan karena malas, tapi
 * karena memang tidak ada satu pun titik data historis untuk dibandingkan.
 * Menuliskan angka tren tanpa arsip berarti mengarang.
 *
 * Cron harian di sini membangun arsip itu. Setelah dua hari berjalan, semua
 * tren tersebut menjadi angka nyata yang bisa dipertanggungjawabkan asal
 * usulnya, dan analisa kekambuhan di `analitik.ts` punya bahan.
 */

/** Tanggal lokal WIB dalam format YYYY-MM-DD. */
export function tanggalWib(d = new Date()): string {
	// `sv-SE` menghasilkan format ISO (YYYY-MM-DD) — cara terpendek mendapat
	// tanggal kalender di zona waktu tertentu tanpa menarik pustaka tanggal.
	return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

export interface RingkasanSnapshot {
	tanggal: string;
	areaTersimpan: number;
}

/**
 * Hitung dan simpan skor tiap kecamatan untuk satu hari.
 *
 * Idempoten: menulis ulang baris hari yang sama lewat upsert pada indeks unik
 * (tanggal, kota, kecamatan), sehingga cron yang gagal lalu diulang manual —
 * atau server yang restart tepat di jam eksekusi — tidak menghasilkan data
 * ganda yang akan merusak seluruh perhitungan tren.
 */
export async function simpanSnapshotHarian(sekarang = new Date()): Promise<RingkasanSnapshot> {
	const tanggal = tanggalWib(sekarang);
	const awalHari = new Date(sekarang);
	awalHari.setHours(0, 0, 0, 0);

	const rows = await db
		.select({
			kecamatan: cameras.kecamatan,
			kota: cameras.kota,
			jumlahInsiden: sql<number>`count(${incidents.id})::int`,
			insidenBaru: sql<number>`count(*) filter (where ${incidents.pertamaDilihat} >= ${awalHari})::int`,
			insidenSelesai: sql<number>`count(*) filter (where ${incidents.status} = 'SELESAI' and ${incidents.updatedAt} >= ${awalHari})::int`,
			rataRataDurasiJam: sql<number>`coalesce(avg(extract(epoch from (${incidents.terakhirDilihat} - ${incidents.pertamaDilihat})) / 3600), 0)`,
		})
		.from(cameras)
		.leftJoin(incidents, eq(incidents.cameraId, cameras.id))
		.groupBy(cameras.kecamatan, cameras.kota);

	const baris = rows
		.filter((r): r is typeof r & { kecamatan: string } => !!r.kecamatan)
		.map((r) => {
			const durasi = Number(r.rataRataDurasiJam);
			const skor = hitungSkorKebersihan(r.jumlahInsiden, durasi);
			return {
				id: generateId(12),
				tanggal,
				kecamatan: r.kecamatan,
				kota: r.kota,
				skorKebersihan: skor,
				jumlahInsiden: r.jumlahInsiden,
				insidenBaru: r.insidenBaru,
				insidenSelesai: r.insidenSelesai,
				rataRataDurasiJam: String(Math.round(durasi * 10) / 10),
			};
		});

	if (baris.length > 0) {
		await db.transaction(async (tx) => {
			for (const b of baris) {
				await tx
					.insert(areaSnapshots)
					.values(b)
					.onConflictDoUpdate({
						target: [areaSnapshots.tanggal, areaSnapshots.kota, areaSnapshots.kecamatan],
						set: {
							skorKebersihan: b.skorKebersihan,
							jumlahInsiden: b.jumlahInsiden,
							insidenBaru: b.insidenBaru,
							insidenSelesai: b.insidenSelesai,
							rataRataDurasiJam: b.rataRataDurasiJam,
						},
					});
			}
			await tx.insert(auditLog).values({
				id: generateId(10),
				waktu: sekarang,
				pengguna: "sistem",
				peran: "SISTEM",
				tindakan: "Snapshot skor kebersihan harian",
				rincian: `${baris.length} kecamatan diarsipkan untuk tanggal ${tanggal}`,
				wilayah: "",
				tipe: "KONFIGURASI",
			});
		});
	} else {
		await db.insert(auditLog).values({
			id: generateId(10),
			waktu: sekarang,
			pengguna: "sistem",
			peran: "SISTEM",
			tindakan: "Snapshot skor kebersihan harian",
			rincian: `${baris.length} kecamatan diarsipkan untuk tanggal ${tanggal}`,
			wilayah: "",
			tipe: "KONFIGURASI",
		});
	}

	return { tanggal, areaTersimpan: baris.length };
}

export interface TrenArea {
	kecamatan: string;
	kota: string;
	skorSekarang: number;
	skorSebelumnya: number | null;
	delta: number;
	tren: "naik" | "turun" | "stabil";
}

/**
 * Bandingkan skor terbaru dengan skor `hariKeBelakang` hari lalu.
 *
 * Mengembalikan `skorSebelumnya: null` (dan tren "stabil") kalau arsipnya
 * belum cukup panjang. Itu disengaja — pemanggil bisa membedakan "benar-benar
 * stabil" dari "belum ada data", dan UI menampilkan "—" alih-alih 0% palsu.
 */
export async function trenArea(hariKeBelakang = 7): Promise<TrenArea[]> {
	const tanggalTerbaru = await tanggalSnapshotTerbaru();
	if (!tanggalTerbaru) return [];

	const acuan = new Date(`${tanggalTerbaru}T00:00:00Z`);
	acuan.setUTCDate(acuan.getUTCDate() - hariKeBelakang);
	const tanggalPembanding = acuan.toISOString().slice(0, 10);

	const terbaru = await db
		.select()
		.from(areaSnapshots)
		.where(eq(areaSnapshots.tanggal, tanggalTerbaru));

	const historis = await db
		.select()
		.from(areaSnapshots)
		.where(lt(areaSnapshots.tanggal, tanggalTerbaru))
		.orderBy(desc(areaSnapshots.tanggal));

	// Pembanding per area = snapshot terbaru yang umurnya SUDAH mencapai
	// `hariKeBelakang`. Kalau tanggal persisnya tidak ada (server mati sehari,
	// cron tidak jalan), baris terdekat sebelumnya dipakai — satu hari bolong
	// tidak boleh mengosongkan seluruh kolom tren. Kalau arsipnya memang belum
	// sepanjang itu, area tersebut sengaja dibiarkan tanpa pembanding
	// (`null`) daripada dibandingkan dengan kemarin lalu dilabeli "tren 7 hari".
	const pembanding = new Map<string, number>();
	for (const h of historis) {
		if (h.tanggal > tanggalPembanding) continue;
		const kunci = `${h.kota}|${h.kecamatan}`;
		if (pembanding.has(kunci)) continue; // sudah diurut menurun — yang pertama adalah yang terdekat
		pembanding.set(kunci, h.skorKebersihan);
	}

	return terbaru
		.map((t) => {
			const sebelum = pembanding.get(`${t.kota}|${t.kecamatan}`) ?? null;
			const delta = sebelum === null ? 0 : t.skorKebersihan - sebelum;
			return {
				kecamatan: t.kecamatan,
				kota: t.kota,
				skorSekarang: t.skorKebersihan,
				skorSebelumnya: sebelum,
				delta,
				tren: delta > 1 ? ("naik" as const) : delta < -1 ? ("turun" as const) : ("stabil" as const),
			};
		})
		.sort((a, b) => b.skorSekarang - a.skorSekarang);
}

async function tanggalSnapshotTerbaru(): Promise<string | null> {
	const [row] = await db
		.select({ tanggal: areaSnapshots.tanggal })
		.from(areaSnapshots)
		.orderBy(desc(areaSnapshots.tanggal))
		.limit(1);
	return row?.tanggal ?? null;
}

export interface DeretHarian {
	tanggal: string;
	skorRataRata: number;
	insidenBaru: number;
	insidenSelesai: number;
}

/** Deret skor rata-rata kota per hari untuk grafik tren — hanya hari yang benar-benar terarsip. */
export async function deretSkorHarian(jumlahHari = 30): Promise<DeretHarian[]> {
	const batas = new Date();
	batas.setDate(batas.getDate() - jumlahHari);
	const tanggalBatas = tanggalWib(batas);

	const rows = await db
		.select({
			tanggal: areaSnapshots.tanggal,
			skorRataRata: sql<number>`round(avg(${areaSnapshots.skorKebersihan}))::int`,
			insidenBaru: sql<number>`sum(${areaSnapshots.insidenBaru})::int`,
			insidenSelesai: sql<number>`sum(${areaSnapshots.insidenSelesai})::int`,
		})
		.from(areaSnapshots)
		.where(gte(areaSnapshots.tanggal, tanggalBatas))
		.groupBy(areaSnapshots.tanggal)
		.orderBy(asc(areaSnapshots.tanggal));

	return rows;
}

/**
 * Delta KPI kota (dipakai dashboard eksekutif) — persentase perubahan skor
 * rata-rata kota terhadap `hariKeBelakang` hari lalu.
 *
 * `null` berarti arsipnya belum cukup; pemanggil wajib menampilkan "—",
 * bukan "+0.0%", supaya pembaca laporan tidak menyimpulkan kotanya stagnan
 * padahal sistemnya baru dipasang.
 */
export async function deltaKpi(
	hariKeBelakang = 7
): Promise<{ persen: number; arah: "naik" | "turun" | "stabil" } | null> {
	const deret = await deretSkorHarian(hariKeBelakang + 1);
	if (deret.length < 2) return null;

	const awal = deret[0].skorRataRata;
	const akhir = deret[deret.length - 1].skorRataRata;
	if (awal === 0) return null;

	const persen = Math.round(((akhir - awal) / awal) * 1000) / 10;
	return { persen, arah: persen > 0.5 ? "naik" : persen < -0.5 ? "turun" : "stabil" };
}

/** Apakah arsip sudah cukup panjang untuk menampilkan tren sama sekali? */
export async function punyaHistori(minimalHari = 2): Promise<boolean> {
	const [row] = await db
		.select({ jumlah: sql<number>`count(distinct ${areaSnapshots.tanggal})::int` })
		.from(areaSnapshots);
	return (row?.jumlah ?? 0) >= minimalHari;
}

/**
 * Backfill arsip dari data insiden yang sudah ada.
 *
 * Dipakai sekali saat fitur ini dipasang di instalasi yang sudah berjalan
 * (dan untuk menyiapkan demo), supaya grafik tren tidak kosong selama
 * seminggu pertama menunggu cron. Angka yang dihasilkan dihitung dari insiden
 * nyata pada tanggal tersebut — bukan angka acak.
 */
export async function backfillSnapshot(jumlahHari = 14): Promise<number> {
	let ditulis = 0;
	for (let i = jumlahHari; i >= 1; i--) {
		const hari = new Date();
		hari.setDate(hari.getDate() - i);
		hari.setHours(23, 59, 0, 0);

		const tanggal = tanggalWib(hari);
		const rows = await db
			.select({
				kecamatan: cameras.kecamatan,
				kota: cameras.kota,
				// Hanya insiden yang SUDAH ADA pada hari itu yang dihitung.
				jumlahInsiden: sql<number>`count(*) filter (where ${incidents.pertamaDilihat} <= ${hari})::int`,
				rataRataDurasiJam: sql<number>`coalesce(avg(extract(epoch from (least(${incidents.terakhirDilihat}, ${hari}) - ${incidents.pertamaDilihat})) / 3600) filter (where ${incidents.pertamaDilihat} <= ${hari}), 0)`,
			})
			.from(cameras)
			.leftJoin(incidents, eq(incidents.cameraId, cameras.id))
			.groupBy(cameras.kecamatan, cameras.kota);

		for (const r of rows) {
			if (!r.kecamatan) continue;
			const durasi = Math.max(0, Number(r.rataRataDurasiJam));
			const skor = hitungSkorKebersihan(r.jumlahInsiden, durasi);
			await db
				.insert(areaSnapshots)
				.values({
					id: generateId(12),
					tanggal,
					kecamatan: r.kecamatan,
					kota: r.kota,
					skorKebersihan: skor,
					jumlahInsiden: r.jumlahInsiden,
					insidenBaru: 0,
					insidenSelesai: 0,
					rataRataDurasiJam: String(Math.round(durasi * 10) / 10),
				})
				.onConflictDoNothing();
			ditulis++;
		}
	}
	return ditulis;
}

/** Insiden terbuka per kecamatan hari ini — dipakai halaman analitik bersama arsip. */
export async function insidenTerbukaPerKecamatan() {
	return db
		.select({
			kecamatan: cameras.kecamatan,
			kota: cameras.kota,
			jumlah: sql<number>`count(*)::int`,
		})
		.from(incidents)
		.innerJoin(cameras, eq(incidents.cameraId, cameras.id))
		.where(and(inArray(incidents.status, ["AKTIF", "PERINGATAN"])))
		.groupBy(cameras.kecamatan, cameras.kota);
}
