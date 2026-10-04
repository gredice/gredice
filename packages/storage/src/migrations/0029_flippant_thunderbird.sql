CREATE TYPE "public"."social_post_status" AS ENUM('created', 'submitting', 'submitted', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."social_post_type" AS ENUM('text', 'link', 'image', 'video', 'other');--> statement-breakpoint
CREATE TYPE "public"."social_provider" AS ENUM('reddit');--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" "social_provider" NOT NULL,
	"provider_account_key" text NOT NULL,
	"destination" text NOT NULL,
	"status" "social_post_status" DEFAULT 'created' NOT NULL,
	"post_type" "social_post_type" NOT NULL,
	"title" text,
	"body" text,
	"url" text,
	"provider_submission_id" text,
	"provider_permalink" text,
	"provider_metadata" jsonb,
	"failure_code" text,
	"failure_message" text,
	"failure_metadata" jsonb,
	"submitted_at" timestamp,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "social_posts_provider_idx" ON "social_posts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "social_posts_status_idx" ON "social_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "social_posts_created_at_idx" ON "social_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "social_posts_provider_destination_idx" ON "social_posts" USING btree ("provider","destination");