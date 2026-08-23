CREATE TABLE "delivery_run_exception_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"driver_user_id" text NOT NULL,
	"client_operation_id" text NOT NULL,
	"payload_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "exception_reason" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "exception_note" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "exception_occurred_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "exception_recorded_by_user_id" text;--> statement-breakpoint
ALTER TABLE "delivery_runs" ADD COLUMN "route_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_runs" ADD COLUMN "reroute_required_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_run_exception_operations" ADD CONSTRAINT "delivery_run_exception_operations_run_id_delivery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."delivery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_exception_operations" ADD CONSTRAINT "delivery_run_exception_operations_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_exception_operations_run_client_unique" ON "delivery_run_exception_operations" USING btree ("run_id","client_operation_id");--> statement-breakpoint
CREATE INDEX "delivery_run_exception_operations_run_id_idx" ON "delivery_run_exception_operations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "delivery_run_exception_operations_driver_user_id_idx" ON "delivery_run_exception_operations" USING btree ("driver_user_id");--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_exception_recorded_by_user_id_users_id_fk" FOREIGN KEY ("exception_recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_state_check" CHECK ("delivery_run_stops"."state" in ('pending', 'arrived', 'delivered', 'deferred', 'failed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_exception_reason_check" CHECK ("delivery_run_stops"."exception_reason" is null or "delivery_run_stops"."exception_reason" in ('customer-unavailable', 'address-inaccessible', 'address-wrong', 'harvest-damaged', 'harvest-missing', 'cancellation', 'operational-other'));--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_cancellation_pair_check" CHECK (("delivery_run_stops"."state" = 'cancelled') = coalesce("delivery_run_stops"."exception_reason" = 'cancellation', false));--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_outcome_shape_check" CHECK ((
                "delivery_run_stops"."state" in ('pending', 'arrived')
                and "delivery_run_stops"."delivered_at" is null
                and "delivery_run_stops"."exception_reason" is null
                and "delivery_run_stops"."exception_note" is null
                and "delivery_run_stops"."exception_occurred_at" is null
                and "delivery_run_stops"."exception_recorded_by_user_id" is null
            ) or (
                "delivery_run_stops"."state" = 'delivered'
                and "delivery_run_stops"."delivered_at" is not null
                and "delivery_run_stops"."exception_reason" is null
                and "delivery_run_stops"."exception_note" is null
                and "delivery_run_stops"."exception_occurred_at" is null
                and "delivery_run_stops"."exception_recorded_by_user_id" is null
            ) or (
                "delivery_run_stops"."state" in ('deferred', 'failed', 'cancelled')
                and "delivery_run_stops"."delivered_at" is null
                and "delivery_run_stops"."exception_reason" is not null
                and "delivery_run_stops"."exception_occurred_at" is not null
                and "delivery_run_stops"."exception_recorded_by_user_id" is not null
            ));