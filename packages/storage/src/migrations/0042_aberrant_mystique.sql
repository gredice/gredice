ALTER TYPE "public"."automation_run_source" ADD VALUE 'schedule' BEFORE 'test';--> statement-breakpoint
CREATE UNIQUE INDEX "automation_runs_definition_source_schedule_idx" ON "automation_runs" USING btree ("automation_definition_id","source_aggregate_id") WHERE "automation_runs"."source_event_type" = 'automation.schedule.monthly';
