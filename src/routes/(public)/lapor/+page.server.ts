import { fail, redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db/index.js";
import { publicReports } from "$lib/server/db/schema.js";
import {
	storeAnnotatedImage,
	storeUpload,
	validateUpload,
	UploadValidationError,
} from "$lib/server/uploads.js";
import { generateId } from "$lib/server/id.js";
import { buatKodeTracking, simpanHasilPindaiKlien } from "$lib/server/novira/laporan.js";
import type { DeteksiKlien } from "$lib/server/novira/laporan.js";
import type { Actions, PageServerLoad } from "./$types.js";

const RATE_LIMIT_MS = 30_000;
const recentSubmissions = new Map<string, number>();

// Map ini hanya menyimpan "IP → kirim terakhir"; entri lebih tua dari jendela
// rate-limit tidak berguna lagi, tapi tanpa dibersihkan ia tumbuh tanpa batas
// seiring IP publik yang lewat. ponytail: in-memory per-instance — ganti ke
// store bersama (DB/Redis) saat scale-out multi-instance.
function pruneRecentSubmissions(): void {
	if (recentSubmissions.size < 1000) return;
	const now = Date.now();
	for (const [ip, waktu] of recentSubmissions) {
		if (now - waktu > RATE_LIMIT_MS) recentSubmissions.delete(ip);
	}
	// Safety cap: kalau masih >5000 setelah prune (mis. flood IP unik),
	// potong oldest agar tidak OOM.
	if (recentSubmissions.size > 5000) {
		const toDelete = recentSubmissions.size - 5000;
		let i = 0;
		for (const key of recentSubmissions.keys()) {
			if (i++ >= toDelete) break;
			recentSubmissions.delete(key);
		}
	}
}

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const ip = getClientAddress();
		pruneRecentSubmissions();
		const last = recentSubmissions.get(ip);
		if (last && Date.now() - last < RATE_LIMIT_MS) {
			return fail(429, {
				message: "Terlalu cepat — coba lagi dalam beberapa detik.",
			});
		}

		const form = await request.formData();

		// Honeypot: field tersembunyi, bot biasanya mengisi.
		if (String(form.get("website") ?? "")) {
			return fail(400, { message: "Pengiriman ditolak." });
		}

		const foto = form.get("foto");
		const video = form.get("video");
		const fotoError = foto instanceof File && foto.size > 0 ? validateUpload(foto, "foto") : null;
		const videoError =
			video instanceof File && video.size > 0 ? validateUpload(video, "video") : null;

		const punyaFoto = foto instanceof File && foto.size > 0;
		const punyaVideo = video instanceof File && video.size > 0;

		if (!punyaFoto && !punyaVideo) {
			return fail(400, { message: "Lampirkan minimal satu foto atau video sampah." });
		}
		if (fotoError) return fail(400, { message: fotoError });
		if (videoError) return fail(400, { message: videoError });

		const pelaporNama = String(form.get("pelaporNama") ?? "").trim();
		const pelaporTelepon = String(form.get("pelaporTelepon") ?? "").trim();
		const deskripsi = String(form.get("deskripsi") ?? "").trim();
		const jenisSampah = String(form.get("jenisSampah") ?? "").trim();
		const latRaw = String(form.get("latitude") ?? "").trim();
		const lonRaw = String(form.get("longitude") ?? "").trim();
		const kota = String(form.get("kota") ?? "").trim();
		const kecamatan = String(form.get("kecamatan") ?? "").trim();

		// GPS mode: both coordinates required and finite within valid ranges.
		// City fallback applies only when no coordinates are supplied.
		let latitude: string | null = null;
		let longitude: string | null = null;
		if (latRaw || lonRaw) {
			if (!latRaw || !lonRaw) {
				return fail(400, { message: "Koordinat lokasi tidak valid." });
			}
			const lat = Number(latRaw);
			const lon = Number(lonRaw);
			if (
				!Number.isFinite(lat) ||
				!Number.isFinite(lon) ||
				lat < -90 ||
				lat > 90 ||
				lon < -180 ||
				lon > 180
			) {
				return fail(400, { message: "Koordinat lokasi tidak valid." });
			}
			latitude = latRaw;
			longitude = lonRaw;
		} else if (!kota) {
			return fail(400, { message: "Lokasi wajib diisi — izinkan GPS atau pilih kota." });
		}

		let urlFoto: string | null;
		let urlVideo: string | null;
		try {
			urlFoto = punyaFoto ? await storeUpload(foto as File, "foto") : null;
			urlVideo = punyaVideo ? await storeUpload(video as File, "video") : null;
		} catch (err) {
			if (err instanceof UploadValidationError) {
				return fail(400, { message: err.message });
			}
			throw err;
		}

		const laporanId = generateId(16);
		const kodeTracking = buatKodeTracking();

		await db.insert(publicReports).values({
			id: laporanId,
			kodeTracking,
			pelaporNama: pelaporNama || null,
			pelaporTelepon: pelaporTelepon || null,
			deskripsi: deskripsi || null,
			jenisSampah: jenisSampah || null,
			urlFoto,
			urlVideo,
			latitude,
			longitude,
			kota: kota || null,
			kecamatan: kecamatan || null,
			status: "MENUNGGU",
		});

		recentSubmissions.set(ip, Date.now());

		// Foto sudah dipindai langsung dari browser pelapor ke pLitter (lihat
		// `src/lib/plitter-client.ts`) sebelum form ini dikirim -- server hanya
		// mencatat hasilnya, tidak lagi memanggil pLitter sendiri. Ini murni
		// tulis DB, jadi aman ditunggu tanpa menahan halaman konfirmasi lama.
		try {
			if (punyaFoto) {
				const aiDeteksiRaw = String(form.get("aiDeteksi") ?? "");
				const deteksi = parseAiDeteksi(aiDeteksiRaw);
				const aiFotoAnalisa = form.get("aiFotoAnalisa");
				const annotatedUrl =
					aiFotoAnalisa instanceof File && aiFotoAnalisa.size > 0
						? await storeAnnotatedImage(aiFotoAnalisa).catch((err) => {
								console.error("[novira] Gagal menyimpan foto beranotasi:", err);
								return null;
							})
						: null;
				await simpanHasilPindaiKlien(laporanId, deteksi, { modelType: "street", annotatedUrl });
			} else {
				await simpanHasilPindaiKlien(laporanId, null, {
					modelType: "street",
					alasanGagal: "laporan tidak menyertakan foto",
				});
			}
		} catch (err) {
			console.error("[novira] Gagal mencatat hasil pindai laporan:", err);
		}

		redirect(303, `/lapor/berhasil?kode=${kodeTracking}`);
	},
};

/**
 * `aiDeteksi` datang dari `analisaFotoLangsung()` yang dijalankan di browser
 * pelapor sebelum form ini dikirim -- input tak tepercaya, jadi divalidasi
 * bentuknya sebelum disimpan. Bentuk yang tak terduga (atau field kosong
 * karena pemindaian klien gagal/dilewati) dianggap sama dengan "gagal".
 */
function parseAiDeteksi(raw: string): DeteksiKlien[] | null {
	if (!raw) return null;
	try {
		const data = JSON.parse(raw);
		if (!Array.isArray(data)) return null;
		return data
			.filter(
				(d): d is DeteksiKlien =>
					d && typeof d.className === "string" && typeof d.score === "number"
			)
			.map((d) => ({ className: d.className, score: d.score }));
	} catch {
		return null;
	}
}
