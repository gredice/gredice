ALTER TABLE "gardens" ALTER COLUMN "is_public" SET DEFAULT true;--> statement-breakpoint
UPDATE "gardens" SET "is_public" = true WHERE "is_public" = false;
