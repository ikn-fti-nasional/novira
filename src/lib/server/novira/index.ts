import type {
	Kamera,
	Insiden,
	SkorKebersihanWilayah,
	PetugasLapangan,
	TrenSampahJam,
	LogAuditSistem,
	TrenSkorKecamatan,
	EksekutifKpiStats,
	RiwayatInsidenEntry,
} from "$lib/types/novira.js";
import { db } from "$lib/server/db/index.js";
import { cameras, incidents, officers, auditLog, publicReports } from "$lib/server/db/schema.js";
import { countAll } from "$lib/server/db/helpers.js";
import { generateId } from "$lib/server/id.js";
import { parseRincian } from "./prioritas.js";
import { eq, and, inArray, desc, gte, isNotNull, sql } from "drizzle-orm";

/**
 * Seam data domain NOVIRA — satu-satunya pintu masuk data operasional
 * (kamera CCTV, insiden, skor wilayah, petugas, tren, log audit).
 *
 * Dulu 9 halaman mengimpor `mock/novira.js` langsung; menukar sumber data
 * (tabel Postgres kamera/insiden + siklus deteksi pLitter,
 * `$lib/server/novira/deteksi.ts`) cukup terjadi di sini — konsumen (9
 * `+page.server.ts`) tidak berubah sama sekali, itulah gunanya seam ini.
 *
 * Catatan jujur soal keterbatasan data saat ini:
 * - `tren`/`persentaseTren` (skor wilayah) dan delta tren KPI eksekutif
 *   ("+3.2%" dsb.) butuh snapshot skor historis yang belum kita simpan —
 *   dikembalikan sebagai netral ("stabil"/"+0.0%") alih-alih angka karangan.
 *   Akan jadi berarti begitu ada beberapa hari histori siklus deteksi.
 * - `volumeSampahKg` selalu 0 — pipeline ini vision-only (bounding box),
 *   tidak ada sensor berat/estimasi massa.
 * - `TrenSkorKecamatan` (bandungWetan/coblong/lengkong) adalah bentuk lama
 *   yang mendahului daftar 14 kamera Bandung nyata; kecamatan yang belum
 *   punya kamera akan tampil 0 (jujur, bukan dikarang) sampai cakupan kamera
 *   diperluas atau komponennya dirancang ulang untuk kecamatan dinamis.
 */

export async function listProvinsi() {
	const rows = await db.select({ kota: cameras.kota }).from(cameras);
	const map = new Map<string, string>();
	for (const row of rows) map.set(kotaKeProvinsi(row.kota), row.kota);
	return [...map.entries()]
		.map(([nama]) => ({ id: `PROV-${nama}`, nama }))
		.sort((a, b) => a.nama.localeCompare(b.nama));
}

export async function listKabupatenKota() {
	const rows = await db.select({ kota: cameras.kota }).from(cameras);
	return [...new Set(rows.map((r) => r.kota).filter(Boolean))]
		.map((kota) => ({
			id: `KAB-${kota}`,
			provinsiId: `PROV-${kotaKeProvinsi(kota)}`,
			nama: kota,
		}))
		.sort((a, b) => a.nama.localeCompare(b.nama));
}

/** Pemetaan kota → provinsi agar filter cuma berisi lokasi yang benar-benar ada kameranya. */
export function kotaKeProvinsi(kota: string): string {
	const map: Record<string, string> = {
		Bandung: "Jawa Barat",
		"Kota Bandung": "Jawa Barat",
		"Kabupaten Cirebon": "Jawa Barat",
		"Kabupaten Bandung Barat": "Jawa Barat",
		"Kabupaten Bandung": "Jawa Barat",
		"Kota Cirebon": "Jawa Barat",
		"Kabupaten Tangerang": "Banten",
		"Kota Palembang": "Sumatera Selatan",
		"Kota Semarang": "Jawa Tengah",
		"Kabupaten Klaten": "Jawa Tengah",
		"Kabupaten Buleleng": "Bali",
		"Jakarta Pusat": "DKI Jakarta",
		Surabaya: "Jawa Timur",
		"Kota Surabaya": "Jawa Timur",
		Yogyakarta: "DI Yogyakarta",
	};
	return map[kota] ?? "Lainnya";
}

