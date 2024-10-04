ALTER TABLE "attribute_definitions" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "plants" DROP COLUMN IF EXISTS "name";