CREATE TABLE "farmer_payout_request_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payout_request_id" integer NOT NULL,
	"label" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farmer_payout_request_adjustments" ADD CONSTRAINT "farmer_payout_request_adjustments_payout_request_id_farmer_payout_requests_id_fk" FOREIGN KEY ("payout_request_id") REFERENCES "public"."farmer_payout_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farmer_payout_request_adjustments" ADD CONSTRAINT "farmer_payout_request_adjustments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "farmer_payout_adjustments_request_id_idx" ON "farmer_payout_request_adjustments" USING btree ("payout_request_id");