const SEVERITY_RANK: Record<"RENDAH" | "SEDANG" | "TINGGI" | "KRITIS", number> = {
	RENDAH: 0,
	SEDANG: 1,
	TINGGI: 2,
	KRITIS: 3,
};

export async function listKamera(): Promise<Kamera[]> {
	const rows = await db.select().from(cameras).orderBy(cameras.nama);

	const openIncidents = await db
		.select({ cameraId: incidents.cameraId, keparahan: incidents.keparahan })
		.from(incidents)
		.where(inArray(incidents.status, ["AKTIF", "PERINGATAN"]));

	const statsByCamera = new Map<string, { count: number; worst: keyof typeof SEVERITY_RANK }>();
	for (const inc of openIncidents) {
		// Insiden hasil laporan warga yang tidak dekat kamera mana pun tidak
		// dihitung sebagai beban kamera — tidak ada kamera yang memantaunya.
		if (!inc.cameraId) continue;
		const cur = statsByCamera.get(inc.cameraId);
		if (!cur) {
			statsByCamera.set(inc.cameraId, { count: 1, worst: inc.keparahan });
		} else {
			cur.count++;
			if (SEVERITY_RANK[inc.keparahan] > SEVERITY_RANK[cur.worst]) cur.worst = inc.keparahan;
		}
	}

	return rows.map((cam) => {
		const stats = statsByCamera.get(cam.id);
		const statusDeteksi: "NORMAL" | "PERINGATAN" | "KRITIS" = !stats
			? "NORMAL"
			: stats.worst === "KRITIS" || stats.worst === "TINGGI"
				? "KRITIS"
				: "PERINGATAN";

		return {
			id: cam.id,
			nama: cam.nama,
			lokasi: cam.kecamatan ?? cam.kota,
			kelurahan: cam.kelurahan ?? "",
			kecamatan: cam.kecamatan ?? "",
			kabupatenKota: cam.kota,
			provinsi: kotaKeProvinsi(cam.kota),
			latitude: Number(cam.latitude ?? 0),
			longitude: Number(cam.longitude ?? 0),
			status: cam.status,
			jumlahObjekTerdeteksi: stats?.count ?? 0,
			statusDeteksi,
			urlStream: cam.urlStream ?? undefined,
			urlSnapshot: cam.urlSnapshot ?? undefined,
			fps: 0,
		};
	});
}

/**
 * Petakan baris DB → bentuk `Insiden` untuk UI.
 *
 * `camera` boleh `null`: sejak laporan warga bisa naik menjadi insiden
 * (`verifikasiLaporan`), ada insiden yang tidak berasal dari kamera mana pun.
 * Lokasinya lalu diambil dari kolom `lokasiTeks`/`kecamatan` laporan. Semua
 * pembaca WAJIB `leftJoin` — `innerJoin` akan menyembunyikan seluruh insiden
 * hasil laporan warga tanpa error apa pun.
 */
