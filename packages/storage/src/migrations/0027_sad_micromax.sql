ALTER TABLE "cms_page_revisions" ADD COLUMN "previous_canonical_path" text;--> statement-breakpoint
ALTER TABLE "cms_page_revisions" ADD COLUMN "next_canonical_path" text;--> statement-breakpoint
ALTER TABLE "cms_page_revisions" ADD COLUMN "previous_no_index" boolean;--> statement-breakpoint
ALTER TABLE "cms_page_revisions" ADD COLUMN "next_no_index" boolean;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD COLUMN "canonical_path" text;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD COLUMN "no_index" boolean DEFAULT false NOT NULL;