CREATE TABLE "area_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"tanggal" text NOT NULL,
	"kecamatan" text NOT NULL,
	"kota" text NOT NULL,
	"skor_kebersihan" integer NOT NULL,
	"jumlah_insiden" integer DEFAULT 0 NOT NULL,
	"insiden_baru" integer DEFAULT 0 NOT NULL,
	"insiden_selesai" integer DEFAULT 0 NOT NULL,
	"rata_rata_durasi_jam" text DEFAULT '0' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reporter_trust" (
	"telepon" text PRIMARY KEY NOT NULL,
	"laporan_total" integer DEFAULT 0 NOT NULL,
	"laporan_valid" integer DEFAULT 0 NOT NULL,
	"laporan_ditolak" integer DEFAULT 0 NOT NULL,
	"skor" integer DEFAULT 50 NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incidents" ALTER COLUMN "camera_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cameras" ADD COLUMN "kelurahan" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "sumber" text DEFAULT 'CCTV' NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "laporan_id" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "latitude" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "longitude" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "lokasi_teks" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "skor_prioritas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "rincian_prioritas" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "tingkat_eskalasi" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "terakhir_eskalasi_pada" timestamp;--> statement-breakpoint
ALTER TABLE "public_reports" ADD COLUMN "kode_tracking" text NOT NULL;--> statement-breakpoint
ALTER TABLE "public_reports" ADD COLUMN "ai_skor" text;--> statement-breakpoint
ALTER TABLE "public_reports" ADD COLUMN "ai_label" text;--> statement-breakpoint
ALTER TABLE "public_reports" ADD COLUMN "ai_jumlah_deteksi" integer;--> statement-breakpoint
ALTER TABLE "public_reports" ADD COLUMN "ai_rekomendasi" text;--> statement-breakpoint
ALTER TABLE "public_reports" ADD COLUMN "ai_rincian" text;--> statement-breakpoint
ALTER TABLE "public_reports" ADD COLUMN "ai_dipindai_pada" timestamp;--> statement-breakpoint
ALTER TABLE "public_reports" ADD COLUMN "ai_model_type" text;--> statement-breakpoint
ALTER TABLE "public_reports" ADD COLUMN "ai_annotated_url" text;--> statement-breakpoint
ALTER TABLE "public_reports" ADD COLUMN "insiden_id" text;--> statement-breakpoint
ALTER TABLE "public_reports" ADD COLUMN "duplikat_dari_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "area_snapshots_tanggal_area_idx" ON "area_snapshots" USING btree ("tanggal","kota","kecamatan");--> statement-breakpoint
CREATE INDEX "area_snapshots_tanggal_idx" ON "area_snapshots" USING btree ("tanggal");--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_laporan_id_public_reports_id_fk" FOREIGN KEY ("laporan_id") REFERENCES "public"."public_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_reports" ADD CONSTRAINT "public_reports_insiden_id_incidents_id_fk" FOREIGN KEY ("insiden_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_reports" ADD CONSTRAINT "public_reports_duplikat_dari_id_public_reports_id_fk" FOREIGN KEY ("duplikat_dari_id") REFERENCES "public"."public_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incidents_status_prioritas_idx" ON "incidents" USING btree ("status","skor_prioritas");--> statement-breakpoint
CREATE INDEX "public_reports_telepon_idx" ON "public_reports" USING btree ("pelapor_telepon");--> statement-breakpoint
ALTER TABLE "public_reports" ADD CONSTRAINT "public_reports_kode_tracking_unique" UNIQUE("kode_tracking");