CREATE TABLE "cms_page_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"cms_page_id" integer NOT NULL,
	"action" text NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"previous_slug" text,
	"next_slug" text,
	"previous_title" text,
	"next_title" text,
	"previous_content" text,
	"next_content" text,
	"previous_state" text,
	"next_state" text,
	"previous_meta_title" text,
	"next_meta_title" text,
	"previous_meta_description" text,
	"next_meta_description" text,
	"previous_meta_image_url" text,
	"next_meta_image_url" text,
	"previous_published_at" timestamp,
	"next_published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cms_page_revisions" ADD CONSTRAINT "cms_page_revisions_cms_page_id_cms_pages_id_fk" FOREIGN KEY ("cms_page_id") REFERENCES "public"."cms_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cms_page_revisions_page_id_idx" ON "cms_page_revisions" USING btree ("cms_page_id");--> statement-breakpoint
CREATE INDEX "cms_page_revisions_action_idx" ON "cms_page_revisions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "cms_page_revisions_created_at_idx" ON "cms_page_revisions" USING btree ("created_at");