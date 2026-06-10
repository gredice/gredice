ALTER TABLE "cms_page_revisions" ADD COLUMN "previous_content_kind" text;--> statement-breakpoint
ALTER TABLE "cms_page_revisions" ADD COLUMN "next_content_kind" text;--> statement-breakpoint
ALTER TABLE "cms_page_revisions" ADD COLUMN "previous_category" text;--> statement-breakpoint
ALTER TABLE "cms_page_revisions" ADD COLUMN "next_category" text;--> statement-breakpoint
ALTER TABLE "cms_page_revisions" ADD COLUMN "previous_tags" text[];--> statement-breakpoint
ALTER TABLE "cms_page_revisions" ADD COLUMN "next_tags" text[];--> statement-breakpoint
ALTER TABLE "cms_pages" ADD COLUMN "content_kind" text DEFAULT 'page' NOT NULL;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whats_new_last_seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whats_new_popup_disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "cms_pages_content_kind_idx" ON "cms_pages" USING btree ("content_kind");--> statement-breakpoint
CREATE INDEX "cms_pages_category_idx" ON "cms_pages" USING btree ("category");