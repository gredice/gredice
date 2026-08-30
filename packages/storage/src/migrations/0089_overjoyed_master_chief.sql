CREATE TABLE "garden_structure_operations" (
	"garden_id" integer NOT NULL,
	"operation_id" text NOT NULL,
	"structure_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"result_revision" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "garden_structure_operations_garden_operation_pk" PRIMARY KEY("garden_id","operation_id"),
	CONSTRAINT "garden_structure_operations_operation_id_length_check" CHECK (char_length("garden_structure_operations"."operation_id") between 1 and 96),
	CONSTRAINT "garden_structure_operations_kind_check" CHECK ("garden_structure_operations"."kind" in ('create', 'replace', 'resize', 'placement', 'delete')),
	CONSTRAINT "garden_structure_operations_payload_hash_check" CHECK ("garden_structure_operations"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "garden_structure_operations_response_shape_check" CHECK (jsonb_typeof("garden_structure_operations"."response") = 'object'),
	CONSTRAINT "garden_structure_operations_response_size_check" CHECK (octet_length("garden_structure_operations"."response"::text) <= 8388608),
	CONSTRAINT "garden_structure_operations_result_revision_check" CHECK ("garden_structure_operations"."result_revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "garden_structures" (
	"id" text PRIMARY KEY NOT NULL,
	"garden_id" integer NOT NULL,
	"anchor_x" integer NOT NULL,
	"anchor_y" integer NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"template_key" text NOT NULL,
	"kit_key" text NOT NULL,
	"kit_version" text NOT NULL,
	"pricing_version" integer DEFAULT 1 NOT NULL,
	"sunflower_price_per_cell" integer DEFAULT 50 NOT NULL,
	"refundable_sunflower_principal" integer DEFAULT 0 NOT NULL,
	"document" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "garden_structures_id_length_check" CHECK (char_length("garden_structures"."id") between 1 and 96),
	CONSTRAINT "garden_structures_rotation_check" CHECK ("garden_structures"."rotation" between 0 and 3),
	CONSTRAINT "garden_structures_revision_check" CHECK ("garden_structures"."revision" > 0),
	CONSTRAINT "garden_structures_template_key_check" CHECK ("garden_structures"."template_key" in ('barn', 'house', 'greenhouse', 'blank')),
	CONSTRAINT "garden_structures_kit_key_length_check" CHECK (char_length("garden_structures"."kit_key") between 1 and 96),
	CONSTRAINT "garden_structures_kit_version_length_check" CHECK (char_length("garden_structures"."kit_version") between 1 and 96),
	CONSTRAINT "garden_structures_pricing_version_check" CHECK ("garden_structures"."pricing_version" > 0),
	CONSTRAINT "garden_structures_unit_price_check" CHECK ("garden_structures"."sunflower_price_per_cell" >= 0),
	CONSTRAINT "garden_structures_refundable_principal_check" CHECK ("garden_structures"."refundable_sunflower_principal" >= 0),
	CONSTRAINT "garden_structures_document_shape_check" CHECK (jsonb_typeof("garden_structures"."document") = 'object' and "garden_structures"."document"->>'schemaVersion' = '1' and coalesce(jsonb_typeof("garden_structures"."document"->'footprint'->'cells'), '') = 'array'),
	CONSTRAINT "garden_structures_document_size_check" CHECK (octet_length("garden_structures"."document"::text) <= 8388608),
	CONSTRAINT "garden_structures_principal_bound_check" CHECK ("garden_structures"."refundable_sunflower_principal" <= jsonb_array_length("garden_structures"."document"->'footprint'->'cells') * "garden_structures"."sunflower_price_per_cell"),
	CONSTRAINT "garden_structures_deleted_principal_check" CHECK ("garden_structures"."is_deleted" = false or "garden_structures"."refundable_sunflower_principal" = 0)
);
--> statement-breakpoint
ALTER TABLE "garden_structure_operations" ADD CONSTRAINT "garden_structure_operations_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "garden_structures_garden_id_id_uq" ON "garden_structures" USING btree ("garden_id","id");--> statement-breakpoint
ALTER TABLE "garden_structure_operations" ADD CONSTRAINT "garden_structure_operations_garden_structure_fk" FOREIGN KEY ("garden_id","structure_id") REFERENCES "public"."garden_structures"("garden_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_structures" ADD CONSTRAINT "garden_structures_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "garden_structure_operations_structure_id_idx" ON "garden_structure_operations" USING btree ("structure_id");--> statement-breakpoint
CREATE INDEX "garden_structures_active_garden_id_idx" ON "garden_structures" USING btree ("garden_id","id") WHERE "garden_structures"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "garden_structures_is_deleted_idx" ON "garden_structures" USING btree ("is_deleted");
