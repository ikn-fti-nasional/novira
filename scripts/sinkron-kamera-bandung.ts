/**
 * Sinkronkan tabel `cameras` dengan registri Bandung terverifikasi.
 *
 * Dipakai untuk memasang registri baru pada database yang sudah berisi data
 * operasional, sebagai ganti `pnpm db:seed` yang akan menghapus seluruh isi
 * database (termasuk insiden dan laporan warga yang sudah terkumpul).
 *
 * Aturannya:
 * - Kamera dicocokkan lewat `urlStream` (unik per perangkat, tidak seperti
 *   nama yang banyak duplikatnya di data sumber).
 * - Kamera baru ditambahkan; yang sudah ada diperbarui metadatanya.
 * - Kamera lama yang tidak lagi ada di registri DIHAPUS hanya bila tidak
 *   punya insiden. Yang punya insiden dipertahankan dan dilaporkan, karena
 *   menghapusnya berarti membuang riwayat penanganan yang sah.
 *
 *     npx tsx scripts/sinkron-kamera-bandung.ts
 */
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../src/lib/server/db/index.js";
import { cameras, incidents } from "../src/lib/server/db/schema.js";
import { generateId } from "../src/lib/server/id.js";
import { KAMERA_BANDUNG } from "../src/lib/server/db/data/kamera-bandung.js";

async function main() {
	const lama = await db.select().from(cameras);
	const lamaByUrl = new Map(lama.map((c) => [c.urlStream ?? "", c]));
	const urlBaru = new Set(KAMERA_BANDUNG.map((c) => c.urlStream));

	let ditambah = 0;
	let diperbarui = 0;

	for (const k of KAMERA_BANDUNG) {
		const ada = lamaByUrl.get(k.urlStream);
		const nilai = {
			nama: k.nama,
			kota: "Kota Bandung",
			kecamatan: k.kecamatan,
			kelurahan: k.kelurahan,
			latitude: k.latitude,
			longitude: k.longitude,
			urlStream: k.urlStream,
			updatedAt: new Date(),
		};
		if (ada) {
			await db.update(cameras).set(nilai).where(eq(cameras.id, ada.id));
			diperbarui++;
		} else {
			await db.insert(cameras).values({ id: generateId(10), status: "ONLINE", ...nilai });
			ditambah++;
		}
	}

	const usang = lama.filter((c) => !urlBaru.has(c.urlStream ?? ""));
	const dipakai = usang.length
		? await db
				.select({ cameraId: incidents.cameraId, jumlah: sql<number>`count(*)::int` })
				.from(incidents)
				.where(inArray(incidents.cameraId, usang.map((c) => c.id)))
				.groupBy(incidents.cameraId)
		: [];
	const punyaInsiden = new Map(dipakai.map((d) => [d.cameraId, d.jumlah]));

	let dihapus = 0;
	const dipertahankan: string[] = [];
	for (const c of usang) {
		if (punyaInsiden.has(c.id)) {
			dipertahankan.push(`${c.nama} (${c.kota}) — ${punyaInsiden.get(c.id)} insiden`);
			continue;
		}
		await db.delete(cameras).where(eq(cameras.id, c.id));
		dihapus++;
	}

	const [total] = await db.select({ n: sql<number>`count(*)::int` }).from(cameras);
	console.log(`Ditambah    : ${ditambah}`);
	console.log(`Diperbarui  : ${diperbarui}`);
	console.log(`Dihapus     : ${dihapus} kamera usang tanpa insiden`);
	console.log(`Dipertahankan: ${dipertahankan.length} kamera usang yang masih punya insiden`);
	for (const d of dipertahankan) console.log(`  - ${d}`);
	console.log(`Total kamera di database sekarang: ${total.n}`);
	process.exit(0);
}

main().catch((err) => {
	console.error("Sinkronisasi gagal:", err);
	process.exit(1);
});
