ALTER TABLE "entity_types" ADD COLUMN "inventory_source_attribute_definition_id" integer;--> statement-breakpoint
ALTER TABLE "entity_types" ADD CONSTRAINT "entity_types_inventory_source_attribute_definition_id_attribute_definitions_id_fk" FOREIGN KEY ("inventory_source_attribute_definition_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cms_et_inventory_source_attr_def_idx" ON "entity_types" USING btree ("inventory_source_attribute_definition_id");
--> statement-breakpoint
UPDATE "entity_types" AS "target"
SET "inventory_source_attribute_definition_id" = "source"."id"
FROM "attribute_definitions" AS "source"
WHERE "target"."name" = 'plantSort'
	AND "target"."is_deleted" = false
	AND "source"."entity_type" = 'seed'
	AND "source"."category" = 'information'
	AND "source"."name" = 'plantSort'
	AND "source"."data_type" = 'ref:plantSort'
	AND "source"."is_deleted" = false;
