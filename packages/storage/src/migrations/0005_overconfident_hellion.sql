CREATE TABLE "notification_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"integration_type" text NOT NULL,
	"config" jsonb NOT NULL,
	"enabled" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN "slack_channel_id" text;