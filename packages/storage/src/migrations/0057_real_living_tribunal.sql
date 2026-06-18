ALTER TABLE "users" ADD COLUMN "is_temporary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_active_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "users_temporary_last_active_idx" ON "users" USING btree ("is_temporary","last_active_at");