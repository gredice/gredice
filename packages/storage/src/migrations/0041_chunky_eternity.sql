ALTER TABLE "gardens" ADD COLUMN "is_sandbox" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "garden_g_is_sandbox_idx" ON "gardens" USING btree ("is_sandbox");