function insidenFromRow(
	incident: typeof incidents.$inferSelect,
	camera: typeof cameras.$inferSelect | null,
	petugasNama?: string,
	kodeLaporan?: string
): Insiden {
	const kota = camera?.kota ?? "";
	const kecamatan = camera?.kecamatan ?? "";
	const kelurahan = camera?.kelurahan ?? "";
	// Koordinat insiden: kolom insiden menang (laporan warga punya GPS sendiri),
	// baru jatuh ke koordinat kamera untuk insiden hasil deteksi CCTV.
	const lintang = Number(incident.latitude ?? camera?.latitude);
	const bujur = Number(incident.longitude ?? camera?.longitude);
	return {
		id: incident.id,
		kameraId: incident.cameraId,
		sumber: incident.sumber,
		kodeLaporan,
		skorPrioritas: incident.skorPrioritas,
		rincianPrioritas: parseRincian(incident.rincianPrioritas),
		tingkatEskalasi: incident.tingkatEskalasi,
		latitude: Number.isFinite(lintang) ? lintang : null,
		longitude: Number.isFinite(bujur) ? bujur : null,
		namaKamera: camera?.nama ?? incident.lokasiTeks ?? "Laporan warga",
		lokasi: camera?.kecamatan ?? incident.lokasiTeks ?? kota,
		kelurahan,
		kecamatan,
		kabupatenKota: kota,
		provinsi: kota ? kotaKeProvinsi(kota) : "",
		trackId: incident.id,
		jenisSampah: incident.jenisSampah,
		labelSampah: incident.labelSampah,
		pertamaDilihat: incident.pertamaDilihat.toISOString(),
		terakhirDilihat: incident.terakhirDilihat.toISOString(),
		durasiMenit: Math.max(
			0,
			Math.round((incident.terakhirDilihat.getTime() - incident.pertamaDilihat.getTime()) / 60000)
		),
		status: incident.status,
		keparahan: incident.keparahan,
		tingkatKepercayaan: Number(incident.tingkatKepercayaan),
		urlSnapshot: incident.urlSnapshot,
		urlSnapshotPertama: incident.urlSnapshotPertama ?? undefined,
		petugasDitugaskan: petugasNama,
		buktiFotoUrl: incident.buktiFotoUrl ?? undefined,
		catatanPenyelesaian: incident.catatanPenyelesaian ?? undefined,
		statusSla: incident.statusSla,
		bbox: {
			x: Number(incident.bboxX),
			y: Number(incident.bboxY),
			width: Number(incident.bboxWidth),
			height: Number(incident.bboxHeight),
		},
	};
}

export async function listInsiden(): Promise<Insiden[]> {
	const rows = await db
		.select({ incident: incidents, camera: cameras, petugas: officers, laporan: publicReports })
		.from(incidents)
		.leftJoin(cameras, eq(incidents.cameraId, cameras.id))
		.leftJoin(officers, eq(incidents.petugasDitugaskan, officers.id))
		.leftJoin(publicReports, eq(incidents.laporanId, publicReports.id))
		// Insiden terbuka diurut prioritas menurun — itulah urutan kerja yang
		// dimaksud mesin prioritas. Insiden tertutup jatuh ke bawah dan diurut
		// waktu, karena prioritas tidak lagi relevan setelah selesai.
		.orderBy(desc(incidents.skorPrioritas), desc(incidents.terakhirDilihat));

	return rows
		.map(({ incident, camera, petugas, laporan }) =>
			insidenFromRow(incident, camera, petugas?.nama, laporan?.kodeTracking)
		)
		.sort((a, b) => {
			const terbukaA = a.status === "AKTIF" || a.status === "PERINGATAN" ? 0 : 1;
			const terbukaB = b.status === "AKTIF" || b.status === "PERINGATAN" ? 0 : 1;
			return terbukaA - terbukaB;
		});
}

/** Ambil baris kamera, atau `null` untuk insiden yang memang tidak punya kamera (sumber laporan warga). */
async function ambilKamera(cameraId: string | null) {
	if (!cameraId) return null;
	const [camera] = await db.select().from(cameras).where(eq(cameras.id, cameraId));
	return camera ?? null;
}

async function namaPetugas(petugasId: string | null): Promise<string | undefined> {
	if (!petugasId) return undefined;
	const [petugas] = await db
		.select({ nama: officers.nama })
		.from(officers)
		.where(eq(officers.id, petugasId));
	return petugas?.nama;
}

/**
 * Tandai insiden selesai (diangkat) + simpan URL bukti foto penanganan, dan
 * catat ke audit_log. `actor` opsional supaya baris audit menyebut petugas
 * yang benar-benar menekan tombol (bukan label generik) saat pemanggil punya
 * `locals.user`.
 */
