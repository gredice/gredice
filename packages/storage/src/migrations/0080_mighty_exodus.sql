CREATE TABLE "raised_bed_planting_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"planting_id" integer NOT NULL,
	"raised_bed_field_id" integer NOT NULL,
	"relative_row" integer NOT NULL,
	"relative_column" integer NOT NULL,
	"is_anchor" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "raised_bed_planting_fields_relative_position_check" CHECK ("raised_bed_planting_fields"."relative_row" >= 0 AND "raised_bed_planting_fields"."relative_column" >= 0)
);
--> statement-breakpoint
CREATE TABLE "raised_bed_plantings" (
	"id" serial PRIMARY KEY NOT NULL,
	"raised_bed_id" integer NOT NULL,
	"plant_sort_id" integer NOT NULL,
	"event_aggregate_id" text NOT NULL,
	"legacy_plant_place_event_id" integer,
	"anchor_position_index" integer NOT NULL,
	"selected_seeding_distance_cm" double precision,
	"min_seeding_distance_cm" double precision,
	"optimal_seeding_distance_cm" double precision,
	"max_seeding_distance_cm" double precision,
	"plants_per_axis" integer,
	"plant_count" integer,
	"layout_key" text,
	"span_rows" integer DEFAULT 1 NOT NULL,
	"span_columns" integer DEFAULT 1 NOT NULL,
	"layout_version" integer DEFAULT 1 NOT NULL,
	"configuration_source" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "raised_bed_plantings_configuration_source_check" CHECK ("raised_bed_plantings"."configuration_source" IN ('legacy', 'selected')),
	CONSTRAINT "raised_bed_plantings_anchor_position_check" CHECK ("raised_bed_plantings"."anchor_position_index" >= 0),
	CONSTRAINT "raised_bed_plantings_span_check" CHECK ("raised_bed_plantings"."span_rows" > 0 AND "raised_bed_plantings"."span_columns" > 0),
	CONSTRAINT "raised_bed_plantings_layout_version_check" CHECK ("raised_bed_plantings"."layout_version" > 0),
	CONSTRAINT "raised_bed_plantings_distance_check" CHECK ("raised_bed_plantings"."selected_seeding_distance_cm" IS NULL OR "raised_bed_plantings"."selected_seeding_distance_cm" > 0),
	CONSTRAINT "raised_bed_plantings_min_distance_check" CHECK ("raised_bed_plantings"."min_seeding_distance_cm" IS NULL OR "raised_bed_plantings"."min_seeding_distance_cm" > 0),
	CONSTRAINT "raised_bed_plantings_optimal_distance_check" CHECK ("raised_bed_plantings"."optimal_seeding_distance_cm" IS NULL OR "raised_bed_plantings"."optimal_seeding_distance_cm" > 0),
	CONSTRAINT "raised_bed_plantings_max_distance_check" CHECK ("raised_bed_plantings"."max_seeding_distance_cm" IS NULL OR "raised_bed_plantings"."max_seeding_distance_cm" > 0),
	CONSTRAINT "raised_bed_plantings_plants_per_axis_check" CHECK ("raised_bed_plantings"."plants_per_axis" IS NULL OR "raised_bed_plantings"."plants_per_axis" > 0),
	CONSTRAINT "raised_bed_plantings_plant_count_check" CHECK ("raised_bed_plantings"."plant_count" IS NULL OR "raised_bed_plantings"."plant_count" > 0),
	CONSTRAINT "raised_bed_plantings_legacy_event_check" CHECK ("raised_bed_plantings"."legacy_plant_place_event_id" IS NULL OR "raised_bed_plantings"."legacy_plant_place_event_id" > 0),
	CONSTRAINT "raised_bed_plantings_selected_configuration_check" CHECK ("raised_bed_plantings"."configuration_source" <> 'selected' OR ("raised_bed_plantings"."legacy_plant_place_event_id" IS NULL AND "raised_bed_plantings"."selected_seeding_distance_cm" IS NOT NULL AND "raised_bed_plantings"."min_seeding_distance_cm" IS NOT NULL AND "raised_bed_plantings"."optimal_seeding_distance_cm" IS NOT NULL AND "raised_bed_plantings"."max_seeding_distance_cm" IS NOT NULL AND "raised_bed_plantings"."plants_per_axis" IS NOT NULL AND "raised_bed_plantings"."plant_count" IS NOT NULL AND "raised_bed_plantings"."layout_key" IS NOT NULL AND "raised_bed_plantings"."layout_version" = 1 AND "raised_bed_plantings"."min_seeding_distance_cm" <= "raised_bed_plantings"."optimal_seeding_distance_cm" AND "raised_bed_plantings"."optimal_seeding_distance_cm" <= "raised_bed_plantings"."max_seeding_distance_cm" AND "raised_bed_plantings"."min_seeding_distance_cm" <= "raised_bed_plantings"."selected_seeding_distance_cm" AND "raised_bed_plantings"."selected_seeding_distance_cm" <= "raised_bed_plantings"."max_seeding_distance_cm")),
	CONSTRAINT "raised_bed_plantings_legacy_configuration_check" CHECK ("raised_bed_plantings"."configuration_source" <> 'legacy' OR ("raised_bed_plantings"."legacy_plant_place_event_id" IS NOT NULL AND "raised_bed_plantings"."selected_seeding_distance_cm" IS NULL AND "raised_bed_plantings"."min_seeding_distance_cm" IS NULL AND "raised_bed_plantings"."optimal_seeding_distance_cm" IS NULL AND "raised_bed_plantings"."max_seeding_distance_cm" IS NULL AND "raised_bed_plantings"."plants_per_axis" IS NULL AND "raised_bed_plantings"."plant_count" IS NULL AND "raised_bed_plantings"."layout_key" IS NULL AND "raised_bed_plantings"."span_rows" = 1 AND "raised_bed_plantings"."span_columns" = 1 AND "raised_bed_plantings"."layout_version" = 1))
);
--> statement-breakpoint
CREATE TABLE "shopping_cart_item_advanced_sowing_authorizations" (
	"cart_item_id" integer PRIMARY KEY NOT NULL,
	"authorization" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raised_bed_planting_fields" ADD CONSTRAINT "raised_bed_planting_fields_planting_id_raised_bed_plantings_id_fk" FOREIGN KEY ("planting_id") REFERENCES "public"."raised_bed_plantings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raised_bed_planting_fields" ADD CONSTRAINT "raised_bed_planting_fields_raised_bed_field_id_raised_bed_fields_id_fk" FOREIGN KEY ("raised_bed_field_id") REFERENCES "public"."raised_bed_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raised_bed_plantings" ADD CONSTRAINT "raised_bed_plantings_raised_bed_id_raised_beds_id_fk" FOREIGN KEY ("raised_bed_id") REFERENCES "public"."raised_beds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raised_bed_plantings" ADD CONSTRAINT "raised_bed_plantings_plant_sort_id_entities_id_fk" FOREIGN KEY ("plant_sort_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_cart_item_advanced_sowing_authorizations" ADD CONSTRAINT "shopping_cart_item_advanced_sowing_authorizations_cart_item_id_shopping_cart_items_id_fk" FOREIGN KEY ("cart_item_id") REFERENCES "public"."shopping_cart_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "raised_bed_planting_fields_planting_field_uq" ON "raised_bed_planting_fields" USING btree ("planting_id","raised_bed_field_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raised_bed_planting_fields_planting_coordinate_uq" ON "raised_bed_planting_fields" USING btree ("planting_id","relative_row","relative_column");--> statement-breakpoint
CREATE INDEX "raised_bed_planting_fields_planting_id_idx" ON "raised_bed_planting_fields" USING btree ("planting_id");--> statement-breakpoint
CREATE INDEX "raised_bed_planting_fields_field_id_idx" ON "raised_bed_planting_fields" USING btree ("raised_bed_field_id");--> statement-breakpoint
CREATE INDEX "raised_bed_planting_fields_is_deleted_idx" ON "raised_bed_planting_fields" USING btree ("is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "raised_bed_plantings_event_aggregate_id_uq" ON "raised_bed_plantings" USING btree ("event_aggregate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raised_bed_plantings_legacy_place_event_id_uq" ON "raised_bed_plantings" USING btree ("legacy_plant_place_event_id");--> statement-breakpoint
CREATE INDEX "raised_bed_plantings_raised_bed_id_idx" ON "raised_bed_plantings" USING btree ("raised_bed_id");--> statement-breakpoint
CREATE INDEX "raised_bed_plantings_plant_sort_id_idx" ON "raised_bed_plantings" USING btree ("plant_sort_id");--> statement-breakpoint
CREATE INDEX "raised_bed_plantings_layout_key_idx" ON "raised_bed_plantings" USING btree ("layout_key");--> statement-breakpoint
CREATE INDEX "raised_bed_plantings_is_active_idx" ON "raised_bed_plantings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "raised_bed_plantings_is_deleted_idx" ON "raised_bed_plantings" USING btree ("is_deleted");