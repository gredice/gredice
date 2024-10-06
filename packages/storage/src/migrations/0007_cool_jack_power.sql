CREATE TABLE IF NOT EXISTS "attribute_definition_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"entity_type" text NOT NULL,
	"order" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attribute_definitions" ALTER COLUMN "label" SET NOT NULL;