export async function selesaikanInsiden(
	insidenId: string,
	buktiFotoUrl: string,
	catatan?: string,
	actor?: { nama: string; peran: string }
): Promise<Insiden | null> {
	const [existing] = await db.select().from(incidents).where(eq(incidents.id, insidenId));
	if (!existing) return null;

	const now = new Date();
	// Jangan menimpa riwayat SLA: insiden yang sudah melanggar SLA tetap
	// tercatat MELANGGAR_SLA setelah selesai; hanya yang belum melanggar yang
	// ditandai TEPAT_WAKTU.
	const statusSla = existing.statusSla !== "MELANGGAR_SLA" ? "TEPAT_WAKTU" : existing.statusSla;

	await db
		.update(incidents)
		.set({
			status: "SELESAI",
			statusSla,
			buktiFotoUrl,
			catatanPenyelesaian: catatan?.trim() || null,
			terakhirDilihat: now,
			updatedAt: now,
		})
		.where(eq(incidents.id, insidenId));

	const camera = await ambilKamera(existing.cameraId);

	await db.insert(auditLog).values({
		id: generateId(10),
		waktu: now,
		pengguna: actor?.nama ?? "petugas",
		peran: actor?.peran ?? "petugas_lapangan",
		tindakan: "Insiden diselesaikan",
		rincian: catatan?.trim()
			? `Insiden ${insidenId} (${existing.labelSampah}) di ${camera?.nama ?? existing.cameraId} ditandai selesai. Catatan petugas: ${catatan.trim()}`
			: `Insiden ${insidenId} (${existing.labelSampah}) di ${camera?.nama ?? existing.cameraId} ditandai selesai`,
		wilayah: camera?.kota ?? "",
		tipe: "TUGAS_PETUGAS",
		incidentId: insidenId,
	});

	if (existing.petugasDitugaskan) await bebaskanPetugasJikaMenganggur(existing.petugasDitugaskan);

	const [updated] = await db.select().from(incidents).where(eq(incidents.id, insidenId));
	const petugasNama = await namaPetugas(updated.petugasDitugaskan);
	return insidenFromRow(updated, camera, petugasNama);
}

/** Tandai insiden sebagai deteksi AI yang keliru -- tidak perlu bukti foto penanganan. */
export async function tandaiPositifPalsu(
	insidenId: string,
	actor?: { nama: string; peran: string }
): Promise<Insiden | null> {
	const [existing] = await db.select().from(incidents).where(eq(incidents.id, insidenId));
	if (!existing) return null;

	const now = new Date();
	await db
		.update(incidents)
		.set({ status: "POSITIF_PALSU", terakhirDilihat: now, updatedAt: now })
		.where(eq(incidents.id, insidenId));

	const camera = await ambilKamera(existing.cameraId);

	await db.insert(auditLog).values({
		id: generateId(10),
		waktu: now,
		pengguna: actor?.nama ?? "operator",
		peran: actor?.peran ?? "operator",
		tindakan: "Insiden ditandai positif palsu",
		rincian: `Insiden ${insidenId} (${existing.labelSampah}) di ${camera?.nama ?? existing.cameraId} ditandai sebagai deteksi AI yang keliru`,
		wilayah: camera?.kota ?? "",
		tipe: "UBAH_STATUS",
		incidentId: insidenId,
	});

	if (existing.petugasDitugaskan) await bebaskanPetugasJikaMenganggur(existing.petugasDitugaskan);

	const [updated] = await db.select().from(incidents).where(eq(incidents.id, insidenId));
	const petugasNama = await namaPetugas(updated.petugasDitugaskan);
	return insidenFromRow(updated, camera, petugasNama);
}

