import { fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db/index.js";
import { cameras } from "$lib/server/db/schema.js";
import {
	listInsiden,
	listPetugas,
	selesaikanInsiden,
	tandaiPositifPalsu,
	tugaskanPetugas,
} from "$lib/server/novira/index.js";
import {
	verifikasiTemuanManual,
	BANDUNG_KOTA,
	type TemuanManual,
} from "$lib/server/novira/deteksi.js";
import { storeUpload, validateUpload } from "$lib/server/uploads.js";
import { requireRoleOrFail, NON_EXECUTIVE_ROLES } from "$lib/authorize.js";
import type { Actions, PageServerLoad } from "./$types.js";

const JENIS_SAMPAH_VALID = new Set([
	"tumpukan_sampah",
	"kantong_plastik",
	"kardus_kemasan",
	"botol_minuman",
	"pembuangan_liar_besar",
	"puing_bangunan",
]);

/** Temuan datang lewat hidden field JSON yang kita render sendiri, tapi tetap divalidasi karena operator bisa mengubah DOM sebelum submit. */
function parseTemuan(raw: FormDataEntryValue | null): TemuanManual | null {
	if (typeof raw !== "string") return null;
	let obj: unknown;
	try {
		obj = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof obj !== "object" || obj === null) return null;
	const t = obj as Record<string, unknown>;
	const bbox = t.bbox as Record<string, unknown> | undefined;
	if (
		typeof t.key !== "string" ||
		typeof t.cameraId !== "string" ||
		typeof t.cameraNama !== "string" ||
		typeof t.kota !== "string" ||
		(t.kecamatan !== null && typeof t.kecamatan !== "string") ||
		typeof t.jenisSampah !== "string" ||
		!JENIS_SAMPAH_VALID.has(t.jenisSampah) ||
		typeof t.labelSampah !== "string" ||
		typeof t.skor !== "number" ||
		t.skor < 0 ||
		t.skor > 1 ||
		typeof t.urlSnapshot !== "string" ||
		!bbox ||
		typeof bbox.x !== "number" ||
		typeof bbox.y !== "number" ||
		typeof bbox.width !== "number" ||
		typeof bbox.height !== "number"
	) {
		return null;
	}
	return t as unknown as TemuanManual;
}

export const load: PageServerLoad = async () => {
	const [insidenList, petugasList, kameraBandung] = await Promise.all([
		listInsiden(),
		listPetugas(),
		db
			.select({ id: cameras.id, nama: cameras.nama, kecamatan: cameras.kecamatan })
			.from(cameras)
			.where(eq(cameras.kota, BANDUNG_KOTA))
			.orderBy(cameras.nama),
	]);
	return { insidenList, petugasList, kameraBandung };
};

export const actions: Actions = {
	selesaikanTugas: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...NON_EXECUTIVE_ROLES]);
		if (denied) return denied;

		const formData = await request.formData();
		const insidenId = formData.get("insidenId");
		const buktiFoto = formData.get("buktiFoto");
		const catatan = formData.get("catatan");

		if (typeof insidenId !== "string" || insidenId.length === 0) {
			return fail(400, { message: "ID insiden tidak valid." });
		}
		if (!(buktiFoto instanceof File) || buktiFoto.size === 0) {
			return fail(400, { message: "Foto bukti penanganan wajib diunggah." });
		}

		const error = validateUpload(buktiFoto, "foto");
		if (error) return fail(400, { message: error });

		// Cek keberadaan insiden SEBELUM menyimpan file, supaya ID tak dikenal
		// tidak meninggalkan upload yatim di /uploads.
		const insiden = (await listInsiden()).find((i) => i.id === insidenId);
		if (!insiden) {
			return fail(404, { message: "Insiden tidak ditemukan." });
		}

		let buktiFotoUrl: string;
		try {
			buktiFotoUrl = await storeUpload(buktiFoto, "foto");
		} catch {
			return fail(500, { message: "Gagal menyimpan foto bukti, coba lagi." });
		}

		const insidenSelesai = await selesaikanInsiden(
			insidenId,
			buktiFotoUrl,
			typeof catatan === "string" ? catatan : undefined,
			{
				nama: locals.user?.name ?? "petugas",
				peran: locals.user?.role ?? "petugas_lapangan",
			}
		);
		if (!insidenSelesai) {
			return fail(404, { message: "Insiden tidak ditemukan." });
		}

		return { success: true, action: "selesaikanTugas", insidenId, buktiFotoUrl };
	},

	tugaskanPetugas: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...NON_EXECUTIVE_ROLES]);
		if (denied) return denied;

		const formData = await request.formData();
		const insidenId = formData.get("insidenId");
		const petugasId = formData.get("petugasId");

		if (typeof insidenId !== "string" || insidenId.length === 0) {
			return fail(400, { message: "ID insiden tidak valid." });
		}
		if (typeof petugasId !== "string" || petugasId.length === 0) {
			return fail(400, { message: "Pilih petugas yang akan ditugaskan." });
		}

		const hasil = await tugaskanPetugas(insidenId, petugasId, {
			nama: locals.user?.name ?? "operator",
			peran: locals.user?.role ?? "operator",
		});
		if (!hasil) {
			return fail(404, { message: "Insiden atau petugas tidak ditemukan." });
		}

		return { success: true, action: "tugaskanPetugas", insidenId };
	},

	tandaiPositifPalsu: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...NON_EXECUTIVE_ROLES]);
		if (denied) return denied;

		const formData = await request.formData();
		const insidenId = formData.get("insidenId");

		if (typeof insidenId !== "string" || insidenId.length === 0) {
			return fail(400, { message: "ID insiden tidak valid." });
		}

		const hasil = await tandaiPositifPalsu(insidenId, {
			nama: locals.user?.name ?? "operator",
			peran: locals.user?.role ?? "operator",
		});
		if (!hasil) {
			return fail(404, { message: "Insiden tidak ditemukan." });
		}

		return { success: true, action: "tandaiPositifPalsu", insidenId };
	},

	verifikasiTemuan: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...NON_EXECUTIVE_ROLES]);
		if (denied) return denied;

		const formData = await request.formData();
		const temuan = parseTemuan(formData.get("temuan"));
		if (!temuan) {
			return fail(400, { message: "Data temuan tidak valid." });
		}

		const hasil = await verifikasiTemuanManual(temuan, {
			nama: locals.user?.name ?? "operator",
			peran: locals.user?.role ?? "operator",
		});

		return {
			success: true,
			action: "verifikasiTemuan",
			temuanKey: temuan.key,
			insidenId: hasil.insidenId,
			baru: hasil.baru,
		};
	},
};
