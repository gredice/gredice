CREATE TABLE "delivery_run_pickup_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"pickup_node_id" text NOT NULL,
	"driver_user_id" text NOT NULL,
	"client_operation_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_run_pickup_operations_kind_check" CHECK ("delivery_run_pickup_operations"."kind" in ('scan', 'mark-item', 'confirm-manifest'))
);
--> statement-breakpoint
ALTER TABLE "delivery_run_slots" ADD COLUMN "manifest_state" text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_run_slots" ADD COLUMN "confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_run_slots" ADD COLUMN "confirmed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "pickup_item_state" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "pickup_trace_link_id" integer;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "pickup_trace_token" text;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "pickup_resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "pickup_resolved_by_user_id" text;--> statement-breakpoint
ALTER TABLE "delivery_run_pickup_operations" ADD CONSTRAINT "delivery_run_pickup_operations_run_id_delivery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."delivery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_pickup_operations" ADD CONSTRAINT "delivery_run_pickup_operations_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_pickup_operations" ADD CONSTRAINT "delivery_run_pickup_operations_run_pickup_node_fk" FOREIGN KEY ("run_id","pickup_node_id") REFERENCES "public"."delivery_run_pickup_nodes"("run_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_pickup_operations_run_client_unique" ON "delivery_run_pickup_operations" USING btree ("run_id","client_operation_id");--> statement-breakpoint
CREATE INDEX "delivery_run_pickup_operations_run_id_idx" ON "delivery_run_pickup_operations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "delivery_run_pickup_operations_pickup_node_id_idx" ON "delivery_run_pickup_operations" USING btree ("pickup_node_id");--> statement-breakpoint
ALTER TABLE "delivery_run_slots" ADD CONSTRAINT "delivery_run_slots_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_pickup_trace_link_id_harvest_trace_links_id_fk" FOREIGN KEY ("pickup_trace_link_id") REFERENCES "public"."harvest_trace_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_pickup_resolved_by_user_id_users_id_fk" FOREIGN KEY ("pickup_resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_run_stops_pickup_trace_token_idx" ON "delivery_run_stops" USING btree ("pickup_trace_token");--> statement-breakpoint
CREATE INDEX "delivery_run_stops_pickup_item_state_idx" ON "delivery_run_stops" USING btree ("pickup_item_state");--> statement-breakpoint
ALTER TABLE "delivery_run_slots" ADD CONSTRAINT "delivery_run_slots_manifest_state_check" CHECK ("delivery_run_slots"."manifest_state" in ('pending', 'confirmed'));--> statement-breakpoint
ALTER TABLE "delivery_run_slots" ADD CONSTRAINT "delivery_run_slots_manifest_confirmation_shape_check" CHECK ("delivery_run_slots"."manifest_state" = 'confirmed' or ("delivery_run_slots"."confirmed_at" is null and "delivery_run_slots"."confirmed_by_user_id" is null));--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_pickup_item_state_check" CHECK ("delivery_run_stops"."pickup_item_state" is null or "delivery_run_stops"."pickup_item_state" in ('ready', 'scanned', 'missing-label', 'not-ready'));--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_pickup_item_resolution_shape_check" CHECK ((
                "delivery_run_stops"."pickup_item_state" is null
                and "delivery_run_stops"."pickup_trace_link_id" is null
                and "delivery_run_stops"."pickup_trace_token" is null
                and "delivery_run_stops"."pickup_resolved_at" is null
                and "delivery_run_stops"."pickup_resolved_by_user_id" is null
            ) or (
                "delivery_run_stops"."pickup_item_state" = 'ready'
                and "delivery_run_stops"."pickup_resolved_at" is null
                and "delivery_run_stops"."pickup_resolved_by_user_id" is null
            ) or (
                "delivery_run_stops"."pickup_item_state" in ('scanned', 'missing-label', 'not-ready')
                and "delivery_run_stops"."pickup_resolved_at" is not null
            ));