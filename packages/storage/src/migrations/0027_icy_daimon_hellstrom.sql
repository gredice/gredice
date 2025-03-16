CREATE TABLE "feedbacks" (
	"id" text PRIMARY KEY NOT NULL,
	"topic" text NOT NULL,
	"data" json,
	"score" text,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
