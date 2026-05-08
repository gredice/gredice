CREATE TABLE "cms_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"state" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"meta_title" text,
	"meta_description" text,
	"meta_image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cms_pages_slug_active_uq" ON "cms_pages" USING btree ("slug") WHERE "cms_pages"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "cms_pages_state_idx" ON "cms_pages" USING btree ("state");--> statement-breakpoint
CREATE INDEX "cms_pages_published_at_idx" ON "cms_pages" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "cms_pages_is_deleted_idx" ON "cms_pages" USING btree ("is_deleted");