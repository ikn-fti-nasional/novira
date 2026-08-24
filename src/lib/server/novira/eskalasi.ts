import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "$lib/server/db/index.js";
import {
	auditLog,
	cameras,
	incidents,
	notifications,
	officers,
	users,
} from "$lib/server/db/schema.js";
import { generateId } from "$lib/server/id.js";
import type { Role } from "$lib/authorize.js";
import { formatDurasi, hitungPrioritas, serializeRincian } from "./prioritas.js";

/**
 * Tangga eskalasi SLA.
 *
 * Sebelum ini `statusSla` dihitung rapi lalu tidak dipakai untuk apa pun —
 * insiden bisa melanggar SLA berhari-hari tanpa seorang pun diberi tahu, yang
 * membuat SLA-nya sekadar hiasan laporan. Cron ini memberi SLA konsekuensi:
 * setiap ambang waktu terlewat, insiden naik ke jenjang jabatan berikutnya.
 *
 * Dua sifat yang dijaga supaya aman dijalankan berulang tiap jam:
 *
 * 1. **Monoton** — `tingkatEskalasi` hanya naik. Cron yang jalan 24× sehari
 *    tidak akan mengirim notifikasi yang sama 24×.
 * 2. **Idempoten per jenjang** — notifikasi dikirim tepat sekali saat
 *    perpindahan jenjang terjadi, bukan setiap kali ambangnya masih terlewat.
 */

interface Jenjang {
	tingkat: number;
	ambangJam: number;
	/** Peran yang diberi tahu pada jenjang ini. Kosong = notifikasi ke petugas terkait saja. */
	peranTujuan: readonly Role[];
	judul: string;
	statusSla: "HAMPIR_BREACH" | "MELANGGAR_SLA";
}

type UserRole = (typeof users.$inferSelect)["role"];

/**
 * Ambang 12/24/48 jam mengikuti SLA operasional yang sudah dipakai siklus
 * deteksi (`deteksi.ts`): 12 jam hampir breach, 24 jam melanggar. Jenjang 48
 * jam ditambahkan di sini sebagai batas "sudah tidak bisa diselesaikan di
 * level seksi".
 */
const JENJANG: readonly Jenjang[] = [
	{
		tingkat: 1,
		ambangJam: 12,
		peranTujuan: ["operator"],
		judul: "Pengingat SLA 12 jam",
		statusSla: "HAMPIR_BREACH",
	},
	{
		tingkat: 2,
		ambangJam: 24,
		peranTujuan: ["kepala_seksi"],
		judul: "SLA terlampaui — eskalasi ke Kepala Seksi",
		statusSla: "MELANGGAR_SLA",
	},
	{
		tingkat: 3,
		ambangJam: 48,
		peranTujuan: ["kepala_dinas", "walikota"],
		judul: "SLA terlampaui 48 jam — eskalasi ke Kepala Dinas",
		statusSla: "MELANGGAR_SLA",
	},
];

export interface RingkasanEskalasi {
	diperiksa: number;
	dieskalasi: number;
	perJenjang: Record<number, number>;
}

/** Jenjang tertinggi yang ambangnya sudah terlewat, atau `null` kalau belum ada. */
function jenjangUntuk(durasiJam: number): Jenjang | null {
	let hasil: Jenjang | null = null;
	for (const j of JENJANG) if (durasiJam >= j.ambangJam) hasil = j;
	return hasil;
}

