CREATE TABLE "delivery_run_pickup_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"pickup_location_id" integer,
	"sequence" integer NOT NULL,
	"name" text NOT NULL,
	"street1" text NOT NULL,
	"street2" text,
	"city" text NOT NULL,
	"postal_code" text NOT NULL,
	"country_code" text NOT NULL,
	"formatted_address" text NOT NULL,
	"source_updated_at" timestamp NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_run_preparations" (
	"id" text PRIMARY KEY NOT NULL,
	"secret_hash" text NOT NULL,
	"driver_user_id" text NOT NULL,
	"selection_hash" text NOT NULL,
	"plan" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"delivery_run_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_run_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"pickup_node_id" text NOT NULL,
	"time_slot_id" integer,
	"sequence" integer NOT NULL,
	"manifest_id" text NOT NULL,
	"window_start_at" timestamp NOT NULL,
	"window_end_at" timestamp NOT NULL,
	"source_updated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "run_slot_id" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "stop_key" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "request_dispatch_event_id" integer;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "delivery_address_id" integer;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "delivery_address_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "delivery_address_label" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "delivery_contact_name" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "delivery_phone" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "delivery_street1" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "delivery_street2" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "delivery_city" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "delivery_postal_code" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "delivery_country_code" text;--> statement-breakpoint
ALTER TABLE "delivery_run_pickup_nodes" ADD CONSTRAINT "delivery_run_pickup_nodes_run_id_delivery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."delivery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_pickup_nodes" ADD CONSTRAINT "delivery_run_pickup_nodes_pickup_location_id_pickup_locations_id_fk" FOREIGN KEY ("pickup_location_id") REFERENCES "public"."pickup_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_preparations" ADD CONSTRAINT "delivery_run_preparations_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_preparations" ADD CONSTRAINT "delivery_run_preparations_delivery_run_id_delivery_runs_id_fk" FOREIGN KEY ("delivery_run_id") REFERENCES "public"."delivery_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_preparations" ADD CONSTRAINT "delivery_run_preparations_consumption_shape_check" CHECK (("delivery_run_preparations"."consumed_at" is null and "delivery_run_preparations"."delivery_run_id" is null) or ("delivery_run_preparations"."consumed_at" is not null and "delivery_run_preparations"."delivery_run_id" is not null));--> statement-breakpoint
ALTER TABLE "delivery_run_slots" ADD CONSTRAINT "delivery_run_slots_run_id_delivery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."delivery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_slots" ADD CONSTRAINT "delivery_run_slots_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_pickup_nodes_run_id_id_unique" ON "delivery_run_pickup_nodes" USING btree ("run_id","id");--> statement-breakpoint
ALTER TABLE "delivery_run_slots" ADD CONSTRAINT "delivery_run_slots_run_pickup_node_fk" FOREIGN KEY ("run_id","pickup_node_id") REFERENCES "public"."delivery_run_pickup_nodes"("run_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_pickup_nodes_run_sequence_unique" ON "delivery_run_pickup_nodes" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_pickup_nodes_run_location_unique" ON "delivery_run_pickup_nodes" USING btree ("run_id","pickup_location_id");--> statement-breakpoint
CREATE INDEX "delivery_run_pickup_nodes_run_id_idx" ON "delivery_run_pickup_nodes" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "delivery_run_preparations_driver_user_id_idx" ON "delivery_run_preparations" USING btree ("driver_user_id");--> statement-breakpoint
CREATE INDEX "delivery_run_preparations_expires_at_idx" ON "delivery_run_preparations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "delivery_run_preparations_consumed_at_idx" ON "delivery_run_preparations" USING btree ("consumed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_preparations_delivery_run_id_unique" ON "delivery_run_preparations" USING btree ("delivery_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_slots_manifest_id_unique" ON "delivery_run_slots" USING btree ("manifest_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_slots_run_sequence_unique" ON "delivery_run_slots" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_slots_run_time_slot_unique" ON "delivery_run_slots" USING btree ("run_id","time_slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_slots_run_id_id_unique" ON "delivery_run_slots" USING btree ("run_id","id");--> statement-breakpoint
CREATE INDEX "delivery_run_slots_run_id_idx" ON "delivery_run_slots" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "delivery_run_slots_pickup_node_id_idx" ON "delivery_run_slots" USING btree ("pickup_node_id");--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_run_slot_fk" FOREIGN KEY ("run_id","run_slot_id") REFERENCES "public"."delivery_run_slots"("run_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_run_stops_run_slot_id_idx" ON "delivery_run_stops" USING btree ("run_slot_id");--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_snapshot_shape_check" CHECK ((
                "delivery_run_stops"."run_slot_id" is null
                and "delivery_run_stops"."stop_key" is null
                and "delivery_run_stops"."request_dispatch_event_id" is null
                and "delivery_run_stops"."delivery_address_id" is null
                and "delivery_run_stops"."delivery_address_updated_at" is null
                and "delivery_run_stops"."delivery_address_label" is null
                and "delivery_run_stops"."delivery_contact_name" is null
                and "delivery_run_stops"."delivery_phone" is null
                and "delivery_run_stops"."delivery_street1" is null
                and "delivery_run_stops"."delivery_street2" is null
                and "delivery_run_stops"."delivery_city" is null
                and "delivery_run_stops"."delivery_postal_code" is null
                and "delivery_run_stops"."delivery_country_code" is null
            ) or (
                "delivery_run_stops"."run_slot_id" is not null
                and "delivery_run_stops"."stop_key" is not null
                and "delivery_run_stops"."request_dispatch_event_id" is not null
                and "delivery_run_stops"."delivery_address_id" is not null
                and "delivery_run_stops"."delivery_address_updated_at" is not null
                and "delivery_run_stops"."delivery_address_label" is not null
                and "delivery_run_stops"."delivery_contact_name" is not null
                and "delivery_run_stops"."delivery_phone" is not null
                and "delivery_run_stops"."delivery_street1" is not null
                and "delivery_run_stops"."delivery_city" is not null
                and "delivery_run_stops"."delivery_postal_code" is not null
                and "delivery_run_stops"."delivery_country_code" is not null
            ));
