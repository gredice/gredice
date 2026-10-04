CREATE TYPE "public"."survey_assignment_status" AS ENUM('pending', 'started', 'submitted', 'expired', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."survey_question_type" AS ENUM('opinion_scale', 'long_text', 'contact_info');--> statement-breakpoint
CREATE TYPE "public"."survey_response_source" AS ENUM('in_app', 'typeform', 'admin_import');--> statement-breakpoint
CREATE TYPE "public"."survey_send_delivery_channel" AS ENUM('in_app', 'email');--> statement-breakpoint
CREATE TYPE "public"."survey_send_delivery_status" AS ENUM('queued', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."survey_send_status" AS ENUM('draft', 'scheduled', 'sent', 'canceled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."survey_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."survey_version_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "survey_answers" (
	"id" text PRIMARY KEY NOT NULL,
	"response_id" text NOT NULL,
	"question_id" text NOT NULL,
	"question_key" text NOT NULL,
	"type" "survey_question_type" NOT NULL,
	"numeric_value" integer,
	"text_value" text,
	"contact_value" jsonb,
	"skipped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"survey_id" text NOT NULL,
	"version_id" text NOT NULL,
	"send_id" text,
	"account_id" text,
	"user_id" text,
	"target_key" text NOT NULL,
	"context_key" text NOT NULL,
	"status" "survey_assignment_status" DEFAULT 'pending' NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp,
	"opened_at" timestamp,
	"started_at" timestamp,
	"submitted_at" timestamp,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"key" text NOT NULL,
	"type" "survey_question_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"settings" jsonb NOT NULL,
	"score_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text,
	"survey_id" text NOT NULL,
	"version_id" text NOT NULL,
	"account_id" text,
	"user_id" text,
	"source" "survey_response_source" DEFAULT 'in_app' NOT NULL,
	"status" "survey_assignment_status" DEFAULT 'submitted' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"imported_external_id" text,
	"started_at" timestamp,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_send_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"send_id" text NOT NULL,
	"assignment_id" text,
	"account_id" text,
	"user_id" text,
	"channel" "survey_send_delivery_channel" NOT NULL,
	"status" "survey_send_delivery_status" NOT NULL,
	"email" text,
	"notification_id" text,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_sends" (
	"id" text PRIMARY KEY NOT NULL,
	"survey_id" text NOT NULL,
	"version_id" text NOT NULL,
	"status" "survey_send_status" DEFAULT 'draft' NOT NULL,
	"name" text NOT NULL,
	"audience" jsonb NOT NULL,
	"channel_policy" jsonb NOT NULL,
	"context_key" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"target_count" integer DEFAULT 0 NOT NULL,
	"assigned_count" integer DEFAULT 0 NOT NULL,
	"skipped_duplicate_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" text,
	"created_from_account_id" text,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"survey_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"status" "survey_version_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"intro_title" text,
	"intro_description" text,
	"thank_you_title" text,
	"thank_you_description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"status" "survey_status" DEFAULT 'draft' NOT NULL,
	"active_version_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_question_id_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."survey_questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_assignments" ADD CONSTRAINT "survey_assignments_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_assignments" ADD CONSTRAINT "survey_assignments_version_id_survey_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."survey_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_assignments" ADD CONSTRAINT "survey_assignments_send_id_survey_sends_id_fk" FOREIGN KEY ("send_id") REFERENCES "public"."survey_sends"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_assignments" ADD CONSTRAINT "survey_assignments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_assignments" ADD CONSTRAINT "survey_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_version_id_survey_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."survey_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_assignment_id_survey_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."survey_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_version_id_survey_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."survey_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_send_deliveries" ADD CONSTRAINT "survey_send_deliveries_send_id_survey_sends_id_fk" FOREIGN KEY ("send_id") REFERENCES "public"."survey_sends"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_send_deliveries" ADD CONSTRAINT "survey_send_deliveries_assignment_id_survey_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."survey_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_send_deliveries" ADD CONSTRAINT "survey_send_deliveries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_send_deliveries" ADD CONSTRAINT "survey_send_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_send_deliveries" ADD CONSTRAINT "survey_send_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_sends" ADD CONSTRAINT "survey_sends_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_sends" ADD CONSTRAINT "survey_sends_version_id_survey_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."survey_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_sends" ADD CONSTRAINT "survey_sends_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_sends" ADD CONSTRAINT "survey_sends_created_from_account_id_accounts_id_fk" FOREIGN KEY ("created_from_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_versions" ADD CONSTRAINT "survey_versions_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "survey_answers_response_question_unique" ON "survey_answers" USING btree ("response_id","question_id");--> statement-breakpoint
CREATE INDEX "survey_answers_response_idx" ON "survey_answers" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "survey_answers_question_idx" ON "survey_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "survey_answers_question_key_idx" ON "survey_answers" USING btree ("question_key");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_assignments_version_target_context_unique" ON "survey_assignments" USING btree ("version_id","target_key","context_key");--> statement-breakpoint
CREATE INDEX "survey_assignments_survey_idx" ON "survey_assignments" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX "survey_assignments_version_idx" ON "survey_assignments" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "survey_assignments_account_idx" ON "survey_assignments" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "survey_assignments_user_idx" ON "survey_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "survey_assignments_status_idx" ON "survey_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "survey_assignments_send_idx" ON "survey_assignments" USING btree ("send_id");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_questions_version_key_unique" ON "survey_questions" USING btree ("version_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_questions_version_order_unique" ON "survey_questions" USING btree ("version_id","sort_order");--> statement-breakpoint
CREATE INDEX "survey_questions_version_idx" ON "survey_questions" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_responses_assignment_unique" ON "survey_responses" USING btree ("assignment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_responses_imported_external_unique" ON "survey_responses" USING btree ("imported_external_id");--> statement-breakpoint
CREATE INDEX "survey_responses_survey_idx" ON "survey_responses" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX "survey_responses_version_idx" ON "survey_responses" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "survey_responses_account_idx" ON "survey_responses" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "survey_responses_user_idx" ON "survey_responses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "survey_responses_source_idx" ON "survey_responses" USING btree ("source");--> statement-breakpoint
CREATE INDEX "survey_responses_submitted_at_idx" ON "survey_responses" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "survey_send_deliveries_send_idx" ON "survey_send_deliveries" USING btree ("send_id");--> statement-breakpoint
CREATE INDEX "survey_send_deliveries_assignment_idx" ON "survey_send_deliveries" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "survey_send_deliveries_status_idx" ON "survey_send_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "survey_send_deliveries_notification_idx" ON "survey_send_deliveries" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "survey_sends_survey_idx" ON "survey_sends" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX "survey_sends_version_idx" ON "survey_sends" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "survey_sends_status_idx" ON "survey_sends" USING btree ("status");--> statement-breakpoint
CREATE INDEX "survey_sends_context_key_idx" ON "survey_sends" USING btree ("context_key");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_versions_survey_number_unique" ON "survey_versions" USING btree ("survey_id","version_number");--> statement-breakpoint
CREATE INDEX "survey_versions_survey_status_idx" ON "survey_versions" USING btree ("survey_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "surveys_key_unique" ON "surveys" USING btree ("key");--> statement-breakpoint
CREATE INDEX "surveys_status_idx" ON "surveys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "surveys_category_idx" ON "surveys" USING btree ("category");