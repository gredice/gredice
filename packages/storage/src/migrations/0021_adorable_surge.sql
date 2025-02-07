ALTER TABLE "gardens" ADD COLUMN "farm_id" text;

-- Populate existing gardens with farm_id = 1
UPDATE "gardens" SET "farm_id" = '1';

-- Make farm_id not nullable
ALTER TABLE "gardens" ALTER COLUMN "farm_id" SET NOT NULL;
