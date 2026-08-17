import { json, error } from "@sveltejs/kit";
import { cekKesehatanPlitter } from "$lib/server/novira/deteksi.js";
import type { RequestHandler } from "./$types.js";

/** Polled by the Insiden & Alert page to show a live "Server ML: Online/Offline" badge. */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401);

	const online = await cekKesehatanPlitter();
	return json({ online });
};
