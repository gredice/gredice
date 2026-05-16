ALTER TABLE "operations" ADD COLUMN "farm_id" integer;--> statement-breakpoint
CREATE INDEX "operations_farm_id_idx" ON "operations" USING btree ("farm_id");