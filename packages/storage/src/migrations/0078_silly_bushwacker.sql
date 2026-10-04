DO $$
BEGIN
	-- Keep the rollout from waiting indefinitely behind checkout writers or on
	-- an unexpectedly expensive DDL statement. These settings are local to the
	-- Drizzle migration transaction and therefore reset on commit or rollback.
	PERFORM set_config('lock_timeout', '5s', true);
	PERFORM set_config('statement_timeout', '5min', true);
	PERFORM pg_advisory_xact_lock(1196573763, 1398035024);

	IF EXISTS (
		SELECT 1
		FROM "transactions"
		WHERE "stripe_payment_id" IS NOT NULL
		GROUP BY "stripe_payment_id"
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot enforce unique Stripe transaction identity: duplicate non-null stripe_payment_id values exist. Run the checkout claim rollout duplicate preflight and reconcile them before retrying.';
	END IF;
	IF EXISTS (
		SELECT 1
		FROM "transactions"
		WHERE "stripe_payment_id" IS NOT NULL
			AND (
				"stripe_payment_id" <> btrim("stripe_payment_id")
				OR char_length(btrim("stripe_payment_id")) = 0
				OR char_length(btrim("stripe_payment_id")) > 255
			)
	) THEN
		RAISE EXCEPTION 'Cannot initialize Stripe processing claims: noncanonical stripe_payment_id values exist. Every value must equal btrim(value) and contain between 1 and 255 characters. Reconcile these transaction identities before retrying.';
	END IF;
	IF EXISTS (
		SELECT 1
		FROM "transactions"
		WHERE "stripe_payment_id" IS NOT NULL
			AND ("status" <> 'completed' OR "is_deleted" = true)
	) THEN
		RAISE EXCEPTION 'Cannot initialize Stripe processing claims: noncanonical transactions with non-null stripe_payment_id values exist. Run the checkout claim rollout noncanonical transaction preflight and reconcile them before retrying.';
	END IF;
END $$;--> statement-breakpoint
CREATE TYPE "public"."stripe_payment_processing_claim_review_action" AS ENUM('requeued', 'resolved_completed');--> statement-breakpoint
CREATE TYPE "public"."stripe_payment_processing_claim_status" AS ENUM('queued', 'processing', 'retryable', 'completed', 'manual_review');--> statement-breakpoint
CREATE TABLE "stripe_payment_discovery_checkpoints" (
	"id" integer PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"range_gte" timestamp,
	"range_lte" timestamp,
	"starting_after" text,
	"exhaustive_upper_bound" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_payment_discovery_checkpoint_singleton" CHECK ("stripe_payment_discovery_checkpoints"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "stripe_payment_processing_claim_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"stripe_payment_id" text NOT NULL,
	"action" "stripe_payment_processing_claim_review_action" NOT NULL,
	"previous_attempt_count" integer NOT NULL,
	"previous_manual_review_reason" text,
	"reviewed_by" text NOT NULL,
	"reason" text NOT NULL,
	"completed_transaction_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_payment_processing_claims" (
	"stripe_payment_id" text PRIMARY KEY NOT NULL,
	"scheduler_id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "stripe_payment_processing_claims_scheduler_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"status" "stripe_payment_processing_claim_status" NOT NULL,
	"claim_token" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"attempt_count_at_last_requeue" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp,
	"lease_expires_at" timestamp,
	"next_attempt_at" timestamp,
	"last_failure_at" timestamp,
	"last_failure_code" text,
	"completed_at" timestamp,
	"completed_transaction_id" integer,
	"completion_output_version" integer DEFAULT 1 NOT NULL,
	"order_confirmation_email_message_id" integer,
	"purchase_notification_email_message_id" integer,
	"manual_review_at" timestamp,
	"manual_review_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_payment_recovery_cursors" (
	"id" integer PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"after_scheduler_id" bigint,
	"through_scheduler_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_payment_recovery_cursor_singleton" CHECK ("stripe_payment_recovery_cursors"."id" = 1)
);
--> statement-breakpoint
DROP INDEX "transactions_stripe_payment_id_idx";--> statement-breakpoint
ALTER TABLE "stripe_payment_processing_claim_reviews" ADD CONSTRAINT "stripe_payment_processing_claim_reviews_stripe_payment_id_stripe_payment_processing_claims_stripe_payment_id_fk" FOREIGN KEY ("stripe_payment_id") REFERENCES "public"."stripe_payment_processing_claims"("stripe_payment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payment_processing_claim_reviews" ADD CONSTRAINT "stripe_payment_processing_claim_reviews_completed_transaction_id_transactions_id_fk" FOREIGN KEY ("completed_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payment_processing_claims" ADD CONSTRAINT "stripe_payment_processing_claims_completed_transaction_id_transactions_id_fk" FOREIGN KEY ("completed_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payment_processing_claims" ADD CONSTRAINT "stripe_payment_processing_claims_order_confirmation_email_message_id_email_messages_id_fk" FOREIGN KEY ("order_confirmation_email_message_id") REFERENCES "public"."email_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payment_processing_claims" ADD CONSTRAINT "stripe_payment_processing_claims_purchase_notification_email_message_id_email_messages_id_fk" FOREIGN KEY ("purchase_notification_email_message_id") REFERENCES "public"."email_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stripe_payment_claim_review_payment_created_idx" ON "stripe_payment_processing_claim_reviews" USING btree ("stripe_payment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_payment_claim_scheduler_id_unique" ON "stripe_payment_processing_claims" USING btree ("scheduler_id");--> statement-breakpoint
CREATE INDEX "stripe_payment_claim_status_next_attempt_idx" ON "stripe_payment_processing_claims" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "stripe_payment_claim_status_lease_expiry_idx" ON "stripe_payment_processing_claims" USING btree ("status","lease_expires_at");--> statement-breakpoint
CREATE INDEX "stripe_payment_claim_completed_transaction_idx" ON "stripe_payment_processing_claims" USING btree ("completed_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_stripe_payment_id_unique" ON "transactions" USING btree ("stripe_payment_id");--> statement-breakpoint
INSERT INTO "stripe_payment_discovery_checkpoints" ("id") VALUES (1);--> statement-breakpoint
INSERT INTO "stripe_payment_recovery_cursors" ("id") VALUES (1);--> statement-breakpoint
INSERT INTO "stripe_payment_processing_claims" (
	"stripe_payment_id",
	"status",
	"attempt_count",
	"completed_at",
	"completed_transaction_id",
	"completion_output_version",
	"created_at",
	"updated_at"
)
SELECT
	"stripe_payment_id",
	'completed',
	0,
	coalesce("updated_at", "created_at"),
	"id",
	0,
	"created_at",
	coalesce("updated_at", "created_at")
FROM "transactions"
WHERE "status" = 'completed'
	AND "is_deleted" = false;