/** Tugaskan (atau ganti) petugas lapangan untuk sebuah insiden aktif. */
export async function tugaskanPetugas(
	insidenId: string,
	petugasId: string,
	actor?: { nama: string; peran: string }
): Promise<Insiden | null> {
	const [existing] = await db.select().from(incidents).where(eq(incidents.id, insidenId));
	if (!existing) return null;
	const [petugas] = await db.select().from(officers).where(eq(officers.id, petugasId));
	if (!petugas) return null;

	const now = new Date();
	await db
		.update(incidents)
		.set({ petugasDitugaskan: petugasId, updatedAt: now })
		.where(eq(incidents.id, insidenId));
	await db
		.update(officers)
		.set({ status: "SEDANG_BERTUGAS", updatedAt: now })
		.where(eq(officers.id, petugasId));

	const camera = await ambilKamera(existing.cameraId);

	await db.insert(auditLog).values({
		id: generateId(10),
		waktu: now,
		pengguna: actor?.nama ?? "operator",
		peran: actor?.peran ?? "operator",
		tindakan: "Petugas ditugaskan",
		rincian: `${petugas.nama} ditugaskan ke insiden ${insidenId} (${existing.labelSampah}) di ${camera?.nama ?? existing.cameraId}`,
		wilayah: camera?.kota ?? "",
		tipe: "TUGAS_PETUGAS",
		incidentId: insidenId,
	});

	// Petugas yang digantikan (kalau ada) dilepas dari "sedang bertugas" jika
	// sudah tidak punya insiden terbuka lain.
	if (existing.petugasDitugaskan && existing.petugasDitugaskan !== petugasId) {
		await bebaskanPetugasJikaMenganggur(existing.petugasDitugaskan);
	}

	const [updated] = await db.select().from(incidents).where(eq(incidents.id, insidenId));
	const petugasNama = await namaPetugas(updated.petugasDitugaskan);
	return insidenFromRow(updated, camera, petugasNama);
}

async function bebaskanPetugasJikaMenganggur(petugasId: string): Promise<void> {
	const [{ jumlah }] = await db
		.select({ jumlah: countAll })
		.from(incidents)
		.where(
			and(
				eq(incidents.petugasDitugaskan, petugasId),
				inArray(incidents.status, ["AKTIF", "PERINGATAN"])
			)
		);
	if (jumlah === 0) {
		await db
			.update(officers)
			.set({ status: "SIAP_TUGAS", updatedAt: new Date() })
			.where(eq(officers.id, petugasId));
	}
}

async function hitungSkorWilayah(): Promise<SkorKebersihanWilayah[]> {
	const rows = await db
		.select({
			kecamatan: cameras.kecamatan,
			kota: cameras.kota,
			jumlahInsiden: countAll,
			rataRataDurasiJam: sql<number>`coalesce(avg(extract(epoch from (${incidents.terakhirDilihat} - ${incidents.pertamaDilihat})) / 3600), 0)`,
		})
		.from(cameras)
		.leftJoin(incidents, eq(incidents.cameraId, cameras.id))
		.groupBy(cameras.kecamatan, cameras.kota);

	const scored = rows
		.filter((r): r is typeof r & { kecamatan: string } => !!r.kecamatan)
		.map((r) => {
			const durasi = Number(r.rataRataDurasiJam);
			const skor = Math.min(100, Math.max(0, Math.round(100 - r.jumlahInsiden * 5 - durasi)));
			return {
				peringkat: 0,
				kelurahan: "",
				kecamatan: r.kecamatan,
				kabupatenKota: r.kota,
				provinsi: kotaKeProvinsi(r.kota),
				jumlahInsiden: r.jumlahInsiden,
				rataRataDurasiSampahJam: Math.round(durasi * 10) / 10,
				skorKebersihan: skor,
				// Butuh histori skor harian untuk tren beneran -- lihat catatan di
				// atas file ini. Netral, bukan dikarang.
				tren: "stabil" as const,
				persentaseTren: 0,
			};
		})
		.sort((a, b) => b.skorKebersihan - a.skorKebersihan);

	return scored.map((r, i) => ({ ...r, peringkat: i + 1 }));
}

export async function listSkorWilayah(): Promise<SkorKebersihanWilayah[]> {
	return hitungSkorWilayah();
}

