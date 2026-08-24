import { db } from "$lib/server/db/index.js";
import { auditLog, incidents, publicReports } from "$lib/server/db/schema.js";
import { requireRoleOrRedirect, requireRoleOrFail, OPERATIONAL_ROLES } from "$lib/authorize.js";
import { fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { generateId } from "$lib/server/id.js";
import {
	listAntrianTriase,
	pindaiLaporan,
	tandaiDuplikat,
	tolakLaporan,
	verifikasiLaporan,
	type AktorTriase,
} from "$lib/server/novira/laporan.js";
import { MODEL_TYPES_TERSEDIA, type ModelTypeDeteksi } from "$lib/server/novira/deteksi.js";
import { ringkasanTriase } from "$lib/server/novira/analitik.js";
import { parseRincian } from "$lib/server/novira/prioritas.js";
import type { Actions, PageServerLoad } from "./$types.js";

const STATUSES = ["MENUNGGU", "DIPROSES", "SELESAI", "DITOLAK", "DUPLIKAT"] as const;
type Status = (typeof STATUSES)[number];

export const load: PageServerLoad = async ({ locals, url }) => {
	requireRoleOrRedirect(locals.user, [...OPERATIONAL_ROLES]);
	const filter = String(url.searchParams.get("status") ?? "MENUNGGU");
	const status: Status = STATUSES.includes(filter as Status) ? (filter as Status) : "MENUNGGU";

	const [antrian, ringkasan] = await Promise.all([listAntrianTriase(status), ringkasanTriase()]);

	return {
		// `aiRincian` disimpan sebagai JSON string di DB; di-parse di server
		// supaya komponen tidak perlu tahu bentuk penyimpanannya.
		reports: antrian.map((r) => ({ ...r, faktorAi: parseRincian(r.aiRincian) })),
		statusAktif: status,
		statuses: STATUSES,
		ringkasan,
	};
};

/** Ambil aktor triase dari sesi, atau `null` kalau belum login. */
function aktorDari(locals: App.Locals): AktorTriase | null {
	if (!locals.user) return null;
	return { id: locals.user.id, nama: locals.user.name, peran: locals.user.role };
}

export const actions: Actions = {
	/**
	 * Verifikasi laporan → naik jadi insiden resmi.
	 *
	 * Ini satu-satunya jalur yang mengubah laporan warga menjadi pekerjaan
	 * lapangan, dan sengaja hanya bisa dipicu manusia — hasil pindai AI tidak
	 * pernah memverifikasi sendiri.
	 */
	verifikasi: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...OPERATIONAL_ROLES]);
		if (denied) return denied;
		const aktor = aktorDari(locals);
		if (!aktor) return fail(401, { message: "Unauthorized" });

		const form = await request.formData();
		const id = String(form.get("id") ?? "");
		const jenisSampah = String(form.get("jenisSampah") ?? "").trim();
		const catatan = String(form.get("catatan") ?? "").trim();
		if (!id) return fail(400, { message: "Laporan tidak valid" });
		if (catatan.length > 2000)
			return fail(400, { message: "Catatan terlalu panjang (maksimal 2000 karakter)" });

		const hasil = await verifikasiLaporan(id, aktor, { jenisSampah, catatan });
		if (!hasil.ok) return fail(400, { message: hasil.pesan });

		return { success: true, message: "Laporan diverifikasi dan menjadi insiden" };
	},

	tolak: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...OPERATIONAL_ROLES]);
		if (denied) return denied;
		const aktor = aktorDari(locals);
		if (!aktor) return fail(401, { message: "Unauthorized" });

		const form = await request.formData();
		const id = String(form.get("id") ?? "");
		const alasan = String(form.get("alasan") ?? "").trim();
		if (!id) return fail(400, { message: "Laporan tidak valid" });
		// Alasan diwajibkan: penolakan menurunkan reputasi pelapor dan
		// ditampilkan ke warga di halaman pelacakan, jadi harus bisa
		// dipertanggungjawabkan.
		if (!alasan) return fail(400, { message: "Alasan penolakan wajib diisi" });
		if (alasan.length > 2000)
			return fail(400, { message: "Alasan terlalu panjang (maksimal 2000 karakter)" });

		const hasil = await tolakLaporan(id, aktor, alasan);
		if (!hasil.ok) return fail(400, { message: hasil.pesan ?? "Gagal menolak laporan" });

		return { success: true, message: "Laporan ditolak" };
	},

	gabungkan: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...OPERATIONAL_ROLES]);
		if (denied) return denied;
		const aktor = aktorDari(locals);
		if (!aktor) return fail(401, { message: "Unauthorized" });

		const form = await request.formData();
		const id = String(form.get("id") ?? "");
		const indukId = String(form.get("indukId") ?? "");
		if (!id || !indukId) return fail(400, { message: "Laporan tidak valid" });

		const hasil = await tandaiDuplikat(id, indukId, aktor);
		if (!hasil.ok) return fail(400, { message: hasil.pesan ?? "Gagal menggabungkan laporan" });

		return { success: true, message: "Laporan digabungkan" };
	},

	/** Ulangi pindai AI — berguna kalau layanan pLitter sempat mati saat laporan masuk. */
	pindaiUlang: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...OPERATIONAL_ROLES]);
		if (denied) return denied;

		const form = await request.formData();
		const id = String(form.get("id") ?? "");
		if (!id) return fail(400, { message: "Laporan tidak valid" });

		const modelTypeRaw = String(form.get("modelType") ?? "");
		const modelType: ModelTypeDeteksi = (MODEL_TYPES_TERSEDIA as readonly string[]).includes(
			modelTypeRaw
		)
			? (modelTypeRaw as ModelTypeDeteksi)
			: "street";

		// Berbeda dari jalur publik, di sini pemindaian DITUNGGU: operator
		// menekan tombolnya secara sadar dan mengharapkan hasilnya langsung
		// terlihat saat halaman dimuat ulang.
		await pindaiLaporan(id, { modelType });
		return { success: true, message: "Pemindaian ulang selesai" };
	},

	/**
	 * Ubah status administratif — HANYA untuk menutup laporan yang sudah DIPROSES
	 * menjadi SELESAI (mis. setelah insiden dibersihkan di lapangan).
	 *
	 * Sengaja dibatasi: transisi MENUNGGU→DITOLAK/DUPLIKAT/DIPROSES wajib lewat
	 * `tolak`/`gabungkan`/`verifikasi` supaya reputasi & audit tetap konsisten.
	 * Bypass langsung via update mentah sebelumnya bikin reputasi & jejak audit hilang.
	 */
	ubahStatus: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...OPERATIONAL_ROLES]);
		if (denied) return denied;
		if (!locals.user) return fail(401, { message: "Unauthorized" });

		const form = await request.formData();
		const id = String(form.get("id") ?? "");
		const status = String(form.get("status") ?? "");
		if (!id || !STATUSES.includes(status as Status))
			return fail(400, { message: "Data tidak valid" });

		// Hanya SELESAI yang boleh via jalur ini, dan hanya dari DIPROSES.
		if (status !== "SELESAI") {
			return fail(400, {
				message: "Gunakan aksi Verifikasi/Tolak/Gabungkan untuk perubahan status ini",
			});
		}
		const [existing] = await db.select().from(publicReports).where(eq(publicReports.id, id));
		if (!existing) return fail(404, { message: "Laporan tidak ditemukan" });
		if (existing.status !== "DIPROSES") {
			return fail(400, {
				message: `Hanya laporan DIPROSES yang bisa diselesaikan (status sekarang: ${existing.status})`,
			});
		}
		if (existing.insidenId) {
			const [ins] = await db.select().from(incidents).where(eq(incidents.id, existing.insidenId));
			if (ins && ins.status !== "SELESAI" && ins.status !== "POSITIF_PALSU") {
				return fail(400, { message: "Selesaikan insiden terkait dulu di halaman Insiden" });
			}
		}

		const now = new Date();
		await db.transaction(async (tx) => {
			await tx
				.update(publicReports)
				.set({ status: "SELESAI", diprosesOleh: locals.user!.id, updatedAt: now })
				.where(eq(publicReports.id, id));
			await tx.insert(auditLog).values({
				id: generateId(10),
				waktu: now,
				pengguna: locals.user!.name,
				peran: locals.user!.role,
				tindakan: "Laporan warga diselesaikan administratif",
				rincian: `Laporan ${existing.kodeTracking} ditandai SELESAI oleh ${locals.user!.name}`,
				wilayah: existing.kota ?? "",
				tipe: "LAPORAN_WARGA",
				incidentId: existing.insidenId ?? undefined,
			});
		});

		return { success: true, message: "Status diperbarui" };
	},
};
