CREATE TYPE "public"."achievement_status" AS ENUM('pending', 'approved', 'denied');--> statement-breakpoint
CREATE TABLE "account_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"achievement_key" text NOT NULL,
	"status" "achievement_status" DEFAULT 'pending' NOT NULL,
	"reward_sunflowers" integer DEFAULT 0 NOT NULL,
	"progress_value" integer,
	"threshold" integer,
	"metadata" jsonb,
	"earned_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"approved_by_user_id" text,
	"reward_granted_at" timestamp,
	"denied_at" timestamp,
	"denied_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_achievements" ADD CONSTRAINT "account_achievements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_achievements" ADD CONSTRAINT "account_achievements_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_achievements" ADD CONSTRAINT "account_achievements_denied_by_user_id_users_id_fk" FOREIGN KEY ("denied_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_achievements_account_id_idx" ON "account_achievements" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "account_achievements_status_idx" ON "account_achievements" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "account_achievements_account_key_uq" ON "account_achievements" USING btree ("account_id","achievement_key");