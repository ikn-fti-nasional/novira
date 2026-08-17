CREATE TABLE "cameras" (
	"id" text PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"kota" text NOT NULL,
	"kecamatan" text,
	"url_stream" text,
	"url_snapshot" text,
	"status" text DEFAULT 'OFFLINE' NOT NULL,
	"latitude" text,
	"longitude" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"notification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "notification_reads_notification_id_user_id_pk" PRIMARY KEY("notification_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "public_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"pelapor_nama" text,
	"pelapor_telepon" text,
	"deskripsi" text,
	"jenis_sampah" text,
	"url_foto" text,
	"url_video" text,
	"latitude" text,
	"longitude" text,
	"kota" text,
	"kecamatan" text,
	"status" text DEFAULT 'MENUNGGU' NOT NULL,
	"catatan_petugas" text,
	"diproses_oleh" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_reports" ADD CONSTRAINT "public_reports_diproses_oleh_users_id_fk" FOREIGN KEY ("diproses_oleh") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_reports_status_created_idx" ON "public_reports" USING btree ("status","created_at");