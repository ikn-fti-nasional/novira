import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema.js";
import { hashPassword } from "../password.js";
import { generateId } from "../id.js";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
	id text PRIMARY KEY NOT NULL,
	email text NOT NULL,
	username text NOT NULL,
	password_hash text NOT NULL,
	name text NOT NULL,
	avatar_url text,
	role text DEFAULT 'operator' NOT NULL,
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username);

CREATE TABLE IF NOT EXISTS sessions (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL REFERENCES users(id),
	expires_at bigint NOT NULL,
	user_agent text,
	ip_address text,
	created_at timestamp
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL REFERENCES users(id),
	token_hash text NOT NULL,
	expires_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
	id text PRIMARY KEY NOT NULL,
	title text NOT NULL,
	slug text NOT NULL,
	content text DEFAULT '' NOT NULL,
	template text DEFAULT 'default' NOT NULL,
	status text DEFAULT 'draft' NOT NULL,
	author_id text NOT NULL REFERENCES users(id),
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL,
	published_at timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS pages_slug_unique ON pages (slug);

CREATE TABLE IF NOT EXISTS notifications (
	id text PRIMARY KEY NOT NULL,
	user_id text REFERENCES users(id),
	title text NOT NULL,
	message text NOT NULL,
	type text DEFAULT 'info' NOT NULL,
	read boolean DEFAULT false NOT NULL,
	created_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_reads (
	notification_id text NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
	user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	read boolean DEFAULT false NOT NULL,
	dismissed boolean DEFAULT false NOT NULL,
	updated_at timestamp NOT NULL,
	PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS app_settings (
	key text PRIMARY KEY NOT NULL,
	value text NOT NULL,
	updated_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS cameras (
	id text PRIMARY KEY NOT NULL,
	nama text NOT NULL,
	kota text NOT NULL,
	kecamatan text,
	kelurahan text,
	url_stream text,
	url_snapshot text,
	status text DEFAULT 'OFFLINE' NOT NULL,
	latitude text,
	longitude text,
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS public_reports (
	id text PRIMARY KEY NOT NULL,
	kode_tracking text NOT NULL UNIQUE,
	pelapor_nama text,
	pelapor_telepon text,
	deskripsi text,
	jenis_sampah text,
	url_foto text,
	url_video text,
	latitude text,
	longitude text,
	kota text,
	kecamatan text,
	status text DEFAULT 'MENUNGGU' NOT NULL,
	catatan_petugas text,
	diproses_oleh text REFERENCES users(id),
	ai_skor text,
	ai_label text,
	ai_jumlah_deteksi integer,
	ai_rekomendasi text,
	ai_rincian text,
	ai_dipindai_pada timestamp,
	-- insiden_id sengaja tanpa REFERENCES di sini: public_reports dibuat
	-- sebelum incidents, dan keduanya saling menunjuk. Di Postgres asli
	-- Drizzle menambahkan constraint-nya lewat ALTER TABLE terpisah.
	insiden_id text,
	duplikat_dari_id text,
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS reporter_trust (
	telepon text PRIMARY KEY NOT NULL,
	laporan_total integer DEFAULT 0 NOT NULL,
	laporan_valid integer DEFAULT 0 NOT NULL,
	laporan_ditolak integer DEFAULT 0 NOT NULL,
	skor integer DEFAULT 50 NOT NULL,
	updated_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS area_snapshots (
	id text PRIMARY KEY NOT NULL,
	tanggal text NOT NULL,
	kecamatan text NOT NULL,
	kota text NOT NULL,
	skor_kebersihan integer NOT NULL,
	jumlah_insiden integer DEFAULT 0 NOT NULL,
	insiden_baru integer DEFAULT 0 NOT NULL,
	insiden_selesai integer DEFAULT 0 NOT NULL,
	rata_rata_durasi_jam text DEFAULT '0' NOT NULL,
	created_at timestamp NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS area_snapshots_tanggal_area_idx
	ON area_snapshots (tanggal, kota, kecamatan);

CREATE TABLE IF NOT EXISTS officers (
	id text PRIMARY KEY NOT NULL,
	nama text NOT NULL,
	peran text NOT NULL,
	telepon text NOT NULL,
	wilayah_tugas text NOT NULL,
	status text DEFAULT 'SIAP_TUGAS' NOT NULL,
	avatar text,
	user_id text UNIQUE REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
	id text PRIMARY KEY NOT NULL,
	camera_id text REFERENCES cameras(id),
	sumber text DEFAULT 'CCTV' NOT NULL,
	laporan_id text REFERENCES public_reports(id) ON DELETE SET NULL,
	latitude text,
	longitude text,
	lokasi_teks text,
	jenis_sampah text NOT NULL,
	label_sampah text NOT NULL,
	pertama_dilihat timestamp NOT NULL,
	terakhir_dilihat timestamp NOT NULL,
	status text DEFAULT 'AKTIF' NOT NULL,
	keparahan text NOT NULL,
	tingkat_kepercayaan text NOT NULL,
	url_snapshot text NOT NULL,
	url_snapshot_pertama text,
	petugas_ditugaskan text REFERENCES officers(id) ON DELETE SET NULL,
	bukti_foto_url text,
	catatan_penyelesaian text,
	status_sla text DEFAULT 'TEPAT_WAKTU' NOT NULL,
	skor_prioritas integer DEFAULT 0 NOT NULL,
	rincian_prioritas text,
	tingkat_eskalasi integer DEFAULT 0 NOT NULL,
	terakhir_eskalasi_pada timestamp,
	bbox_x text NOT NULL,
	bbox_y text NOT NULL,
	bbox_width text NOT NULL,
	bbox_height text NOT NULL,
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
	id text PRIMARY KEY NOT NULL,
	waktu timestamp NOT NULL,
	pengguna text NOT NULL,
	peran text NOT NULL,
	tindakan text NOT NULL,
	rincian text NOT NULL,
	wilayah text NOT NULL,
	tipe text NOT NULL,
	incident_id text REFERENCES incidents(id) ON DELETE SET NULL
);
`;

export async function createTestDb() {
	const client = new PGlite();
	const db = drizzle(client, { schema });
	await client.exec(SCHEMA_SQL);
	return db;
}

export async function createTestUser(
	db: Awaited<ReturnType<typeof createTestDb>>,
	overrides: Partial<{
		id: string;
		name: string;
		email: string;
		username: string;
		role: "admin" | "operator" | "kepala_seksi" | "kepala_dinas" | "walikota" | "petugas_lapangan";
	}> = {}
) {
	const id = overrides.id ?? generateId(10);
	const passwordHash = await hashPassword("password123");

	await db.insert(schema.users).values({
		id,
		name: overrides.name ?? "Test User",
		email: overrides.email ?? `${id}@test.com`,
		username: overrides.username ?? `user_${id.slice(0, 8)}`,
		passwordHash,
		role: overrides.role ?? "operator",
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	return id;
}

export function createMockLocals(userId: string, role: string = "admin") {
	return {
		user: {
			id: userId,
			name: "Test User",
			email: "test@test.com",
			username: "testuser",
			role,
		},
		session: { id: "test-session", userId, expiresAt: Date.now() + 86400000 },
	};
}

export function createFormData(entries: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [key, value] of Object.entries(entries)) {
		fd.set(key, value);
	}
	return fd;
}

export function createMockRequest(formData: FormData): Request {
	return new Request("http://localhost", {
		method: "POST",
		body: formData,
	});
}
