ALTER TABLE "incidents" DROP CONSTRAINT "incidents_petugas_ditugaskan_officers_id_fk";
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_petugas_ditugaskan_officers_id_fk" FOREIGN KEY ("petugas_ditugaskan") REFERENCES "public"."officers"("id") ON DELETE set null ON UPDATE no action;