export async function listLeaderboardExpanded(): Promise<SkorKebersihanWilayah[]> {
	return hitungSkorWilayah();
}

export async function listPetugas(): Promise<PetugasLapangan[]> {
	const rows = await db.select().from(officers).orderBy(officers.nama);

	const openCounts = await db
		.select({ petugasId: incidents.petugasDitugaskan, jumlah: countAll })
		.from(incidents)
		.where(
			and(
				inArray(incidents.status, ["AKTIF", "PERINGATAN"]),
				isNotNull(incidents.petugasDitugaskan)
			)
		)
		.groupBy(incidents.petugasDitugaskan);

	const countMap = new Map(openCounts.map((c) => [c.petugasId, c.jumlah]));

	return rows.map((o) => ({
		id: o.id,
		nama: o.nama,
		peran: o.peran,
		telepon: o.telepon,
		wilayahTugas: o.wilayahTugas,
		status: o.status,
		jumlahTugasAktif: countMap.get(o.id) ?? 0,
		avatar: o.avatar ?? undefined,
		userId: o.userId ?? undefined,
	}));
}

/**
 * Data untuk halaman "Tugas Saya" (/dashboard/tugas-saya): insiden yang
 * ditugaskan ke petugas yang login, dipisah antara yang masih terbuka dan
 * riwayat yang sudah ditangani. `officer` bernilai `null` kalau akun login
 * ini belum dihubungkan ke roster petugas manapun (lihat `officers.userId`,
 * dihubungkan lewat halaman admin /dashboard/officers).
 */
export async function listTugasPetugas(
	userId: string
): Promise<{ officer: PetugasLapangan | null; tugasAktif: Insiden[]; riwayat: Insiden[] }> {
	const [officerRow] = await db.select().from(officers).where(eq(officers.userId, userId));
	if (!officerRow) return { officer: null, tugasAktif: [], riwayat: [] };

	const semuaPetugas = await listPetugas();
	const officer = semuaPetugas.find((p) => p.id === officerRow.id) ?? null;

	const rows = await db
		.select({ incident: incidents, camera: cameras })
		.from(incidents)
		.leftJoin(cameras, eq(incidents.cameraId, cameras.id))
		.where(eq(incidents.petugasDitugaskan, officerRow.id))
		.orderBy(desc(incidents.terakhirDilihat));

	const semua = rows.map(({ incident, camera }) =>
		insidenFromRow(incident, camera, officerRow.nama)
	);
	return {
		officer,
		tugasAktif: semua.filter((i) => i.status === "AKTIF" || i.status === "PERINGATAN"),
		riwayat: semua
			.filter((i) => i.status === "SELESAI" || i.status === "POSITIF_PALSU")
			.slice(0, 20),
	};
}

/** Detail + timeline satu insiden untuk /dashboard/incidents/[id]. */
export async function getInsidenDetail(
	insidenId: string
): Promise<{ insiden: Insiden; riwayat: RiwayatInsidenEntry[] } | null> {
	const [row] = await db
		.select({ incident: incidents, camera: cameras, petugas: officers })
		.from(incidents)
		.leftJoin(cameras, eq(incidents.cameraId, cameras.id))
		.leftJoin(officers, eq(incidents.petugasDitugaskan, officers.id))
		.where(eq(incidents.id, insidenId));
	if (!row) return null;

	const insiden = insidenFromRow(row.incident, row.camera, row.petugas?.nama);

	const logRows = await db
		.select()
		.from(auditLog)
		.where(eq(auditLog.incidentId, insidenId))
		.orderBy(auditLog.waktu);

	const riwayat: RiwayatInsidenEntry[] = [
		{
			id: `${insidenId}-terdeteksi`,
			waktu: row.incident.pertamaDilihat.toISOString(),
			pengguna: "sistem",
			peran: "SISTEM",
			tindakan: "Terdeteksi pertama kali",
			rincian:
				row.incident.sumber === "LAPORAN_WARGA"
					? `Dilaporkan warga di ${row.incident.lokasiTeks ?? "lokasi terlampir"}, lalu diverifikasi operator`
					: `Deteksi AI (${row.incident.labelSampah}, kepercayaan ${Math.round(Number(row.incident.tingkatKepercayaan) * 100)}%) di ${row.camera?.nama ?? "kamera tidak diketahui"}`,
			tipe: row.incident.sumber === "LAPORAN_WARGA" ? "LAPORAN_WARGA" : "DETEKSI_AI",
		},
		...logRows.map((r) => ({
			id: r.id,
			waktu: r.waktu.toISOString(),
			pengguna: r.pengguna,
			peran: r.peran,
			tindakan: r.tindakan,
			rincian: r.rincian,
			tipe: r.tipe,
		})),
	];

	return { insiden, riwayat };
}

