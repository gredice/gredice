CREATE TABLE "entity_search_documents" (
	"entity_id" integer PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"public_category" text NOT NULL,
	"public_category_label" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"image_url" text,
	"image_alt" text,
	"searchable_text" text NOT NULL,
	"state" text NOT NULL,
	"published_at" timestamp,
	"updated_at" timestamp NOT NULL,
	"indexed_at" timestamp DEFAULT now() NOT NULL,
	"search_vector" "tsvector" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_search_documents" ADD CONSTRAINT "entity_search_documents_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cms_esd_entity_type_idx" ON "entity_search_documents" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "cms_esd_public_category_idx" ON "entity_search_documents" USING btree ("public_category");--> statement-breakpoint
CREATE INDEX "cms_esd_state_idx" ON "entity_search_documents" USING btree ("state");--> statement-breakpoint
CREATE INDEX "cms_esd_published_at_idx" ON "entity_search_documents" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "cms_esd_search_vector_idx" ON "entity_search_documents" USING gin ("search_vector");