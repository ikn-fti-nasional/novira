import { OPERATIONAL_ROLES, requireRoleOrRedirect } from "$lib/authorize.js";
import { ambilPengaturanModel, MODEL_TYPES_TERSEDIA } from "$lib/server/novira/deteksi.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, OPERATIONAL_ROLES);
	const pengaturan = await ambilPengaturanModel();

	return {
		modelTypesTersedia: MODEL_TYPES_TERSEDIA,
		defaultModelType: pengaturan.modelType,
		defaultConfThres: pengaturan.confThres,
	};
};
