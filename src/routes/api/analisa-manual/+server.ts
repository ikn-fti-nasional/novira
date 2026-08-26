import { requireRoleOrRedirect, NON_EXECUTIVE_ROLES } from "$lib/authorize.js";
import {
	cekKesehatanPlitter,
	jalankanAnalisaManual,
	type ProgresAnalisaManual,
} from "$lib/server/novira/deteksi.js";
import { db } from "$lib/server/db/index.js";
import { cameras } from "$lib/server/db/schema.js";
import { eq, inArray, and } from "drizzle-orm";
import type { RequestHandler } from "./$types.js";

const BANDUNG_KOTA = "Bandung";

/**
 * Progress stream untuk "Analisa Manual CCTV" di halaman Insiden & Alert.
 * SSE dipilih (bukan satu response besar di akhir) karena satu siklus penuh
 * atas ~290 kamera Bandung bisa memakan belasan menit -- operator perlu tahu
 * kamera mana yang sedang diproses, bukan cuma menatap tombol ber-spinner.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	requireRoleOrRedirect(locals.user, [...NON_EXECUTIVE_ROLES]);
	const verifier = { nama: locals.user.name, peran: locals.user.role };

	// "all" (atau param tidak ada) berarti seluruh kamera Bandung -- lihat
	// pilihan "pilih semua" di modal. Selain itu, daftar ID dipisah koma.
	const camerasParam = url.searchParams.get("cameras");
	const cameraIds =
		camerasParam && camerasParam !== "all" ? camerasParam.split(",").filter(Boolean) : undefined;

	// Resolve effective camera count server-side before checking limit
	const effectiveCameras =
		cameraIds && cameraIds.length > 0
			? await db
					.select({ id: cameras.id })
					.from(cameras)
					.where(and(eq(cameras.kota, BANDUNG_KOTA), inArray(cameras.id, cameraIds)))
			: await db.select({ id: cameras.id }).from(cameras).where(eq(cameras.kota, BANDUNG_KOTA));

	// Batasi 10 per analisa — cegah beban ML & race verifikasi
	if (effectiveCameras.length > 10) {
		return new Response(JSON.stringify({ message: "Maksimal 10 CCTV per analisa" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const encoder = new TextEncoder();
	let closed = false;

	const stream = new ReadableStream({
		async start(controller) {
			function send(event: string, data: unknown) {
				if (closed) return;
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			}

			try {
				const sehat = await cekKesehatanPlitter();
				if (!sehat) {
					send("error", {
						message:
							"Server ML (pLitter) sedang tidak bisa diakses -- analisa tidak bisa dijalankan.",
					});
					return;
				}

				const ringkasan = await jalankanAnalisaManual(
					verifier,
					(progres: ProgresAnalisaManual) => send("progress", progres),
					cameraIds
				);
				send("done", ringkasan);
			} catch (err) {
				send("error", { message: err instanceof Error ? err.message : String(err) });
			} finally {
				closed = true;
				controller.close();
			}
		},
		cancel() {
			closed = true;
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
};
