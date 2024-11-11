CREATE TABLE IF NOT EXISTS "gardens" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
