CREATE TABLE "fiscalization_pos_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pos_id" text NOT NULL,
	"premise_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscalization_user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"pin" text NOT NULL,
	"use_vat" boolean DEFAULT false NOT NULL,
	"receipt_number_on_device" boolean DEFAULT false NOT NULL,
	"environment" text DEFAULT 'educ' NOT NULL,
	"cert_base64" text NOT NULL,
	"cert_password" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "fiscalization_pos_settings_pos_id_idx" ON "fiscalization_pos_settings" USING btree ("pos_id");--> statement-breakpoint
CREATE INDEX "fiscalization_pos_settings_is_active_idx" ON "fiscalization_pos_settings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "fiscalization_pos_settings_is_deleted_idx" ON "fiscalization_pos_settings" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "fiscalization_user_settings_is_active_idx" ON "fiscalization_user_settings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "fiscalization_user_settings_is_deleted_idx" ON "fiscalization_user_settings" USING btree ("is_deleted");