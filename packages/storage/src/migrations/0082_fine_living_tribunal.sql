CREATE TABLE "status_live_events" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"event_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_live_events_source_check" CHECK ("status_live_events"."source" in ('vercel', 'github')),
	CONSTRAINT "status_live_events_event_count_check" CHECK ("status_live_events"."event_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "status_live_ingest_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_live_ingest_deliveries_source_check" CHECK ("status_live_ingest_deliveries"."source" in ('vercel', 'github'))
);
--> statement-breakpoint
CREATE INDEX "status_live_events_occurred_at_idx" ON "status_live_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "status_live_events_source_occurred_at_idx" ON "status_live_events" USING btree ("source","occurred_at");--> statement-breakpoint
CREATE INDEX "status_live_ingest_deliveries_received_at_idx" ON "status_live_ingest_deliveries" USING btree ("received_at");