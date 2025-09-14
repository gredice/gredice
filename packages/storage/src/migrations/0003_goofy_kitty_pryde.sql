ALTER TABLE "entity_types" ADD COLUMN "is_root" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "cms_et_is_root_idx" ON "entity_types" USING btree ("is_root");