CREATE TABLE "outlet_offer_reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"outlet_offer_id" integer NOT NULL,
	"account_id" text NOT NULL,
	"cart_id" integer NOT NULL,
	"cart_item_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"hold_expires_at" timestamp NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"held_outlet_price_cents" integer NOT NULL,
	"held_compare_price_cents" integer,
	"held_sowing_date" timestamp NOT NULL,
	"held_initial_plant_status" text DEFAULT 'sprouted' NOT NULL,
	"released_at" timestamp,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlet_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_sort_id" integer NOT NULL,
	"sowing_date" timestamp NOT NULL,
	"initial_plant_status" text DEFAULT 'sprouted' NOT NULL,
	"image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outlet_price_cents" integer NOT NULL,
	"compare_price_cents" integer,
	"quantity" integer NOT NULL,
	"start_at" timestamp DEFAULT now() NOT NULL,
	"end_at" timestamp NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outlet_offer_reservations" ADD CONSTRAINT "outlet_offer_reservations_outlet_offer_id_outlet_offers_id_fk" FOREIGN KEY ("outlet_offer_id") REFERENCES "public"."outlet_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_offer_reservations" ADD CONSTRAINT "outlet_offer_reservations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_offer_reservations" ADD CONSTRAINT "outlet_offer_reservations_cart_id_shopping_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."shopping_carts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_offer_reservations" ADD CONSTRAINT "outlet_offer_reservations_cart_item_id_shopping_cart_items_id_fk" FOREIGN KEY ("cart_item_id") REFERENCES "public"."shopping_cart_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_offers" ADD CONSTRAINT "outlet_offers_plant_sort_id_entities_id_fk" FOREIGN KEY ("plant_sort_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outlet_reservations_offer_id_idx" ON "outlet_offer_reservations" USING btree ("outlet_offer_id");--> statement-breakpoint
CREATE INDEX "outlet_reservations_account_id_idx" ON "outlet_offer_reservations" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "outlet_reservations_cart_id_idx" ON "outlet_offer_reservations" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "outlet_reservations_cart_item_id_idx" ON "outlet_offer_reservations" USING btree ("cart_item_id");--> statement-breakpoint
CREATE INDEX "outlet_reservations_status_idx" ON "outlet_offer_reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outlet_reservations_hold_expires_at_idx" ON "outlet_offer_reservations" USING btree ("hold_expires_at");--> statement-breakpoint
CREATE INDEX "outlet_offers_plant_sort_id_idx" ON "outlet_offers" USING btree ("plant_sort_id");--> statement-breakpoint
CREATE INDEX "outlet_offers_status_idx" ON "outlet_offers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outlet_offers_start_at_idx" ON "outlet_offers" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "outlet_offers_end_at_idx" ON "outlet_offers" USING btree ("end_at");--> statement-breakpoint
CREATE INDEX "outlet_offers_is_deleted_idx" ON "outlet_offers" USING btree ("is_deleted");