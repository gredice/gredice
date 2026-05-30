CREATE TABLE IF NOT EXISTS "operation_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"entity_type_name" text NOT NULL,
	"entity_id" integer,
	"price_per_unit" numeric(10,2) NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operation_prices" ADD COLUMN IF NOT EXISTS "entity_id" integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "farmer_payout_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"requested_amount" numeric(10,2) NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"farmer_note" text,
	"admin_note" text,
	"bank_reference" text,
	"receipt_id" integer,
	"approved_by_user_id" text,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weather_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"symbol" integer,
	"temperature" real,
	"rain" real DEFAULT 0 NOT NULL,
	"wind_direction" text,
	"wind_speed" real DEFAULT 0 NOT NULL,
	"rainy" real DEFAULT 0 NOT NULL,
	"snowy" real DEFAULT 0 NOT NULL,
	"cloudy" real DEFAULT 0 NOT NULL,
	"foggy" real DEFAULT 0 NOT NULL,
	"thundery" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "invoice_id" DROP NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'operation_prices_farm_id_farms_id_fk'
			AND conrelid = 'public.operation_prices'::regclass
	) THEN
		ALTER TABLE "operation_prices"
			ADD CONSTRAINT "operation_prices_farm_id_farms_id_fk"
			FOREIGN KEY ("farm_id")
			REFERENCES "public"."farms"("id")
			ON DELETE no action
			ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'farmer_payout_requests_farm_id_farms_id_fk'
			AND conrelid = 'public.farmer_payout_requests'::regclass
	) THEN
		ALTER TABLE "farmer_payout_requests"
			ADD CONSTRAINT "farmer_payout_requests_farm_id_farms_id_fk"
			FOREIGN KEY ("farm_id")
			REFERENCES "public"."farms"("id")
			ON DELETE no action
			ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'farmer_payout_requests_user_id_users_id_fk'
			AND conrelid = 'public.farmer_payout_requests'::regclass
	) THEN
		ALTER TABLE "farmer_payout_requests"
			ADD CONSTRAINT "farmer_payout_requests_user_id_users_id_fk"
			FOREIGN KEY ("user_id")
			REFERENCES "public"."users"("id")
			ON DELETE no action
			ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'farmer_payout_requests_approved_by_user_id_users_id_fk'
			AND conrelid = 'public.farmer_payout_requests'::regclass
	) THEN
		ALTER TABLE "farmer_payout_requests"
			ADD CONSTRAINT "farmer_payout_requests_approved_by_user_id_users_id_fk"
			FOREIGN KEY ("approved_by_user_id")
			REFERENCES "public"."users"("id")
			ON DELETE no action
			ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'farmer_payout_requests_receipt_id_receipts_id_fk'
			AND conrelid = 'public.farmer_payout_requests'::regclass
	) THEN
		ALTER TABLE "farmer_payout_requests"
			ADD CONSTRAINT "farmer_payout_requests_receipt_id_receipts_id_fk"
			FOREIGN KEY ("receipt_id")
			REFERENCES "public"."receipts"("id")
			ON DELETE no action
			ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS "operation_prices_farm_entity_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "operation_prices_farm_type_null_unique" ON "operation_prices" USING btree ("farm_id","entity_type_name") WHERE "entity_id" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "operation_prices_farm_type_entity_unique" ON "operation_prices" USING btree ("farm_id","entity_type_name","entity_id") WHERE "entity_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operation_prices_farm_id_idx" ON "operation_prices" USING btree ("farm_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "farmer_payout_requests_farm_id_idx" ON "farmer_payout_requests" USING btree ("farm_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "farmer_payout_requests_user_id_idx" ON "farmer_payout_requests" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "farmer_payout_requests_status_idx" ON "farmer_payout_requests" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weather_history_recorded_at_idx" ON "weather_history" USING btree ("recorded_at");
