ALTER TABLE "farms" ADD COLUMN "latitude" real;--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "longitude" real;

-- Set the default value for the new columns lat: 45.74,lon: 16.57
UPDATE "farms" SET "latitude" = 45.74, "longitude" = 16.57;

-- Make the columns not nullable
ALTER TABLE "farms" ALTER COLUMN "latitude" SET NOT NULL;
ALTER TABLE "farms" ALTER COLUMN "longitude" SET NOT NULL;
