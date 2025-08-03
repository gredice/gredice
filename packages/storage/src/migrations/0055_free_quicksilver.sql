CREATE TABLE "entity_type_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"order" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_types" ADD COLUMN "category_id" integer;--> statement-breakpoint
CREATE INDEX "cms_etc_order_idx" ON "entity_type_categories" USING btree ("order");--> statement-breakpoint
CREATE INDEX "cms_etc_is_deleted_idx" ON "entity_type_categories" USING btree ("is_deleted");--> statement-breakpoint
ALTER TABLE "entity_types" ADD CONSTRAINT "entity_types_category_id_entity_type_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."entity_type_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cms_et_category_id_idx" ON "entity_types" USING btree ("category_id");