CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"waktu" timestamp NOT NULL,
	"pengguna" text NOT NULL,
	"peran" text NOT NULL,
	"tindakan" text NOT NULL,
	"rincian" text NOT NULL,
	"wilayah" text NOT NULL,
	"tipe" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"camera_id" text NOT NULL,
	"jenis_sampah" text NOT NULL,
	"label_sampah" text NOT NULL,
	"pertama_dilihat" timestamp NOT NULL,
	"terakhir_dilihat" timestamp NOT NULL,
	"status" text DEFAULT 'AKTIF' NOT NULL,
	"keparahan" text NOT NULL,
	"tingkat_kepercayaan" text NOT NULL,
	"url_snapshot" text NOT NULL,
	"petugas_ditugaskan" text,
	"bukti_foto_url" text,
	"status_sla" text DEFAULT 'TEPAT_WAKTU' NOT NULL,
	"bbox_x" text NOT NULL,
	"bbox_y" text NOT NULL,
	"bbox_width" text NOT NULL,
	"bbox_height" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "officers" (
	"id" text PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"peran" text NOT NULL,
	"telepon" text NOT NULL,
	"wilayah_tugas" text NOT NULL,
	"status" text DEFAULT 'SIAP_TUGAS' NOT NULL,
	"avatar" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_camera_id_cameras_id_fk" FOREIGN KEY ("camera_id") REFERENCES "public"."cameras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_petugas_ditugaskan_officers_id_fk" FOREIGN KEY ("petugas_ditugaskan") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_waktu_idx" ON "audit_log" USING btree ("waktu");--> statement-breakpoint
CREATE INDEX "incidents_camera_status_idx" ON "incidents" USING btree ("camera_id","status");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "incidents" USING btree ("status");