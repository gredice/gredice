CREATE TABLE "delivery_run_handoff_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"target_stop_id" integer NOT NULL,
	"retry_attempt" integer NOT NULL,
	"driver_user_id" text NOT NULL,
	"client_operation_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_run_handoff_operations_kind_check" CHECK ("delivery_run_handoff_operations"."kind" in ('scan', 'mark-item')),
	CONSTRAINT "delivery_run_handoff_operations_retry_attempt_check" CHECK ("delivery_run_handoff_operations"."retry_attempt" >= 0)
);
--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "handoff_verification_state" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "handoff_verification_reason" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "handoff_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "handoff_verified_by_user_id" text;--> statement-breakpoint
ALTER TABLE "delivery_run_handoff_operations" ADD CONSTRAINT "delivery_run_handoff_operations_run_id_delivery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."delivery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_handoff_operations" ADD CONSTRAINT "delivery_run_handoff_operations_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_handoff_operations" ADD CONSTRAINT "delivery_run_handoff_operations_run_target_stop_fk" FOREIGN KEY ("run_id","target_stop_id") REFERENCES "public"."delivery_run_stops"("run_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_handoff_operations_run_client_unique" ON "delivery_run_handoff_operations" USING btree ("run_id","client_operation_id");--> statement-breakpoint
CREATE INDEX "delivery_run_handoff_operations_run_id_idx" ON "delivery_run_handoff_operations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "delivery_run_handoff_operations_target_stop_id_idx" ON "delivery_run_handoff_operations" USING btree ("target_stop_id");--> statement-breakpoint
CREATE INDEX "delivery_run_handoff_operations_driver_user_id_idx" ON "delivery_run_handoff_operations" USING btree ("driver_user_id");--> statement-breakpoint
CREATE INDEX "delivery_run_handoff_operations_applied_at_idx" ON "delivery_run_handoff_operations" USING btree ("applied_at");--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_handoff_verified_by_user_id_users_id_fk" FOREIGN KEY ("handoff_verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_run_stops_handoff_verification_state_idx" ON "delivery_run_stops" USING btree ("handoff_verification_state");--> statement-breakpoint
CREATE INDEX "delivery_runs_completed_at_idx" ON "delivery_runs" USING btree ("completed_at");--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_handoff_verification_state_check" CHECK ("delivery_run_stops"."handoff_verification_state" is null or "delivery_run_stops"."handoff_verification_state" in ('unverified', 'scanned', 'no-label', 'missing', 'skipped'));--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_handoff_verification_reason_check" CHECK ("delivery_run_stops"."handoff_verification_reason" is null or "delivery_run_stops"."handoff_verification_reason" in ('scanner-unavailable', 'label-unreadable', 'manual-verification', 'other-operational'));--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_handoff_verification_shape_check" CHECK ((
                "delivery_run_stops"."handoff_verification_state" is null
                and "delivery_run_stops"."handoff_verification_reason" is null
                and "delivery_run_stops"."handoff_verified_at" is null
                and "delivery_run_stops"."handoff_verified_by_user_id" is null
            ) or (
                "delivery_run_stops"."handoff_verification_state" = 'unverified'
                and "delivery_run_stops"."handoff_verification_reason" is null
                and "delivery_run_stops"."handoff_verified_at" is null
                and "delivery_run_stops"."handoff_verified_by_user_id" is null
            ) or (
                "delivery_run_stops"."handoff_verification_state" in ('scanned', 'no-label', 'missing')
                and "delivery_run_stops"."handoff_verification_reason" is null
                and "delivery_run_stops"."handoff_verified_at" is not null
            ) or (
                "delivery_run_stops"."handoff_verification_state" = 'skipped'
                and "delivery_run_stops"."handoff_verification_reason" is not null
                and "delivery_run_stops"."handoff_verified_at" is not null
            ));