export async function listTrenSampah(): Promise<TrenSampahJam[]> {
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);

	const jamExpr = sql<string>`to_char(${incidents.pertamaDilihat}, 'HH24:00')`;
	const rows = await db
		.select({
			jam: jamExpr,
			insidenAktif: sql<number>`count(*) filter (where ${incidents.status} in ('AKTIF', 'PERINGATAN'))::int`,
			insidenSelesai: sql<number>`count(*) filter (where ${incidents.status} = 'SELESAI')::int`,
		})
		.from(incidents)
		.where(gte(incidents.pertamaDilihat, startOfDay))
		.groupBy(jamExpr)
		.orderBy(jamExpr);

	return rows.map((r) => ({
		jam: r.jam,
		insidenAktif: r.insidenAktif,
		insidenSelesai: r.insidenSelesai,
		// Pipeline vision-only (bounding box), belum ada estimasi berat.
		volumeSampahKg: 0,
	}));
}

export async function listAuditLog(): Promise<LogAuditSistem[]> {
	const rows = await db.select().from(auditLog).orderBy(desc(auditLog.waktu)).limit(200);
	return rows.map((r) => ({
		id: r.id,
		waktu: r.waktu.toISOString(),
		pengguna: r.pengguna,
		peran: r.peran,
		tindakan: r.tindakan,
		rincian: r.rincian,
		wilayah: r.wilayah,
		tipe: r.tipe,
	}));
}

/** Data dashboard eksekutif (kepala dinas/walikota) — KPI ringkas + tren + leaderboard. */
export async function listEksekutifKpi(): Promise<EksekutifKpiStats> {
	const skorList = await hitungSkorWilayah();
	const skorRataRata = skorList.length
		? Math.round(skorList.reduce((sum, r) => sum + r.skorKebersihan, 0) / skorList.length)
		: 100;

	const [insidenAktifRow] = await db
		.select({ jumlah: countAll })
		.from(incidents)
		.where(inArray(incidents.status, ["AKTIF", "PERINGATAN"]));
	const [slaRow] = await db
		.select({ jumlah: countAll })
		.from(incidents)
		.where(eq(incidents.statusSla, "MELANGGAR_SLA"));
	const [totalRow] = await db.select({ jumlah: countAll }).from(incidents);

	const persentaseSlaMelanggar =
		totalRow.jumlah > 0 ? Math.round((slaRow.jumlah / totalRow.jumlah) * 100) : 0;

	return {
		skorRataRata,
		kategoriSkor: skorRataRata >= 80 ? "Baik" : skorRataRata >= 60 ? "Cukup" : "Perlu Perhatian",
		// Butuh histori KPI harian untuk delta beneran -- lihat catatan di atas.
		trenSkor: "+0.0%",
		insidenAktif: insidenAktifRow.jumlah,
		trenInsiden: "+0.0%",
		persentaseSlaMelanggar,
		trenSla: "+0.0%",
		indeksTrenMingguan: "+0.0%",
	};
}

