CREATE TABLE "inventory_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type_name" text NOT NULL,
	"label" text NOT NULL,
	"default_tracking_type" text DEFAULT 'pieces' NOT NULL,
	"status_attribute_name" text,
	"empty_status_value" text,
	"amount_attribute_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_item_field_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventory_config_id" integer NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"data_type" text DEFAULT 'text' NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"order" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventory_config_id" integer NOT NULL,
	"entity_id" integer,
	"tracking_type" text DEFAULT 'pieces' NOT NULL,
	"serial_number" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"additional_fields" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_item_field_definitions" ADD CONSTRAINT "inventory_item_field_definitions_inventory_config_id_inventory_configs_id_fk" FOREIGN KEY ("inventory_config_id") REFERENCES "public"."inventory_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_inventory_config_id_inventory_configs_id_fk" FOREIGN KEY ("inventory_config_id") REFERENCES "public"."inventory_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inv_configs_entity_type_name_idx" ON "inventory_configs" USING btree ("entity_type_name");--> statement-breakpoint
CREATE INDEX "inv_configs_is_deleted_idx" ON "inventory_configs" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "inv_field_defs_inventory_config_id_idx" ON "inventory_item_field_definitions" USING btree ("inventory_config_id");--> statement-breakpoint
CREATE INDEX "inv_field_defs_is_deleted_idx" ON "inventory_item_field_definitions" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "inv_items_inventory_config_id_idx" ON "inventory_items" USING btree ("inventory_config_id");--> statement-breakpoint
CREATE INDEX "inv_items_entity_id_idx" ON "inventory_items" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "inv_items_is_deleted_idx" ON "inventory_items" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "inv_items_tracking_type_idx" ON "inventory_items" USING btree ("tracking_type");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" USING btree ("token_hash");