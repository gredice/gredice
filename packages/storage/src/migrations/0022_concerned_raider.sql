CREATE TABLE "garden_stacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"garden_id" integer NOT NULL,
	"position_x" integer NOT NULL,
	"position_y" integer NOT NULL,
	"blocks" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
