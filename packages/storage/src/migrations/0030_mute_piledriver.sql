ALTER TABLE "shopping_cart_items" ADD COLUMN "position_index" integer;--> statement-breakpoint
ALTER TABLE "shopping_cart_items" ADD COLUMN "additional_data" text DEFAULT null;