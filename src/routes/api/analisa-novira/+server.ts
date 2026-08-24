import { error, json } from "@sveltejs/kit";
import { analisaGambarNovira, noviraSiap } from "$lib/server/novira/modelNovira.js";
import { validateUpload } from "$lib/server/uploads.js";
import type { RequestHandler } from "./$types.js";

/**
 * Endpoint analisa foto dengan Model Novira.
 *
 * Model pLitter dipanggil langsung dari browser (lihat `plitter-client.ts`),
 * tapi Model Novira TIDAK bisa: kuncinya rahasia dan pemakaiannya berbiaya,
 * jadi panggilannya harus lewat server. Bentuk request/response-nya sengaja
 * dibuat menyerupai `/detect/image` pLitter supaya sisi klien cukup mengganti
 * tujuan, bukan seluruh alurnya.
 *
 * Terbuka tanpa sesi karena form laporan warga (/lapor) memakainya juga --
 * karena itu ada batas laju per-IP di bawah.
 */

const JENDELA_MS = 5 * 60_000;
const MAKS_PER_JENDELA = 10;
const pemakaian = new Map<string, number[]>();

function lewatBatas(ip: string): boolean {
	const sekarang = Date.now();
	const riwayat = (pemakaian.get(ip) ?? []).filter((t) => sekarang - t < JENDELA_MS);
	if (riwayat.length >= MAKS_PER_JENDELA) {
		pemakaian.set(ip, riwayat);
		return true;
	}
	riwayat.push(sekarang);
	pemakaian.set(ip, riwayat);

	// Buang entri IP lain yang sudah kedaluwarsa supaya map tidak tumbuh terus
	// selama proses hidup.
	if (pemakaian.size > 500) {
		for (const [key, waktu] of pemakaian) {
			if (waktu.every((t) => sekarang - t >= JENDELA_MS)) pemakaian.delete(key);
		}
	}
	return false;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!noviraSiap()) {
		error(503, "Model Novira belum dikonfigurasi pada server ini.");
	}
	if (lewatBatas(getClientAddress())) {
		error(429, "Terlalu banyak permintaan analisa — coba lagi beberapa menit lagi.");
	}

	const form = await request.formData();
	const file = form.get("file");
	if (!(file instanceof File) || file.size === 0) {
		error(400, "Tidak ada berkas gambar yang dikirim.");
	}
	const pesanValidasi = validateUpload(file, "foto");
	if (pesanValidasi) error(400, pesanValidasi);

	const confThresRaw = Number(form.get("conf_thres"));
	const confThres =
		Number.isFinite(confThresRaw) && confThresRaw > 0 && confThresRaw <= 1 ? confThresRaw : 0.2;

	try {
		const hasil = await analisaGambarNovira(new Uint8Array(await file.arrayBuffer()), {
			confThres,
		});
		return json({
			filename: file.name,
			model_type: "novira",
			width: hasil.width,
			height: hasil.height,
			detections: hasil.detections,
			annotated_image_base64: hasil.annotated_image_base64,
		});
	} catch (err) {
		const pesan = err instanceof Error ? err.message : String(err);
		console.error("[novira] Analisa Model Novira gagal:", pesan);
		error(502, `Analisa Model Novira gagal: ${pesan.slice(0, 200)}`);
	}
};
