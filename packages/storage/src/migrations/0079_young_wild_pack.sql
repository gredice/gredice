ALTER TABLE "ai_account_limit_overrides" RENAME COLUMN "active_daily_limit_micro_usd" TO "active_daily_limit_micro_eur";--> statement-breakpoint
ALTER TABLE "ai_account_limit_overrides" RENAME COLUMN "trial_daily_limit_micro_usd" TO "trial_daily_limit_micro_eur";--> statement-breakpoint
ALTER TABLE "ai_usage_ledger" RENAME COLUMN "reserved_micro_usd" TO "reserved_micro_eur";--> statement-breakpoint
ALTER TABLE "ai_usage_ledger" RENAME COLUMN "input_micro_usd" TO "input_micro_eur";--> statement-breakpoint
ALTER TABLE "ai_usage_ledger" RENAME COLUMN "output_micro_usd" TO "output_micro_eur";--> statement-breakpoint
ALTER TABLE "ai_usage_ledger" RENAME COLUMN "total_micro_usd" TO "total_micro_eur";--> statement-breakpoint
UPDATE "ai_account_limit_overrides"
SET
	"active_daily_limit_micro_eur" = ROUND("active_daily_limit_micro_eur"::numeric * 0.88)::integer,
	"trial_daily_limit_micro_eur" = ROUND("trial_daily_limit_micro_eur"::numeric * 0.88)::integer;--> statement-breakpoint
UPDATE "ai_usage_ledger"
SET
	"reserved_micro_eur" = ROUND("reserved_micro_eur"::numeric * 0.88)::integer,
	"input_micro_eur" = ROUND("input_micro_eur"::numeric * 0.88)::integer,
	"output_micro_eur" = ROUND("output_micro_eur"::numeric * 0.88)::integer,
	"total_micro_eur" = ROUND("total_micro_eur"::numeric * 0.88)::integer;--> statement-breakpoint
ALTER TABLE "ai_account_limit_overrides" ADD COLUMN "active_weekly_limit_micro_eur" integer;--> statement-breakpoint
ALTER TABLE "ai_account_limit_overrides" ADD COLUMN "trial_weekly_limit_micro_eur" integer;
