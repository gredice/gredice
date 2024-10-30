ALTER TABLE "entities" ADD COLUMN "state" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "published_at" timestamp;