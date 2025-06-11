CREATE TABLE "raised_bed_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"raised_bed_id" integer NOT NULL,
	"position_index" integer NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raised_bed_fields" ADD CONSTRAINT "raised_bed_fields_raised_bed_id_raised_beds_id_fk" FOREIGN KEY ("raised_bed_id") REFERENCES "public"."raised_beds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "raised_bed_fields_raised_bed_id_idx" ON "raised_bed_fields" USING btree ("raised_bed_id");--> statement-breakpoint
CREATE INDEX "raised_bed_fields_is_deleted_idx" ON "raised_bed_fields" USING btree ("is_deleted");