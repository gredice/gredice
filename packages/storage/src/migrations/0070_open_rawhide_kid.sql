ALTER TABLE "delivery_run_pickup_nodes" ADD COLUMN "itinerary_sequence" integer;--> statement-breakpoint
ALTER TABLE "delivery_run_pickup_nodes" ADD COLUMN "estimated_arrival_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_run_pickup_nodes" ADD COLUMN "incoming_travel_seconds" integer;--> statement-breakpoint
ALTER TABLE "delivery_run_pickup_nodes" ADD COLUMN "incoming_distance_meters" integer;--> statement-breakpoint
ALTER TABLE "delivery_run_pickup_nodes" ADD COLUMN "service_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "itinerary_sequence" integer;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "service_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "delivery_runs" ADD COLUMN "route_plan_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_runs" ADD COLUMN "estimate_source" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_pickup_nodes_run_itinerary_sequence_unique" ON "delivery_run_pickup_nodes" USING btree ("run_id","itinerary_sequence") WHERE "delivery_run_pickup_nodes"."itinerary_sequence" is not null;--> statement-breakpoint
CREATE INDEX "delivery_run_stops_run_itinerary_sequence_idx" ON "delivery_run_stops" USING btree ("run_id","itinerary_sequence");--> statement-breakpoint
ALTER TABLE "delivery_run_pickup_nodes" ADD CONSTRAINT "delivery_run_pickup_nodes_itinerary_shape_check" CHECK ((
                "delivery_run_pickup_nodes"."itinerary_sequence" is null
                and "delivery_run_pickup_nodes"."estimated_arrival_at" is null
                and "delivery_run_pickup_nodes"."incoming_travel_seconds" is null
                and "delivery_run_pickup_nodes"."incoming_distance_meters" is null
                and "delivery_run_pickup_nodes"."service_duration_seconds" is null
            ) or (
                "delivery_run_pickup_nodes"."itinerary_sequence" is not null
                and "delivery_run_pickup_nodes"."itinerary_sequence" > 0
                and "delivery_run_pickup_nodes"."estimated_arrival_at" is not null
                and "delivery_run_pickup_nodes"."incoming_travel_seconds" is not null
                and "delivery_run_pickup_nodes"."incoming_travel_seconds" >= 0
                and "delivery_run_pickup_nodes"."incoming_distance_meters" is not null
                and "delivery_run_pickup_nodes"."incoming_distance_meters" >= 0
                and "delivery_run_pickup_nodes"."service_duration_seconds" is not null
                and "delivery_run_pickup_nodes"."service_duration_seconds" >= 0
            ));--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_itinerary_shape_check" CHECK ((
                "delivery_run_stops"."itinerary_sequence" is null
                and "delivery_run_stops"."service_duration_seconds" is null
            ) or (
                "delivery_run_stops"."itinerary_sequence" is not null
                and "delivery_run_stops"."itinerary_sequence" > 0
                and "delivery_run_stops"."service_duration_seconds" is not null
                and "delivery_run_stops"."service_duration_seconds" >= 0
            ));--> statement-breakpoint
ALTER TABLE "delivery_runs" ADD CONSTRAINT "delivery_runs_route_plan_provenance_check" CHECK ((
                "delivery_runs"."route_plan_version" = 1
                and "delivery_runs"."estimate_source" = 'legacy'
            ) or (
                "delivery_runs"."route_plan_version" >= 2
                and "delivery_runs"."estimate_source" in ('google', 'local')
            ));