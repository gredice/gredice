CREATE TYPE "public"."notification_delivery_status" AS ENUM('queued', 'accepted', 'sent', 'failed', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_event_type" AS ENUM('queued', 'accepted', 'sent', 'failed', 'opened', 'clicked', 'dismissed', 'unsubscribed');--> statement-breakpoint
CREATE TYPE "public"."notification_digest_frequency" AS ENUM('off', 'hourly', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'push', 'sms');--> statement-breakpoint
CREATE TYPE "public"."notification_preference_scope" AS ENUM('global', 'account');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('low', 'normal', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."push_permission_state" AS ENUM('default', 'granted', 'denied');--> statement-breakpoint
CREATE TABLE "notification_delivery_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"user_id" text,
	"account_id" text,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'queued' NOT NULL,
	"provider" text,
	"provider_message_id" text,
	"provider_response_code" text,
	"provider_response_body" text,
	"campaign_id" text,
	"bulk_id" text,
	"push_subscription_id" text,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"delivery_attempt_id" integer NOT NULL,
	"notification_id" text NOT NULL,
	"type" "notification_delivery_event_type" NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_user_channel_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"scope" "notification_preference_scope" DEFAULT 'global' NOT NULL,
	"category" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"quiet_hours_start_minute" integer,
	"quiet_hours_end_minute" integer,
	"delivery_window_start_minute" integer,
	"delivery_window_end_minute" integer,
	"timezone" text,
	"locale" text,
	"digest_frequency" "notification_digest_frequency" DEFAULT 'off' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_user_channel_preferences_scope_account_id_check" CHECK (("scope" = 'global' and "account_id" is null) or ("scope" = 'account' and "account_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "web_push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text,
	"user_id" text,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"device_id" text,
	"device_label" text,
	"browser_name" text,
	"browser_version" text,
	"platform" text,
	"user_agent" text,
	"locale" text,
	"timezone" text,
	"permission_state" "push_permission_state" DEFAULT 'default' NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_success_at" timestamp,
	"last_failure_at" timestamp,
	"last_failure_code" text,
	"last_failure_reason" text,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "category" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "type" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "primary_channel" "notification_channel" DEFAULT 'in_app' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "priority" "notification_priority" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "campaign_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "bulk_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "collapse_key" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "thread_key" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "action_url" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "action_label" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "ttl_seconds" integer;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "urgency" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "safe_image_url" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "safe_link_url" text;--> statement-breakpoint
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_push_subscription_id_web_push_subscriptions_id_fk" FOREIGN KEY ("push_subscription_id") REFERENCES "public"."web_push_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_events" ADD CONSTRAINT "notification_delivery_events_delivery_attempt_id_notification_delivery_attempts_id_fk" FOREIGN KEY ("delivery_attempt_id") REFERENCES "public"."notification_delivery_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery_events" ADD CONSTRAINT "notification_delivery_events_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_user_channel_preferences" ADD CONSTRAINT "notification_user_channel_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_user_channel_preferences" ADD CONSTRAINT "notification_user_channel_preferences_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_push_subscriptions" ADD CONSTRAINT "web_push_subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_push_subscriptions" ADD CONSTRAINT "web_push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_delivery_attempts_notification_id_idx" ON "notification_delivery_attempts" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_attempts_status_idx" ON "notification_delivery_attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_delivery_events_attempt_id_idx" ON "notification_delivery_events" USING btree ("delivery_attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_user_channel_preferences_global_unique_idx" ON "notification_user_channel_preferences" USING btree ("user_id","category","channel") WHERE "notification_user_channel_preferences"."scope" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX "notification_user_channel_preferences_account_unique_idx" ON "notification_user_channel_preferences" USING btree ("user_id","account_id","category","channel") WHERE "notification_user_channel_preferences"."scope" = 'account';--> statement-breakpoint
CREATE UNIQUE INDEX "web_push_subscriptions_endpoint_unique_idx" ON "web_push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "web_push_subscriptions_user_id_idx" ON "web_push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "web_push_subscriptions_account_id_idx" ON "web_push_subscriptions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "web_push_subscriptions_device_id_idx" ON "web_push_subscriptions" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "notifications_category_idx" ON "notifications" USING btree ("category");--> statement-breakpoint
CREATE INDEX "notifications_campaign_id_idx" ON "notifications" USING btree ("campaign_id");
