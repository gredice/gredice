CREATE TYPE "public"."automation_definition_status" AS ENUM('draft', 'enabled', 'disabled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."automation_module_kind" AS ENUM('trigger', 'filter', 'condition', 'action');--> statement-breakpoint
CREATE TYPE "public"."automation_run_source" AS ENUM('event', 'manual', 'test', 'replay');--> statement-breakpoint
CREATE TYPE "public"."automation_run_status" AS ENUM('queued', 'running', 'succeeded', 'skipped', 'failed', 'retrying', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."automation_step_status" AS ENUM('pending', 'running', 'succeeded', 'skipped', 'failed');--> statement-breakpoint
CREATE TABLE "automation_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "automation_definition_status" DEFAULT 'draft' NOT NULL,
	"trigger_module_key" text,
	"trigger_event_type" text,
	"graph" jsonb DEFAULT '{"nodes":[],"edges":[]}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_event_cursors" (
	"key" text PRIMARY KEY NOT NULL,
	"last_event_id" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"automation_definition_id" integer NOT NULL,
	"automation_definition_key" text NOT NULL,
	"automation_definition_name" text NOT NULL,
	"source" "automation_run_source" NOT NULL,
	"source_event_id" integer,
	"source_event_type" text,
	"source_aggregate_id" text,
	"parent_run_id" integer,
	"status" "automation_run_status" DEFAULT 'queued' NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_run_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"locked_by" text,
	"manual_requested_by_user_id" text,
	"graph_snapshot" jsonb DEFAULT '{"nodes":[],"edges":[]}'::jsonb NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_run_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"node_id" text NOT NULL,
	"module_key" text NOT NULL,
	"module_kind" "automation_module_kind" NOT NULL,
	"status" "automation_step_status" DEFAULT 'pending' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_definitions" ADD CONSTRAINT "automation_definitions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_definitions" ADD CONSTRAINT "automation_definitions_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_definition_id_automation_definitions_id_fk" FOREIGN KEY ("automation_definition_id") REFERENCES "public"."automation_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_manual_requested_by_user_id_users_id_fk" FOREIGN KEY ("manual_requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_run_steps" ADD CONSTRAINT "automation_run_steps_run_id_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."automation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "automation_definitions_key_idx" ON "automation_definitions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "automation_definitions_status_idx" ON "automation_definitions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "automation_definitions_trigger_event_type_idx" ON "automation_definitions" USING btree ("trigger_event_type");--> statement-breakpoint
CREATE INDEX "automation_definitions_updated_at_idx" ON "automation_definitions" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_runs_definition_source_event_idx" ON "automation_runs" USING btree ("automation_definition_id","source_event_id") WHERE "automation_runs"."source" = 'event';--> statement-breakpoint
CREATE INDEX "automation_runs_definition_id_idx" ON "automation_runs" USING btree ("automation_definition_id");--> statement-breakpoint
CREATE INDEX "automation_runs_status_next_run_at_idx" ON "automation_runs" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "automation_runs_source_event_type_idx" ON "automation_runs" USING btree ("source_event_type");--> statement-breakpoint
CREATE INDEX "automation_runs_source_event_id_idx" ON "automation_runs" USING btree ("source_event_id");--> statement-breakpoint
CREATE INDEX "automation_runs_created_at_idx" ON "automation_runs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_run_steps_run_node_idx" ON "automation_run_steps" USING btree ("run_id","node_id");--> statement-breakpoint
CREATE INDEX "automation_run_steps_run_id_idx" ON "automation_run_steps" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "automation_run_steps_status_idx" ON "automation_run_steps" USING btree ("status");
