ALTER TABLE "gardens" ADD COLUMN "farm_id" integer;--> statement-breakpoint

-- Populate existing gardens with farm_id = 1
UPDATE "gardens" SET "farm_id" = 1;

-- Make farm_id not nullable
ALTER TABLE "gardens" ALTER COLUMN "farm_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "farms" ADD COLUMN "latitude" real;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "longitude" real;--> statement-breakpoint

-- Set the default value for the new columns lat: 45.74,lon: 16.57
UPDATE "farms" SET "latitude" = 45.74, "longitude" = 16.57;

-- Make the columns not nullable
ALTER TABLE "farms" ALTER COLUMN "latitude" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "farms" ALTER COLUMN "longitude" SET NOT NULL;