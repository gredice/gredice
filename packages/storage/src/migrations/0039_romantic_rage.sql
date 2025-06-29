ALTER TABLE "notifications" ADD COLUMN "raised_bed_id" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "timestamp" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_raised_bed_id_raised_beds_id_fk" FOREIGN KEY ("raised_bed_id") REFERENCES "public"."raised_beds"("id") ON DELETE no action ON UPDATE no action;