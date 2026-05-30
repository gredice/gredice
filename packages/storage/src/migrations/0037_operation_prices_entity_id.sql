ALTER TABLE "operation_prices" ADD COLUMN "entity_id" integer;
--> statement-breakpoint
DROP INDEX "operation_prices_farm_entity_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "operation_prices_farm_type_null_unique" ON "operation_prices" USING btree ("farm_id","entity_type_name") WHERE "entity_id" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "operation_prices_farm_type_entity_unique" ON "operation_prices" USING btree ("farm_id","entity_type_name","entity_id") WHERE "entity_id" IS NOT NULL;
