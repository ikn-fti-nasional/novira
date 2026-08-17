import { fail } from "@sveltejs/kit";
import { OPERATIONAL_ROLES, requireRoleOrFail, requireRoleOrRedirect } from "$lib/authorize.js";
import { ambilPengaturanModel, MODEL_TYPES_TERSEDIA } from "$lib/server/novira/deteksi.js";
import {
	analisaUnggahan,
	parseConfThres,
	parseModelType,
} from "$lib/server/novira/analisaUnggahan.js";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, OPERATIONAL_ROLES);
	const pengaturan = await ambilPengaturanModel();

	return {
		modelTypesTersedia: MODEL_TYPES_TERSEDIA,
		defaultModelType: pengaturan.modelType,
		defaultConfThres: pengaturan.confThres,
	};
};

export const actions: Actions = {
	analisa: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, OPERATIONAL_ROLES);
		if (denied) return denied;

		const formData = await request.formData();
		const file = formData.get("file");
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { message: "Pilih foto atau video untuk dianalisa." });
		}

		const pengaturanDefault = await ambilPengaturanModel();
		const modelType = parseModelType(formData.get("modelType")) ?? pengaturanDefault.modelType;
		const confThres = parseConfThres(formData.get("confThres"), pengaturanDefault.confThres);

		try {
			const hasil = await analisaUnggahan(file, { modelType, confThres });
			return { success: true, hasil };
		} catch (err) {
			const pesan = err instanceof Error ? err.message : String(err);
			return fail(502, { message: `Analisa gagal: ${pesan.slice(0, 300)}` });
		}
	},
};
