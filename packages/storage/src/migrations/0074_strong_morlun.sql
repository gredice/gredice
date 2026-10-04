CREATE TABLE "delivery_run_stop_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"target_stop_id" integer NOT NULL,
	"driver_user_id" text NOT NULL,
	"client_operation_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_run_stop_operations_kind_check" CHECK ("delivery_run_stop_operations"."kind" in ('arrive', 'deliver'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_stops_run_id_id_unique" ON "delivery_run_stops" USING btree ("run_id","id");--> statement-breakpoint
ALTER TABLE "delivery_run_stop_operations" ADD CONSTRAINT "delivery_run_stop_operations_run_id_delivery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."delivery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_stop_operations" ADD CONSTRAINT "delivery_run_stop_operations_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_stop_operations" ADD CONSTRAINT "delivery_run_stop_operations_run_target_stop_fk" FOREIGN KEY ("run_id","target_stop_id") REFERENCES "public"."delivery_run_stops"("run_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_stop_operations_run_client_unique" ON "delivery_run_stop_operations" USING btree ("run_id","client_operation_id");--> statement-breakpoint
CREATE INDEX "delivery_run_stop_operations_run_id_idx" ON "delivery_run_stop_operations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "delivery_run_stop_operations_target_stop_id_idx" ON "delivery_run_stop_operations" USING btree ("target_stop_id");--> statement-breakpoint
CREATE INDEX "delivery_run_stop_operations_driver_user_id_idx" ON "delivery_run_stop_operations" USING btree ("driver_user_id");
