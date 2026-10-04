CREATE TYPE "public"."notification_campaign_status" AS ENUM('draft', 'scheduled', 'queued', 'sending', 'sent', 'cancelled', 'failed');--> statement-breakpoint
CREATE TABLE "notification_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" "notification_campaign_status" DEFAULT 'draft' NOT NULL,
	"audience" jsonb NOT NULL,
	"channel_policy" jsonb NOT NULL,
	"header" text NOT NULL,
	"content" text NOT NULL,
	"icon_url" text,
	"image_url" text,
	"link_url" text,
	"action_url" text,
	"action_label" text,
	"safe_image_url" text,
	"safe_link_url" text,
	"safe_action_url" text,
	"category" text NOT NULL,
	"event_type" text NOT NULL,
	"primary_channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"priority" "notification_priority" DEFAULT 'normal' NOT NULL,
	"collapse_key" text,
	"thread_key" text,
	"ttl_seconds" integer,
	"urgency" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"delivery_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"failures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_count" integer DEFAULT 0 NOT NULL,
	"queued_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"suppressed_count" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp,
	"enqueued_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"created_from_account_id" text,
	"cancelled_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_created_from_account_id_accounts_id_fk" FOREIGN KEY ("created_from_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_campaigns_status_idx" ON "notification_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_campaigns_scheduled_at_idx" ON "notification_campaigns" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "notification_campaigns_created_by_user_id_idx" ON "notification_campaigns" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "notification_campaigns_category_idx" ON "notification_campaigns" USING btree ("category");--> statement-breakpoint
CREATE INDEX "notification_campaigns_event_type_idx" ON "notification_campaigns" USING btree ("event_type");