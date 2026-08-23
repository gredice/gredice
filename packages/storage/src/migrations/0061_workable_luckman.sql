ALTER TABLE "time_slots" ADD COLUMN "closes_at" timestamp;--> statement-breakpoint
CREATE INDEX "time_slots_closes_at_idx" ON "time_slots" USING btree ("closes_at");