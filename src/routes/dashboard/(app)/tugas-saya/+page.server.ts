import { fail } from "@sveltejs/kit";
import { listTugasPetugas, selesaikanInsiden } from "$lib/server/novira/index.js";
import { storeUpload, validateUpload } from "$lib/server/uploads.js";
import { requireRoleOrRedirect } from "$lib/authorize.js";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, ["petugas_lapangan", "admin"]);
	return listTugasPetugas(locals.user.id);
};

export const actions: Actions = {
	laporHasil: async ({ request, locals }) => {
		requireRoleOrRedirect(locals.user, ["petugas_lapangan", "admin"]);

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

		// Petugas hanya boleh melapor untuk insiden yang benar-benar ditugaskan
		// ke dirinya -- cek ulang di sini, bukan cuma percaya form field, supaya
		// permintaan yang dipalsukan tidak bisa menyelesaikan tugas orang lain.
		const { tugasAktif } = await listTugasPetugas(locals.user.id);
		if (!tugasAktif.some((i) => i.id === insidenId)) {
			return fail(404, { message: "Insiden ini bukan tugas Anda atau sudah tidak aktif." });
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
			{ nama: locals.user.name, peran: locals.user.role }
		);
		if (!insidenSelesai) {
			return fail(404, { message: "Insiden tidak ditemukan." });
		}

		return { success: true, insidenId };
	},
};
