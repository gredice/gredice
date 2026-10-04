CREATE TABLE "farmer_payout_request_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"payout_request_id" integer NOT NULL,
	"entity_type_name" text NOT NULL,
	"entity_id" integer,
	"label" text NOT NULL,
	"operation_count" integer NOT NULL,
	"duration_minutes" numeric(10, 2) NOT NULL,
	"total_duration_minutes" numeric(10, 2) NOT NULL,
	"price_per_unit" numeric(10, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farmer_payout_request_items" ADD CONSTRAINT "farmer_payout_request_items_payout_request_id_farmer_payout_requests_id_fk" FOREIGN KEY ("payout_request_id") REFERENCES "public"."farmer_payout_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "farmer_payout_items_request_id_idx" ON "farmer_payout_request_items" USING btree ("payout_request_id");