/**
 * Skrip sekali-jalan: hitung skor prioritas untuk insiden yang sudah ada di
 * database sebelum mesin prioritas dipasang.
 *
 * Tanpa ini, seluruh insiden lama berskor 0 dan tenggelam di dasar antrian —
 * terlihat seperti fitur prioritasnya tidak bekerja. Aman diulang: skornya
 * dihitung dari data insiden itu sendiri, jadi menjalankannya dua kali
 * menghasilkan angka yang sama.
 *
 *     npx tsx scripts/backfill-prioritas.ts
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/lib/server/db/index.js";
import { cameras, incidents } from "../src/lib/server/db/schema.js";
import { hitungPrioritas, serializeRincian } from "../src/lib/server/novira/prioritas.js";

async function main() {
	const rows = await db
		.select({ incident: incidents, camera: cameras })
		.from(incidents)
		.leftJoin(cameras, eq(incidents.cameraId, cameras.id));

	let n = 0;
	for (const { incident, camera } of rows) {
		const kekambuhan = incident.cameraId
			? ((
					await db
						.select({ jumlah: sql<number>`count(*)::int` })
						.from(incidents)
						.where(and(eq(incidents.cameraId, incident.cameraId), eq(incidents.status, "SELESAI")))
				)[0]?.jumlah ?? 0)
			: 0;

		const prioritas = hitungPrioritas({
			jenisSampah: incident.jenisSampah,
			durasiJam:
				(incident.terakhirDilihat.getTime() - incident.pertamaDilihat.getTime()) / 3600_000,
			tingkatKepercayaan: Number(incident.tingkatKepercayaan),
			teksLokasi: [camera?.nama, camera?.kecamatan, camera?.kota, incident.lokasiTeks]
				.filter(Boolean)
				.join(" "),
			kekambuhan,
			laporanWargaMenguatkan: 0,
			dariLaporanWarga: incident.sumber === "LAPORAN_WARGA",
		});

		await db
			.update(incidents)
			.set({
				skorPrioritas: prioritas.skor,
				rincianPrioritas: serializeRincian(prioritas.rincian),
				keparahan: prioritas.keparahan,
			})
			.where(eq(incidents.id, incident.id));
		n++;
	}

	console.log(`Selesai — ${n} insiden dihitung ulang skor prioritasnya.`);
	process.exit(0);
}

main().catch((err) => {
	console.error("Backfill gagal:", err);
	process.exit(1);
});
