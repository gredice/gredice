ALTER TYPE "public"."social_post_status" ADD VALUE 'queued' BEFORE 'submitting';--> statement-breakpoint
ALTER TYPE "public"."social_post_status" ADD VALUE 'scheduled' BEFORE 'submitting';--> statement-breakpoint
ALTER TYPE "public"."social_post_status" ADD VALUE 'canceled';--> statement-breakpoint
ALTER TYPE "public"."social_post_type" ADD VALUE 'reel' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."social_post_type" ADD VALUE 'story' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."social_post_type" ADD VALUE 'carousel' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."social_provider" ADD VALUE 'instagram';--> statement-breakpoint
ALTER TYPE "public"."social_provider" ADD VALUE 'facebook';--> statement-breakpoint
ALTER TYPE "public"."social_provider" ADD VALUE 'google_business';--> statement-breakpoint
ALTER TYPE "public"."social_provider" ADD VALUE 'x';--> statement-breakpoint
ALTER TYPE "public"."social_provider" ADD VALUE 'tiktok';--> statement-breakpoint
ALTER TYPE "public"."social_provider" ADD VALUE 'threads';--> statement-breakpoint
ALTER TYPE "public"."social_provider" ADD VALUE 'linkedin';--> statement-breakpoint
ALTER TYPE "public"."social_provider" ADD VALUE 'whatsapp';--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "media_urls" jsonb;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "scheduled_at" timestamp;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "queued_at" timestamp;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "canceled_at" timestamp;--> statement-breakpoint
CREATE INDEX "social_posts_scheduled_at_idx" ON "social_posts" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "social_posts_queued_at_idx" ON "social_posts" USING btree ("queued_at");