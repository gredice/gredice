DROP INDEX "automation_runs_definition_source_schedule_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "automation_runs_definition_source_schedule_idx" ON "automation_runs" USING btree ("automation_definition_id","source_aggregate_id") WHERE "automation_runs"."source_event_type" in ('automation.schedule', 'automation.schedule.monthly');
