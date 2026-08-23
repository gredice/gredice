CREATE TABLE "delivery_run_stops" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"delivery_request_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"formatted_address" text NOT NULL,
	"estimated_arrival_at" timestamp,
	"estimated_travel_seconds" integer,
	"estimated_distance_meters" integer,
	"arrived_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"driver_user_id" text NOT NULL,
	"time_slot_id" integer NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"encoded_polyline" text,
	"total_distance_meters" integer,
	"total_duration_seconds" integer,
	"current_latitude" double precision,
	"current_longitude" double precision,
	"current_location_accuracy" double precision,
	"current_location_heading" double precision,
	"current_location_speed" double precision,
	"current_location_recorded_at" timestamp,
	"estimates_updated_at" timestamp,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_run_id_delivery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."delivery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_delivery_request_id_delivery_requests_id_fk" FOREIGN KEY ("delivery_request_id") REFERENCES "public"."delivery_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_runs" ADD CONSTRAINT "delivery_runs_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_runs" ADD CONSTRAINT "delivery_runs_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_stops_delivery_request_id_unique" ON "delivery_run_stops" USING btree ("delivery_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_stops_run_sequence_unique" ON "delivery_run_stops" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE INDEX "delivery_run_stops_run_id_idx" ON "delivery_run_stops" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "delivery_run_stops_state_idx" ON "delivery_run_stops" USING btree ("state");--> statement-breakpoint
CREATE INDEX "delivery_runs_driver_user_id_idx" ON "delivery_runs" USING btree ("driver_user_id");--> statement-breakpoint
CREATE INDEX "delivery_runs_time_slot_id_idx" ON "delivery_runs" USING btree ("time_slot_id");--> statement-breakpoint
CREATE INDEX "delivery_runs_state_idx" ON "delivery_runs" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_runs_driver_active_unique" ON "delivery_runs" USING btree ("driver_user_id") WHERE "delivery_runs"."state" = 'active';--> statement-breakpoint
CREATE INDEX "delivery_runs_location_recorded_at_idx" ON "delivery_runs" USING btree ("current_location_recorded_at");