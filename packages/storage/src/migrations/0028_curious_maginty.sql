ALTER TABLE "entities" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "hierarchy_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "entity_types" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "entity_types" ADD COLUMN "hierarchy_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_parent_id_entities_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_types" ADD CONSTRAINT "entity_types_parent_id_entity_types_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."entity_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cms_e_parent_id_idx" ON "entities" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "cms_e_hierarchy_order_idx" ON "entities" USING btree ("hierarchy_order");--> statement-breakpoint
CREATE INDEX "cms_et_parent_id_idx" ON "entity_types" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "cms_et_hierarchy_order_idx" ON "entity_types" USING btree ("hierarchy_order");