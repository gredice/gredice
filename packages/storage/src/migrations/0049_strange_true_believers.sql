ALTER TABLE "cms_page_revisions" ADD COLUMN "previous_seo_image_url" text;--> statement-breakpoint
ALTER TABLE "cms_page_revisions" ADD COLUMN "next_seo_image_url" text;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD COLUMN "seo_image_url" text;