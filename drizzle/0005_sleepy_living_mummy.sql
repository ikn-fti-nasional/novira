ALTER TABLE "audit_log" ADD COLUMN "incident_id" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "url_snapshot_pertama" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "catatan_penyelesaian" text;--> statement-breakpoint
ALTER TABLE "officers" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officers" ADD CONSTRAINT "officers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_incident_id_idx" ON "audit_log" USING btree ("incident_id");--> statement-breakpoint
ALTER TABLE "officers" ADD CONSTRAINT "officers_user_id_unique" UNIQUE("user_id");