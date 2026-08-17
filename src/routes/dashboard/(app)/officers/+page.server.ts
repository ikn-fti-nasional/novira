import { db } from "$lib/server/db/index.js";
import { officers, users } from "$lib/server/db/schema.js";
import { listPetugas } from "$lib/server/novira/index.js";
import { requireRoleOrRedirect, requireRoleOrFail, OPERATIONAL_ROLES } from "$lib/authorize.js";
import { generateId } from "$lib/server/id.js";
import { fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

/** Parse the optional "Akun Login" select -- empty string means "tidak dihubungkan". */
function parseUserId(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

const STATUS_OPTIONS = ["SIAP_TUGAS", "SEDANG_BERTUGAS", "OFFLINE"] as const;
type OfficerStatus = (typeof STATUS_OPTIONS)[number];

function parseStatus(value: unknown): OfficerStatus {
	return (STATUS_OPTIONS as readonly string[]).includes(value as string)
		? (value as OfficerStatus)
		: "SIAP_TUGAS";
}

export const load: PageServerLoad = async ({ locals }) => {
	requireRoleOrRedirect(locals.user, [...OPERATIONAL_ROLES]);
	const [petugasList, akunPetugas] = await Promise.all([
		listPetugas(),
		db
			.select({ id: users.id, name: users.name, username: users.username })
			.from(users)
			.where(eq(users.role, "petugas_lapangan")),
	]);
	return { petugasList, akunPetugas };
};

export const actions: Actions = {
	tambah: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...OPERATIONAL_ROLES]);
		if (denied) return denied;

		const form = await request.formData();
		const nama = String(form.get("nama") ?? "").trim();
		const peran = String(form.get("peran") ?? "").trim();
		const telepon = String(form.get("telepon") ?? "").trim();
		const wilayahTugas = String(form.get("wilayahTugas") ?? "").trim();
		const status = parseStatus(form.get("status"));
		const userId = parseUserId(form.get("userId"));

		if (!nama || !peran || !telepon || !wilayahTugas) {
			return fail(400, { message: "Nama, peran, nomor WhatsApp, dan wilayah tugas wajib diisi" });
		}

		try {
			await db.insert(officers).values({
				id: generateId(10),
				nama,
				peran,
				telepon,
				wilayahTugas,
				status,
				userId,
			});
		} catch {
			return fail(400, { message: "Akun login tersebut sudah dihubungkan ke petugas lain" });
		}
		return { success: true, action: "tambah" };
	},

	ubah: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...OPERATIONAL_ROLES]);
		if (denied) return denied;

		const form = await request.formData();
		const id = String(form.get("id") ?? "");
		const nama = String(form.get("nama") ?? "").trim();
		const peran = String(form.get("peran") ?? "").trim();
		const telepon = String(form.get("telepon") ?? "").trim();
		const wilayahTugas = String(form.get("wilayahTugas") ?? "").trim();
		const status = parseStatus(form.get("status"));
		const userId = parseUserId(form.get("userId"));

		if (!id) return fail(400, { message: "ID petugas tidak valid" });
		if (!nama || !peran || !telepon || !wilayahTugas) {
			return fail(400, { message: "Nama, peran, nomor WhatsApp, dan wilayah tugas wajib diisi" });
		}

		try {
			await db
				.update(officers)
				.set({ nama, peran, telepon, wilayahTugas, status, userId, updatedAt: new Date() })
				.where(eq(officers.id, id));
		} catch {
			return fail(400, { message: "Akun login tersebut sudah dihubungkan ke petugas lain" });
		}
		return { success: true, action: "ubah" };
	},

	hapus: async ({ request, locals }) => {
		const denied = requireRoleOrFail(locals.user, [...OPERATIONAL_ROLES]);
		if (denied) return denied;

		const form = await request.formData();
		const id = String(form.get("id") ?? "");
		if (!id) return fail(400, { message: "ID petugas tidak valid" });

		// FK petugas_ditugaskan -> officers(id) ON DELETE SET NULL, jadi insiden
		// yang pernah ditugaskan ke petugas ini otomatis kembali "belum
		// ditugaskan", bukan gagal dengan error FK.
		await db.delete(officers).where(eq(officers.id, id));
		return { success: true, action: "hapus" };
	},
};
