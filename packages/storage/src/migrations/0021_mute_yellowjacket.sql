ALTER TABLE "inventory_configs" ADD COLUMN "low_count_threshold" integer;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "low_count_threshold" integer;