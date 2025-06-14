ALTER TABLE "shopping_cart_items" ADD COLUMN "status" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_carts" ADD COLUMN "status" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
CREATE INDEX "shopping_cart_items_status_idx" ON "shopping_cart_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shopping_carts_status_idx" ON "shopping_carts" USING btree ("status");