export async function jalankanEskalasiSla(sekarang = new Date()): Promise<RingkasanEskalasi> {
	const terbuka = await db
		.select({ incident: incidents, camera: cameras, petugas: officers })
		.from(incidents)
		.leftJoin(cameras, eq(incidents.cameraId, cameras.id))
		.leftJoin(officers, eq(incidents.petugasDitugaskan, officers.id))
		.where(inArray(incidents.status, ["AKTIF", "PERINGATAN"]));

	const ringkasan: RingkasanEskalasi = { diperiksa: terbuka.length, dieskalasi: 0, perJenjang: {} };

	// Cache penerima per peran sekali — hindari N+1 query `select users where role in` per insiden.
	const semuaPeran = [...new Set(JENJANG.flatMap((j) => [...j.peranTujuan]))] as Role[];
	const penerimaByRole = new Map<Role, string[]>();
	if (semuaPeran.length > 0) {
		const rows = await db
			.select({ id: users.id, role: users.role })
			.from(users)
			.where(inArray(users.role, semuaPeran as UserRole[]));
		for (const r of rows) {
			const arr = penerimaByRole.get(r.role as Role) ?? [];
			arr.push(r.id);
			penerimaByRole.set(r.role as Role, arr);
		}
	}

	for (const { incident, camera, petugas } of terbuka) {
		const durasiJam = (sekarang.getTime() - incident.pertamaDilihat.getTime()) / 3600_000;
		const jenjang = jenjangUntuk(durasiJam);
		if (!jenjang || jenjang.tingkat <= incident.tingkatEskalasi) continue;

		const lokasi = camera?.nama ?? incident.lokasiTeks ?? "lokasi tidak diketahui";
		const wilayah = camera?.kota ?? "";

		// Prioritas dihitung ulang di sini karena faktor durasi sudah berubah —
		// insiden yang mandek harus benar-benar naik ke atas antrian operator,
		// bukan cuma memicu notifikasi lalu tetap tenggelam di urutan bawah.
		const prioritas = hitungPrioritas({
			jenisSampah: incident.jenisSampah,
			durasiJam,
			tingkatKepercayaan: Number(incident.tingkatKepercayaan),
			teksLokasi: [lokasi, camera?.kecamatan, incident.lokasiTeks].filter(Boolean).join(" "),
			kekambuhan: 0,
			laporanWargaMenguatkan: 0,
			dariLaporanWarga: incident.sumber === "LAPORAN_WARGA",
		});

		const pesan =
			`Insiden ${incident.id} (${incident.labelSampah}) di ${lokasi} belum selesai setelah ` +
			`${formatDurasi(durasiJam)}.` +
			(petugas ? ` Ditugaskan ke ${petugas.nama}.` : " Belum ada petugas yang ditugaskan.");

		// Atomik per insiden: update status + notifikasi peran + notifikasi petugas + audit log
		// harus sukses bersama — kalau tidak, retry cron bisa duplikat notifikasi.
		const didUpdate = await db.transaction(async (tx) => {
			const result = await tx
				.update(incidents)
				.set({
					tingkatEskalasi: jenjang.tingkat,
					terakhirEskalasiPada: sekarang,
					statusSla: jenjang.statusSla,
					status: "PERINGATAN",
					keparahan: prioritas.keparahan,
					skorPrioritas: prioritas.skor,
					rincianPrioritas: serializeRincian(prioritas.rincian),
					updatedAt: sekarang,
				})
				.where(and(eq(incidents.id, incident.id), lt(incidents.tingkatEskalasi, jenjang.tingkat)))
				.returning({ id: incidents.id });

			// Hanya lanjutkan notifikasi & audit bila update benar-benar mengubah baris.
			if (result.length === 0) return false;

			const peranIds: string[] = [];
			for (const peran of jenjang.peranTujuan) {
				const ids = penerimaByRole.get(peran);
				if (ids) peranIds.push(...ids);
			}
			if (peranIds.length > 0) {
				await tx.insert(notifications).values(
					peranIds.map((uid) => ({
						id: generateId(10),
						userId: uid,
						title: jenjang.judul,
						message: pesan,
						type: (jenjang.tingkat >= 2 ? "error" : "warning") as "error" | "warning",
					}))
				);
			}

			// Petugas yang sedang memegang insiden ini selalu ikut diberi tahu di
			// setiap jenjang — merekalah yang bisa langsung bertindak.
			if (petugas?.userId) {
				await tx.insert(notifications).values({
					id: generateId(10),
					userId: petugas.userId,
					title: jenjang.judul,
					message: pesan,
					type: jenjang.tingkat >= 2 ? "error" : "warning",
				});
			}

			await tx.insert(auditLog).values({
				id: generateId(10),
				waktu: sekarang,
				pengguna: "sistem",
				peran: "SISTEM",
				tindakan: `Eskalasi SLA jenjang ${jenjang.tingkat}`,
				rincian: `${pesan} Diteruskan ke: ${jenjang.peranTujuan.join(", ")}. Prioritas naik ke ${prioritas.skor}/100.`,
				wilayah,
				tipe: "ESKALASI",
				incidentId: incident.id,
			});
			return true;
		});

		if (!didUpdate) continue;
		ringkasan.dieskalasi++;
		ringkasan.perJenjang[jenjang.tingkat] = (ringkasan.perJenjang[jenjang.tingkat] ?? 0) + 1;
	}

	return ringkasan;
}

/** Ringkasan eskalasi aktif untuk kartu dashboard — berapa insiden mandek di tiap jenjang. */
export async function ringkasanEskalasiAktif() {
	const rows = await db
		.select({ tingkat: incidents.tingkatEskalasi, id: incidents.id })
		.from(incidents)
		.where(and(inArray(incidents.status, ["AKTIF", "PERINGATAN"])));

	const perJenjang = { 1: 0, 2: 0, 3: 0 };
	for (const r of rows) {
		if (r.tingkat >= 1 && r.tingkat <= 3) perJenjang[r.tingkat as 1 | 2 | 3]++;
	}
	return {
		total: rows.length,
		diingatkan: perJenjang[1],
		kepalaSeksi: perJenjang[2],
		kepalaDinas: perJenjang[3],
	};
}
