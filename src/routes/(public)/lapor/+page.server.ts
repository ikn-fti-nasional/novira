import { fail, redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db/index.js";
import { publicReports } from "$lib/server/db/schema.js";
import { storeUpload, validateUpload } from "$lib/server/uploads.js";
import { generateId } from "$lib/server/id.js";
import type { Actions, PageServerLoad } from "./$types.js";

const RATE_LIMIT_MS = 30_000;
const recentSubmissions = new Map<string, number>();

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const ip = getClientAddress();
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
			if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
				return fail(400, { message: "Koordinat lokasi tidak valid." });
			}
			latitude = latRaw;
			longitude = lonRaw;
		} else if (!kota) {
			return fail(400, { message: "Lokasi wajib diisi — izinkan GPS atau pilih kota." });
		}

		const urlFoto = punyaFoto ? await storeUpload(foto as File, "foto") : null;
		const urlVideo = punyaVideo ? await storeUpload(video as File, "video") : null;

		await db.insert(publicReports).values({
			id: generateId(16),
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

		redirect(303, "/lapor/berhasil");
	},
};
