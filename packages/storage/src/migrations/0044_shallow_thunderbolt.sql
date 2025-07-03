CREATE TABLE "operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_id" integer NOT NULL,
	"entity_type_name" text NOT NULL,
	"account_id" text NOT NULL,
	"garden_id" integer,
	"raised_bed_id" integer,
	"raised_bed_field_id" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "operations_entity_id_idx" ON "operations" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "operations_entity_type_name_idx" ON "operations" USING btree ("entity_type_name");--> statement-breakpoint
CREATE INDEX "operations_account_id_idx" ON "operations" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "operations_garden_id_idx" ON "operations" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "operations_raised_bed_id_idx" ON "operations" USING btree ("raised_bed_id");--> statement-breakpoint
CREATE INDEX "operations_raised_bed_field_id_idx" ON "operations" USING btree ("raised_bed_field_id");--> statement-breakpoint
CREATE INDEX "operations_timestamp_idx" ON "operations" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "operations_is_deleted_idx" ON "operations" USING btree ("is_deleted");