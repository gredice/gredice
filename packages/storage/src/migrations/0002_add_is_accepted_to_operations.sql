ALTER TABLE "operations" ADD COLUMN "is_accepted" boolean NOT NULL DEFAULT false;
CREATE INDEX "operations_is_accepted_idx" ON "operations" USING btree ("is_accepted");
