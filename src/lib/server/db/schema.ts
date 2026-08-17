import {
	pgTable,
	text,
	bigint,
	integer,
	boolean,
	timestamp,
	index,
	uniqueIndex,
	primaryKey,
	type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	username: text("username").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	name: text("name").notNull(),
	avatarUrl: text("avatar_url"),
	role: text("role", {
		enum: ["admin", "operator", "kepala_seksi", "kepala_dinas", "walikota", "petugas_lapangan"],
	})
		.notNull()
		.default("operator"),
	createdAt: timestamp("created_at", { mode: "date" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp("updated_at", { mode: "date" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const sessions = pgTable(
	"sessions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		// Millisecond epoch timestamps exceed int4 (max ~2.1e9); must be int8.
		// mode:"number" makes postgres.js (which returns int8 as string) parse to number.
		expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
		userAgent: text("user_agent"),
		ipAddress: text("ip_address"),
		createdAt: timestamp("created_at", { mode: "date" }).$defaultFn(() => new Date()),
	},
	(table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const pages = pgTable(
	"pages",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		slug: text("slug").notNull().unique(),
		content: text("content").notNull().default(""),
		template: text("template", { enum: ["default", "landing", "blog"] })
			.notNull()
			.default("default"),
		status: text("status", { enum: ["draft", "published", "archived"] })
			.notNull()
			.default("draft"),
		authorId: text("author_id")
			.notNull()
			.references(() => users.id),
		createdAt: timestamp("created_at", { mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
		publishedAt: timestamp("published_at", { mode: "date" }),
	},
	(table) => [
		index("pages_author_id_idx").on(table.authorId),
		index("pages_status_idx").on(table.status),
	]
);

export const notifications = pgTable(
	"notifications",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").references(() => users.id),
		title: text("title").notNull(),
		message: text("message").notNull(),
		type: text("type", { enum: ["info", "warning", "error", "success"] })
			.notNull()
			.default("info"),
		read: boolean("read").notNull().default(false),
		createdAt: timestamp("created_at", { mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index("notifications_user_id_idx").on(table.userId),
		// Supports the unread-count + recent-unread queries in the app shell.
		index("notifications_read_created_idx").on(table.read, table.createdAt),
	]
);

// Per-user state for global notifications (`userId = NULL`): those rows are
// shared across every user, so read/dismissed state must live here instead of
// mutating the shared row. User-owned notifications keep using the `read`
// column on `notifications`.
export const notificationReads = pgTable(
	"notification_reads",
	{
		notificationId: text("notification_id")
			.notNull()
			.references(() => notifications.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		read: boolean("read").notNull().default(false),
		dismissed: boolean("dismissed").notNull().default(false),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [primaryKey({ columns: [table.notificationId, table.userId] })]
);

export const passwordResetTokens = pgTable(
	"password_reset_tokens",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		tokenHash: text("token_hash").notNull(),
		expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
	},
	(table) => [
		index("password_reset_tokens_token_hash_idx").on(table.tokenHash),
		index("password_reset_tokens_user_id_idx").on(table.userId),
	]
);

export const appSettings = pgTable("app_settings", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
	updatedAt: timestamp("updated_at", { mode: "date" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const cameras = pgTable("cameras", {
	id: text("id").primaryKey(),
	nama: text("nama").notNull(),
	kota: text("kota").notNull(),
	kecamatan: text("kecamatan"),
	/** Diturunkan lewat reverse geocoding koordinat kamera, bukan dari data sumber pemda. */
	kelurahan: text("kelurahan"),
	urlStream: text("url_stream"),
	urlSnapshot: text("url_snapshot"),
	status: text("status", { enum: ["ONLINE", "OFFLINE", "PERBAIKAN"] })
		.notNull()
		.default("OFFLINE"),
	latitude: text("latitude"),
	longitude: text("longitude"),
	createdAt: timestamp("created_at", { mode: "date" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp("updated_at", { mode: "date" })
		.notNull()
		.$defaultFn(() => new Date()),
});

/**
 * Laporan warga dari halaman publik `/lapor`.
 *
 * Alur lengkapnya (lihat `$lib/server/novira/laporan.ts`):
 * kirim → pindai AI (`POST /detect/image` pLitter) → cek duplikat geo →
 * antrian triase operator → diverifikasi → naik jadi baris `incidents`.
 * Kolom `ai*` menyimpan hasil pindai supaya keputusan operator bisa diaudit
 * belakangan, bukan cuma jadi angka sesaat di layar.
 */
export const publicReports = pgTable(
	"public_reports",
	{
		id: text("id").primaryKey(),
		/** Kode publik (mis. "LPR-7K2M9Q") supaya pelapor bisa melacak tanpa akun. */
		kodeTracking: text("kode_tracking").notNull().unique(),
		pelaporNama: text("pelapor_nama"),
		pelaporTelepon: text("pelapor_telepon"),
		deskripsi: text("deskripsi"),
		jenisSampah: text("jenis_sampah"),
		urlFoto: text("url_foto"),
		urlVideo: text("url_video"),
		latitude: text("latitude"),
		longitude: text("longitude"),
		kota: text("kota"),
		kecamatan: text("kecamatan"),
		status: text("status", {
			enum: ["MENUNGGU", "DIPROSES", "SELESAI", "DITOLAK", "DUPLIKAT"],
		})
			.notNull()
			.default("MENUNGGU"),
		catatanPetugas: text("catatan_petugas"),
		diprosesOleh: text("diproses_oleh").references(() => users.id),

		// --- Hasil pindai AI (nullable: belum dipindai / pindai gagal / laporan video-saja) ---
		/** Skor kepercayaan deteksi tertinggi, 0..1. String demi konsistensi dengan `incidents.tingkatKepercayaan`. */
		aiSkor: text("ai_skor"),
		/** Nama kelas mentah dari model (mis. "Pile"), bukan enum jenisSampah kita. */
		aiLabel: text("ai_label"),
		aiJumlahDeteksi: integer("ai_jumlah_deteksi"),
		/**
		 * Rekomendasi triase — gabungan skor AI, kelengkapan laporan, dan
		 * reputasi pelapor. Ini SARAN, bukan keputusan: status hanya berubah
		 * setelah operator menekan verifikasi/tolak.
		 */
		aiRekomendasi: text("ai_rekomendasi", {
			enum: ["SANGAT_MUNGKIN_VALID", "PERLU_TINJAUAN", "KEMUNGKINAN_SPAM", "GAGAL_PINDAI"],
		}),
		/** Alasan rekomendasi dalam JSON (array faktor) supaya bisa ditampilkan per baris. */
		aiRincian: text("ai_rincian"),
		aiDipindaiPada: timestamp("ai_dipindai_pada", { mode: "date" }),

		/** Terisi setelah operator memverifikasi dan laporan naik jadi insiden. */
		insidenId: text("insiden_id").references((): AnyPgColumn => incidents.id, {
			onDelete: "set null",
		}),
		/** Terisi kalau laporan ini dinilai duplikat dari laporan lain yang lebih dulu masuk. */
		duplikatDariId: text("duplikat_dari_id").references((): AnyPgColumn => publicReports.id, {
			onDelete: "set null",
		}),

		createdAt: timestamp("created_at", { mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index("public_reports_status_created_idx").on(table.status, table.createdAt),
		index("public_reports_telepon_idx").on(table.pelaporTelepon),
	]
);

/**
 * Reputasi pelapor, dikunci pada nomor telepon ternormalisasi (format 62xxx).
 *
 * Gunanya dua arah: pelapor yang terbukti akurat mendapat prioritas triase
 * lebih tinggi, sementara pengirim laporan palsu berulang otomatis turun ke
 * "KEMUNGKINAN_SPAM" tanpa perlu blokir manual. Laporan anonim (tanpa nomor)
 * tidak punya baris di sini dan selalu dinilai netral.
 */
export const reporterTrust = pgTable("reporter_trust", {
	/** Nomor telepon ternormalisasi — sekaligus primary key, satu baris per pelapor. */
	telepon: text("telepon").primaryKey(),
	laporanTotal: integer("laporan_total").notNull().default(0),
	laporanValid: integer("laporan_valid").notNull().default(0),
	laporanDitolak: integer("laporan_ditolak").notNull().default(0),
	/** 0..100, dihitung ulang tiap kali laporan diverifikasi/ditolak. Netral = 50. */
	skor: integer("skor").notNull().default(50),
	updatedAt: timestamp("updated_at", { mode: "date" })
		.notNull()
		.$defaultFn(() => new Date()),
});

/**
 * Foto skor kebersihan per kecamatan, satu baris per hari (cron 23:50 WIB,
 * lihat `$lib/server/novira/snapshot.ts`).
 *
 * Tanpa tabel ini seluruh angka tren di aplikasi terpaksa dikembalikan
 * "stabil"/"+0.0%" karena tidak ada pembanding historis. Skor kebersihan
 * sendiri tetap dihitung on-the-fly untuk tampilan hari ini; tabel ini murni
 * arsip harian untuk perbandingan antar waktu.
 */
export const areaSnapshots = pgTable(
	"area_snapshots",
	{
		id: text("id").primaryKey(),
		/** Tanggal lokal WIB dalam format YYYY-MM-DD — dibandingkan sebagai string, aman terhadap zona waktu. */
		tanggal: text("tanggal").notNull(),
		kecamatan: text("kecamatan").notNull(),
		kota: text("kota").notNull(),
		skorKebersihan: integer("skor_kebersihan").notNull(),
		jumlahInsiden: integer("jumlah_insiden").notNull().default(0),
		insidenBaru: integer("insiden_baru").notNull().default(0),
		insidenSelesai: integer("insiden_selesai").notNull().default(0),
		rataRataDurasiJam: text("rata_rata_durasi_jam").notNull().default("0"),
		createdAt: timestamp("created_at", { mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		// Menjadikan penulisan snapshot idempoten: cron yang jalan dua kali
		// dalam hari yang sama menimpa baris, bukan menggandakannya.
		uniqueIndex("area_snapshots_tanggal_area_idx").on(table.tanggal, table.kota, table.kecamatan),
		index("area_snapshots_tanggal_idx").on(table.tanggal),
	]
);

export const officers = pgTable("officers", {
	id: text("id").primaryKey(),
	nama: text("nama").notNull(),
	peran: text("peran").notNull(),
	telepon: text("telepon").notNull(),
	wilayahTugas: text("wilayah_tugas").notNull(),
	status: text("status", { enum: ["SIAP_TUGAS", "SEDANG_BERTUGAS", "OFFLINE"] })
		.notNull()
		.default("SIAP_TUGAS"),
	avatar: text("avatar"),
	// Optional link to a login account (role petugas_lapangan) so that officer
	// can see their own assigned incidents on /dashboard/tugas-saya. Roster
	// entries with no login account (most field crews today) stay usable
	// everywhere else -- this is purely additive.
	userId: text("user_id")
		.unique()
		.references(() => users.id, { onDelete: "set null" }),
	createdAt: timestamp("created_at", { mode: "date" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp("updated_at", { mode: "date" })
		.notNull()
		.$defaultFn(() => new Date()),
});

/**
 * Insiden = candidate litter/dumping detections, either AI-flagged by the
 * cron detection cycle (`jalankanSiklusDeteksi`) or promoted from a verified
 * citizen report (`verifikasiLaporan`). bbox columns are normalized 0..1
 * image-space coordinates from the detector, not pixels — resolution differs
 * per camera.
 *
 * `cameraId` is nullable BECAUSE of that second source: a citizen report has
 * GPS coordinates but no camera. Every read path therefore uses `leftJoin` on
 * `cameras` and falls back to `lokasiTeks`/`latitude`/`longitude` — never
 * `innerJoin`, which would silently hide every citizen-sourced incident.
 */
export const incidents = pgTable(
	"incidents",
	{
		id: text("id").primaryKey(),
		cameraId: text("camera_id").references(() => cameras.id),
		/** Asal insiden. Menentukan apakah lokasi dibaca dari kamera atau dari kolom lat/lon di bawah. */
		sumber: text("sumber", { enum: ["CCTV", "LAPORAN_WARGA"] })
			.notNull()
			.default("CCTV"),
		/** Laporan warga asal insiden ini (hanya untuk sumber LAPORAN_WARGA). */
		laporanId: text("laporan_id").references((): AnyPgColumn => publicReports.id, {
			onDelete: "set null",
		}),
		// Lokasi untuk insiden tanpa kamera. Untuk sumber CCTV kolom ini kosong
		// dan lokasi tetap diambil dari baris `cameras` supaya tidak ada dua
		// sumber kebenaran yang bisa berbeda saat kamera dipindahkan.
		latitude: text("latitude"),
		longitude: text("longitude"),
		lokasiTeks: text("lokasi_teks"),
		jenisSampah: text("jenis_sampah", {
			enum: [
				"tumpukan_sampah",
				"kantong_plastik",
				"kardus_kemasan",
				"botol_minuman",
				"pembuangan_liar_besar",
				"puing_bangunan",
			],
		}).notNull(),
		// Raw model class name (e.g. "Pile") -- kept alongside the mapped
		// jenisSampah enum so the mapping can be audited/re-derived later.
		labelSampah: text("label_sampah").notNull(),
		pertamaDilihat: timestamp("pertama_dilihat", { mode: "date" }).notNull(),
		terakhirDilihat: timestamp("terakhir_dilihat", { mode: "date" }).notNull(),
		status: text("status", { enum: ["AKTIF", "PERINGATAN", "SELESAI", "POSITIF_PALSU"] })
			.notNull()
			.default("AKTIF"),
		keparahan: text("keparahan", { enum: ["KRITIS", "TINGGI", "SEDANG", "RENDAH"] }).notNull(),
		tingkatKepercayaan: text("tingkat_kepercayaan").notNull(),
		urlSnapshot: text("url_snapshot").notNull(),
		// Preserved from the very first detection -- `urlSnapshot` above gets
		// overwritten on every persistence match, so this is the only way to show
		// a "sebelum vs sesudah" comparison on the incident detail/timeline page.
		urlSnapshotPertama: text("url_snapshot_pertama"),
		petugasDitugaskan: text("petugas_ditugaskan").references(() => officers.id, {
			onDelete: "set null",
		}),
		buktiFotoUrl: text("bukti_foto_url"),
		// Officer's free-text account of what was done, captured alongside the
		// evidence photo in selesaikanInsiden(). Optional -- older rows and
		// tandaiPositifPalsu() resolutions have none.
		catatanPenyelesaian: text("catatan_penyelesaian"),
		statusSla: text("status_sla", { enum: ["TEPAT_WAKTU", "HAMPIR_BREACH", "MELANGGAR_SLA"] })
			.notNull()
			.default("TEPAT_WAKTU"),

		/**
		 * Skor prioritas 0..100 dari `$lib/server/novira/prioritas.ts`, dihitung
		 * ulang tiap siklus deteksi & tiap eskalasi. Disimpan (bukan dihitung
		 * saat render) supaya bisa diurutkan di SQL dan supaya angka yang
		 * dilihat operator sama persis dengan yang tercatat di audit log.
		 */
		skorPrioritas: integer("skor_prioritas").notNull().default(0),
		/** JSON array faktor pembentuk skor — inilah yang membuat skor bisa dijelaskan, bukan angka ajaib. */
		rincianPrioritas: text("rincian_prioritas"),

		/**
		 * Tangga eskalasi SLA: 0 belum, 1 diingatkan petugas (12 jam),
		 * 2 kepala seksi (24 jam), 3 kepala dinas (48 jam). Monoton naik —
		 * `eskalasi.ts` hanya menaikkan, tidak pernah menurunkan, sehingga cron
		 * yang jalan berulang tidak mengirim notifikasi ganda.
		 */
		tingkatEskalasi: integer("tingkat_eskalasi").notNull().default(0),
		terakhirEskalasiPada: timestamp("terakhir_eskalasi_pada", { mode: "date" }),

		bboxX: text("bbox_x").notNull(),
		bboxY: text("bbox_y").notNull(),
		bboxWidth: text("bbox_width").notNull(),
		bboxHeight: text("bbox_height").notNull(),
		createdAt: timestamp("created_at", { mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index("incidents_camera_status_idx").on(table.cameraId, table.status),
		index("incidents_status_idx").on(table.status),
		// Antrian kerja operator diurutkan prioritas-turun di dalam status terbuka.
		index("incidents_status_prioritas_idx").on(table.status, table.skorPrioritas),
	]
);

export const auditLog = pgTable(
	"audit_log",
	{
		id: text("id").primaryKey(),
		waktu: timestamp("waktu", { mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
		pengguna: text("pengguna").notNull(),
		peran: text("peran").notNull(),
		tindakan: text("tindakan").notNull(),
		rincian: text("rincian").notNull(),
		wilayah: text("wilayah").notNull(),
		tipe: text("tipe", {
			enum: [
				"DETEKSI_AI",
				"TUGAS_PETUGAS",
				"UBAH_STATUS",
				"KONFIGURASI",
				"LAPORAN_WARGA",
				"ESKALASI",
			],
		}).notNull(),
		// Nullable: cycle-level rows (siklus deteksi, cek kesehatan kamera) cover
		// many/no incidents at once and leave this unset. Per-incident actions
		// (tugaskan/selesaikan/positif palsu) set it so the incident detail page
		// can query its own timeline instead of grep-ing free text.
		incidentId: text("incident_id").references(() => incidents.id, { onDelete: "set null" }),
	},
	(table) => [
		index("audit_log_waktu_idx").on(table.waktu),
		index("audit_log_incident_id_idx").on(table.incidentId),
	]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type Camera = typeof cameras.$inferSelect;
export type NewCamera = typeof cameras.$inferInsert;
export type PublicReport = typeof publicReports.$inferSelect;
export type NewPublicReport = typeof publicReports.$inferInsert;
export type Officer = typeof officers.$inferSelect;
export type NewOfficer = typeof officers.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type ReporterTrust = typeof reporterTrust.$inferSelect;
export type AreaSnapshot = typeof areaSnapshots.$inferSelect;
export type NewAreaSnapshot = typeof areaSnapshots.$inferInsert;
