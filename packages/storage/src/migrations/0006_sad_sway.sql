CREATE TYPE "public"."email_status" AS ENUM('queued', 'sending', 'sent', 'failed', 'bounced');--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'acs' NOT NULL,
	"provider_message_id" text,
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"provider_status" text,
	"from_address" text NOT NULL,
	"subject" text NOT NULL,
	"template_name" text,
	"message_type" text,
	"recipients" jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"html_body" text,
	"text_body" text,
	"error_code" text,
	"error_message" text,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp,
	"bounced_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "email_messages_status_idx" ON "email_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_messages_created_idx" ON "email_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_messages_provider_message_idx" ON "email_messages" USING btree ("provider_message_id");