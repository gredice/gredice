ALTER TABLE "user_logins" ADD COLUMN "failed_attempts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_logins" ADD COLUMN "last_failed_attempt" timestamp;--> statement-breakpoint
ALTER TABLE "user_logins" ADD COLUMN "blocked_until" timestamp;