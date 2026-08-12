import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db/index.js";
import { users, notifications, appSettings } from "$lib/server/db/schema.js";
import { visibleTo } from "$lib/server/db/notification-visibility.js";
import { countAll } from "$lib/server/db/helpers.js";
import {
	ringkasanKpi,
	listProvinsi,
	listKabupatenKota,
	listKamera,
	listInsiden,
	listSkorWilayah,
	listPetugas,
	listTrenSampah,
	listAuditLog,
} from "$lib/server/novira/index.js";
import { eq, and } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, "/login");

	// Statistic DB
	const [userCount] = await db.select({ count: countAll }).from(users);
	// Unread badge must be scoped to this user's visible notifications (their own
	// plus global), not the site-wide total — otherwise a viewer sees other
	// users' notification volume.
	const [unreadCount] = await db
		.select({ count: countAll })
		.from(notifications)
		.where(and(eq(notifications.read, false), visibleTo(locals.user.id)));

	const maintenanceSetting = await db.query.appSettings.findFirst({
		where: eq(appSettings.key, "maintenanceMode"),
	});

	// Metrik domain NOVIRA (CCTV/insiden/skor/tren) datang lewat seam data
	// domain (saat ini adapter mock) — lihat flag `demoData` agar UI bisa
	// memberi tahu pengguna bahwa ini bukan data produksi.
	const domainKpi = await ringkasanKpi();
	const [
		provinsiList,
		kabupatenKotaList,
		kameraList,
		insidenList,
		skorWilayahList,
		petugasList,
		trenSampahList,
		auditLogList,
	] = await Promise.all([
		listProvinsi(),
		listKabupatenKota(),
		listKamera(),
		listInsiden(),
		listSkorWilayah(),
		listPetugas(),
		listTrenSampah(),
		listAuditLog(),
	]);

	return {
		user: locals.user,
		demoData: true,
		kpi: {
			...domainKpi,
			totalPengguna: userCount.count,
			notifikasiBelumDibaca: unreadCount.count,
		},
		provinsiList,
		kabupatenKotaList,
		kameraList,
		insidenList,
		skorWilayahList,
		petugasList,
		trenSampahList,
		auditLogList,
		systemStatus: {
			maintenanceMode: maintenanceSetting?.value === "true",
		},
	};
};
