CREATE TYPE "public"."social_account_status" AS ENUM('active', 'disabled', 'needs_reauth');--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" "social_provider" NOT NULL,
	"provider_account_key" text NOT NULL,
	"label" text NOT NULL,
	"handle" text,
	"external_account_id" text,
	"status" "social_account_status" DEFAULT 'active' NOT NULL,
	"default_destination" text,
	"allowed_destinations" jsonb,
	"credential_reference" text,
	"provider_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_provider_account_key_idx" ON "social_accounts" USING btree ("provider","provider_account_key");--> statement-breakpoint
CREATE INDEX "social_accounts_provider_idx" ON "social_accounts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "social_accounts_status_idx" ON "social_accounts" USING btree ("status");