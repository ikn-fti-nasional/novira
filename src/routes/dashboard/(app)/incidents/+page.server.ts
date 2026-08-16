import { fail } from "@sveltejs/kit";
import { listInsiden, selesaikanInsiden } from "$lib/server/novira/index.js";
import { storeUpload, validateUpload } from "$lib/server/uploads.js";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
	return { insidenList: await listInsiden() };
};

export const actions: Actions = {
	selesaikanTugas: async ({ request }) => {
		const formData = await request.formData();
		const insidenId = formData.get("insidenId");
		const buktiFoto = formData.get("buktiFoto");

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

		const insidenSelesai = await selesaikanInsiden(insidenId, buktiFotoUrl);
		if (!insidenSelesai) {
			return fail(404, { message: "Insiden tidak ditemukan." });
		}

		return { success: true, insidenId, buktiFotoUrl };
	},
};