export async function listKecamatanList(): Promise<string[]> {
	const rows = await db.select({ kecamatan: cameras.kecamatan }).from(cameras);
	return [...new Set(rows.map((r) => r.kecamatan).filter((k): k is string => !!k))].sort();
}

const NAMED_KECAMATAN = [
	"lengkong",
	"cicendo",
	"regol",
	"coblong",
	"andir",
	"bandungWetan",
] as const;
const NAMED_KECAMATAN_LABEL: Record<(typeof NAMED_KECAMATAN)[number], string> = {
	lengkong: "Lengkong",
	cicendo: "Cicendo",
	regol: "Regol",
	coblong: "Coblong",
	andir: "Andir",
	bandungWetan: "Bandung Wetan",
};

/**
 * `TrenSkorKecamatan` is a fixed 6-kecamatan shape from before the real
 * 14-camera Bandung selection was seeded (see file-level comment). Kecamatan
 * with no seeded camera honestly score 0 rather than a fabricated number.
 */
async function hitungTrenKecamatan(
	steps: number,
	stepDate: (i: number) => Date,
	label: (d: Date) => string
): Promise<TrenSkorKecamatan[]> {
	const skorByKecamatan = new Map(
		(await hitungSkorWilayah()).map((s) => [s.kecamatan, s.skorKebersihan])
	);
	const rataRataKota = skorByKecamatan.size
		? Math.round([...skorByKecamatan.values()].reduce((a, b) => a + b, 0) / skorByKecamatan.size)
		: 100;

	const out: TrenSkorKecamatan[] = [];
	for (let i = steps - 1; i >= 0; i--) {
		const entry: TrenSkorKecamatan = {
			label: label(stepDate(i)),
			rataRataKota,
			lengkong: 0,
			cicendo: 0,
			regol: 0,
			coblong: 0,
			andir: 0,
			bandungWetan: 0,
		};
		for (const key of NAMED_KECAMATAN) {
			entry[key] = skorByKecamatan.get(NAMED_KECAMATAN_LABEL[key]) ?? 0;
		}
		out.push(entry);
	}
	return out;
}

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export async function listTrenKecamatanMingguan(): Promise<TrenSkorKecamatan[]> {
	return hitungTrenKecamatan(
		7,
		(i) => {
			const d = new Date();
			d.setDate(d.getDate() - i);
			return d;
		},
		(d) => HARI[d.getDay()]
	);
}

export async function listTrenKecamatanBulanan(): Promise<TrenSkorKecamatan[]> {
	// 12 kalender bulan berbeda (bukan 12 hari) -- lompat per bulan lewat
	// setMonth, bukan setDate, supaya label bulan tidak dobel.
	return hitungTrenKecamatan(
		12,
		(i) => {
			const d = new Date();
			d.setDate(1); // hindari overflow tanggal saat mundur lintas bulan (mis. 31 Mar -> 3 Mar)
			d.setMonth(d.getMonth() - i);
			return d;
		},
		(d) => BULAN[d.getMonth()]
	);
}

/** KPI domain NOVIRA — diturunkan dari data kamera/insiden (bukan DB user). */
export async function ringkasanKpi() {
	const kamera = await db.select().from(cameras);
	const cctvOnline = kamera.filter((c) => c.status === "ONLINE").length;
	const totalCctv = kamera.length;

	const [insidenAktifRow] = await db
		.select({ jumlah: countAll })
		.from(incidents)
		.where(eq(incidents.status, "AKTIF"));
	const [slaRow] = await db
		.select({ jumlah: countAll })
		.from(incidents)
		.where(eq(incidents.statusSla, "MELANGGAR_SLA"));

	return {
		insidenAktif: insidenAktifRow.jumlah,
		cctvOnline,
		totalCctv,
		persentaseUptimeCctv: totalCctv === 0 ? 0 : Math.round((cctvOnline / totalCctv) * 100),
		// Pipeline vision-only (bounding box), belum ada estimasi berat.
		volumeSampahHariIniKg: 0,
		slaMelanggar: slaRow.jumlah,
	};
}
