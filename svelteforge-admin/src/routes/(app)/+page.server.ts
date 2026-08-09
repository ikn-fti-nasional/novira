import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db/index.js";
import { users, notifications, appSettings } from "$lib/server/db/schema.js";
import { sql, eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";
import {
	MOCK_PROVINSI,
	MOCK_KABUPATEN_KOTA,
	MOCK_KAMERA,
	MOCK_INSIDEN,
	MOCK_SKOR_WILAYAH,
	MOCK_PETUGAS,
	MOCK_TREN_SAMPAH,
	MOCK_AUDIT_LOG,
} from "$lib/mock/novira.js";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, "/login");

	// Statistic DB
	const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
	const [unreadCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(notifications)
		.where(eq(notifications.read, false));

	const maintenanceSetting = await db.query.appSettings.findFirst({
		where: eq(appSettings.key, "maintenanceMode"),
	});

	// Hitung Metrik Utama Super Admin NOVIRA
	const insidenAktifCount = MOCK_INSIDEN.filter((i) => i.status === "AKTIF").length;
	const cctvOnlineCount = MOCK_KAMERA.filter((c) => c.status === "ONLINE").length;
	const totalCctvCount = MOCK_KAMERA.length;
	const slaMelanggarCount = MOCK_INSIDEN.filter((i) => i.statusSla === "MELANGGAR_SLA").length;
	const volumeSampahHariIni = 142; // Kg

	return {
		user: locals.user,
		kpi: {
			insidenAktif: insidenAktifCount,
			cctvOnline: cctvOnlineCount,
			totalCctv: totalCctvCount,
			persentaseUptimeCctv: Math.round((cctvOnlineCount / totalCctvCount) * 100),
			volumeSampahHariIniKg: volumeSampahHariIni,
			slaMelanggar: slaMelanggarCount,
			totalPengguna: userCount.count,
			notifikasiBelumDibaca: unreadCount.count,
		},
		provinsiList: MOCK_PROVINSI,
		kabupatenKotaList: MOCK_KABUPATEN_KOTA,
		kameraList: MOCK_KAMERA,
		insidenList: MOCK_INSIDEN,
		skorWilayahList: MOCK_SKOR_WILAYAH,
		petugasList: MOCK_PETUGAS,
		trenSampahList: MOCK_TREN_SAMPAH,
		auditLogList: MOCK_AUDIT_LOG,
		systemStatus: {
			maintenanceMode: maintenanceSetting?.value === "true",
		},
	};
};
