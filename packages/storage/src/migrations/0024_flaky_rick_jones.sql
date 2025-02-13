CREATE TABLE "garden_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"garden_id" integer NOT NULL,
	"name" text NOT NULL,
	"rotation" integer,
	"variant" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
