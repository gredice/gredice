CREATE TABLE "harvest_trace_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_token" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"account_id" text NOT NULL,
	"garden_id" integer NOT NULL,
	"raised_bed_id" integer NOT NULL,
	"raised_bed_field_id" integer NOT NULL,
	"field_position_index" integer NOT NULL,
	"field_label" text NOT NULL,
	"plant_place_event_id" integer NOT NULL,
	"plant_sort_id" integer,
	"harvest_operation_id" integer NOT NULL,
	"trace_path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"printed_at" timestamp,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "harvest_trace_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"harvest_trace_link_id" integer NOT NULL,
	"scanned_at" timestamp DEFAULT now() NOT NULL,
	"user_agent_family" text
);
--> statement-breakpoint
ALTER TABLE "harvest_trace_links" ADD CONSTRAINT "harvest_trace_links_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_trace_links" ADD CONSTRAINT "harvest_trace_links_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_trace_links" ADD CONSTRAINT "harvest_trace_links_raised_bed_id_raised_beds_id_fk" FOREIGN KEY ("raised_bed_id") REFERENCES "public"."raised_beds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_trace_links" ADD CONSTRAINT "harvest_trace_links_raised_bed_field_id_raised_bed_fields_id_fk" FOREIGN KEY ("raised_bed_field_id") REFERENCES "public"."raised_bed_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_trace_links" ADD CONSTRAINT "harvest_trace_links_plant_place_event_id_events_id_fk" FOREIGN KEY ("plant_place_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_trace_links" ADD CONSTRAINT "harvest_trace_links_plant_sort_id_entities_id_fk" FOREIGN KEY ("plant_sort_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_trace_links" ADD CONSTRAINT "harvest_trace_links_harvest_operation_id_operations_id_fk" FOREIGN KEY ("harvest_operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_trace_scans" ADD CONSTRAINT "harvest_trace_scans_harvest_trace_link_id_harvest_trace_links_id_fk" FOREIGN KEY ("harvest_trace_link_id") REFERENCES "public"."harvest_trace_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "harvest_trace_links_public_token_unique" ON "harvest_trace_links" USING btree ("public_token");--> statement-breakpoint
CREATE UNIQUE INDEX "harvest_trace_links_target_unique" ON "harvest_trace_links" USING btree ("harvest_operation_id","raised_bed_field_id","plant_place_event_id");--> statement-breakpoint
CREATE INDEX "harvest_trace_links_status_idx" ON "harvest_trace_links" USING btree ("status");--> statement-breakpoint
CREATE INDEX "harvest_trace_links_target_idx" ON "harvest_trace_links" USING btree ("harvest_operation_id","raised_bed_id","raised_bed_field_id","plant_place_event_id");--> statement-breakpoint
CREATE INDEX "harvest_trace_links_raised_bed_idx" ON "harvest_trace_links" USING btree ("raised_bed_id");--> statement-breakpoint
CREATE INDEX "harvest_trace_links_plant_sort_idx" ON "harvest_trace_links" USING btree ("plant_sort_id");--> statement-breakpoint
CREATE INDEX "harvest_trace_links_created_at_idx" ON "harvest_trace_links" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "harvest_trace_scans_link_id_idx" ON "harvest_trace_scans" USING btree ("harvest_trace_link_id");--> statement-breakpoint
CREATE INDEX "harvest_trace_scans_scanned_at_idx" ON "harvest_trace_scans" USING btree ("scanned_at");
