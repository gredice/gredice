ALTER TABLE "gardens" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "garden_g_is_public_idx" ON "gardens" USING btree ("is_public");