ALTER TABLE "cms_page_revisions" ADD COLUMN "previous_meta_image_poi_x" integer;--> statement-breakpoint
ALTER TABLE "cms_page_revisions" ADD COLUMN "next_meta_image_poi_x" integer;--> statement-breakpoint
ALTER TABLE "cms_page_revisions" ADD COLUMN "previous_meta_image_poi_y" integer;--> statement-breakpoint
ALTER TABLE "cms_page_revisions" ADD COLUMN "next_meta_image_poi_y" integer;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD COLUMN "meta_image_poi_x" integer;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD COLUMN "meta_image_poi_y" integer;