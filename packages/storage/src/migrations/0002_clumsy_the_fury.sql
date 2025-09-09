ALTER TABLE "operations" ADD COLUMN "is_accepted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "operations_is_accepted_idx" ON "operations" USING btree ("is_accepted");