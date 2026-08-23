ALTER TABLE "delivery_run_stops" DROP CONSTRAINT "delivery_run_stops_outcome_shape_check";--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "retry_lane_rank" integer;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "retry_attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD COLUMN "released_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_runs" ADD COLUMN "reroute_attempted_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_runs" ADD COLUMN "current_location_received_at" timestamp;--> statement-breakpoint
WITH deferred_physical_groups AS (
    SELECT
        stops."run_id",
        coalesce(
            stops."stop_key",
            runs."time_slot_id"::text || ':' || regexp_replace(
                regexp_replace(lower(trim(stops."formatted_address")), '\s*,\s*', ',', 'g'),
                '\s+',
                ' ',
                'g'
            )
        ) AS "physical_key",
        min(coalesce(stops."exception_occurred_at", stops."updated_at", stops."created_at")) AS "first_deferred_at",
        min(stops."sequence") AS "first_sequence"
    FROM "delivery_run_stops" stops
    INNER JOIN "delivery_runs" runs ON runs."id" = stops."run_id"
    WHERE stops."state" = 'deferred'
    GROUP BY stops."run_id", "physical_key"
), ranked_deferred_groups AS (
    SELECT
        "run_id",
        "physical_key",
        row_number() OVER (
            PARTITION BY "run_id"
            ORDER BY "first_sequence", "first_deferred_at", "physical_key"
        ) AS "retry_lane_rank"
    FROM deferred_physical_groups
), deferred_retry_lanes AS (
    SELECT stops."id", ranked_deferred_groups."retry_lane_rank"
    FROM "delivery_run_stops" stops
    INNER JOIN "delivery_runs" runs ON runs."id" = stops."run_id"
    INNER JOIN ranked_deferred_groups
        ON ranked_deferred_groups."run_id" = stops."run_id"
        AND ranked_deferred_groups."physical_key" = coalesce(
            stops."stop_key",
            runs."time_slot_id"::text || ':' || regexp_replace(
                regexp_replace(lower(trim(stops."formatted_address")), '\s*,\s*', ',', 'g'),
                '\s+',
                ' ',
                'g'
            )
        )
    WHERE stops."state" = 'deferred'
)
UPDATE "delivery_run_stops"
SET
    "retry_lane_rank" = deferred_retry_lanes."retry_lane_rank",
    "retry_attempt" = 1
FROM deferred_retry_lanes
WHERE "delivery_run_stops"."id" = deferred_retry_lanes."id";--> statement-breakpoint
WITH active_delivery_requests AS (
    SELECT DISTINCT "delivery_run_stops"."delivery_request_id"
    FROM "delivery_run_stops"
    INNER JOIN "delivery_runs"
        ON "delivery_runs"."id" = "delivery_run_stops"."run_id"
    WHERE "delivery_runs"."state" = 'active'
      AND "delivery_run_stops"."state" <> 'delivered'
), latest_delivery_state AS (
    SELECT
        active_delivery_requests."delivery_request_id" AS "aggregate_id",
        latest_event."type",
        latest_event."created_at"
    FROM active_delivery_requests
    CROSS JOIN LATERAL (
        SELECT "events"."type", "events"."created_at"
        FROM "events"
        WHERE "events"."aggregate_id" = active_delivery_requests."delivery_request_id"
          AND "events"."type" in (
              'delivery.request.created',
              'delivery.request.confirmed',
              'delivery.request.preparing',
              'delivery.request.ready',
              'delivery.request.fulfilled',
              'delivery.request.user_cancelled',
              'delivery.request.cancelled'
          )
        ORDER BY "events"."created_at" DESC, "events"."id" DESC
        LIMIT 1
    ) latest_event
)
UPDATE "delivery_run_stops"
SET
    "state" = 'cancelled',
    "delivered_at" = null,
    "exception_reason" = 'cancellation',
    "exception_note" = null,
    "exception_occurred_at" = latest_delivery_state."created_at",
    "exception_recorded_by_user_id" = null,
    "released_at" = latest_delivery_state."created_at"
FROM latest_delivery_state, "delivery_runs"
WHERE latest_delivery_state."aggregate_id" = "delivery_run_stops"."delivery_request_id"
  AND latest_delivery_state."type" in ('delivery.request.user_cancelled', 'delivery.request.cancelled')
  AND "delivery_runs"."id" = "delivery_run_stops"."run_id"
  AND "delivery_runs"."state" = 'active'
  AND "delivery_run_stops"."state" <> 'delivered';--> statement-breakpoint
UPDATE "delivery_runs"
SET
    "route_revision" = "route_revision" + 1,
    "reroute_required_at" = (
        SELECT max("delivery_run_stops"."released_at")
        FROM "delivery_run_stops"
        WHERE "delivery_run_stops"."run_id" = "delivery_runs"."id"
          AND "delivery_run_stops"."state" = 'cancelled'
          AND "delivery_run_stops"."released_at" is not null
    ),
    "reroute_attempted_at" = null
WHERE "delivery_runs"."state" = 'active'
  AND EXISTS (
      SELECT 1
      FROM "delivery_run_stops"
      WHERE "delivery_run_stops"."run_id" = "delivery_runs"."id"
        AND "delivery_run_stops"."state" = 'cancelled'
        AND "delivery_run_stops"."released_at" is not null
  );--> statement-breakpoint
UPDATE "delivery_runs"
SET
    "state" = 'completed',
    "completed_at" = coalesce(
        "completed_at",
        (
            SELECT max(coalesce(
                "delivery_run_stops"."delivered_at",
                "delivery_run_stops"."exception_occurred_at",
                "delivery_run_stops"."updated_at",
                "delivery_run_stops"."created_at"
            ))
            FROM "delivery_run_stops"
            WHERE "delivery_run_stops"."run_id" = "delivery_runs"."id"
        ),
        now()
    ),
    "reroute_required_at" = null,
    "current_latitude" = null,
    "current_longitude" = null,
    "current_location_accuracy" = null,
    "current_location_heading" = null,
    "current_location_speed" = null,
    "current_location_recorded_at" = null,
    "current_location_received_at" = null
WHERE "delivery_runs"."state" = 'active'
  AND EXISTS (
      SELECT 1
      FROM "delivery_run_stops"
      WHERE "delivery_run_stops"."run_id" = "delivery_runs"."id"
  )
  AND NOT EXISTS (
      SELECT 1
      FROM "delivery_run_stops"
      WHERE "delivery_run_stops"."run_id" = "delivery_runs"."id"
        AND "delivery_run_stops"."state" NOT IN ('delivered', 'failed', 'cancelled')
  );--> statement-breakpoint
UPDATE "delivery_run_stops"
SET "released_at" = coalesce(
    "delivered_at",
    "exception_occurred_at",
    "updated_at",
    "created_at"
)
WHERE "state" in ('delivered', 'cancelled')
   OR (
       "state" = 'failed'
       AND EXISTS (
           SELECT 1
           FROM "delivery_runs"
           WHERE "delivery_runs"."id" = "delivery_run_stops"."run_id"
             AND "delivery_runs"."state" <> 'active'
       )
   );--> statement-breakpoint
DROP INDEX "delivery_run_stops_delivery_request_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_run_stops_delivery_request_active_unique" ON "delivery_run_stops" USING btree ("delivery_request_id") WHERE "delivery_run_stops"."released_at" is null;--> statement-breakpoint
CREATE INDEX "delivery_run_stops_run_retry_lane_rank_idx" ON "delivery_run_stops" USING btree ("run_id","retry_lane_rank");--> statement-breakpoint
CREATE INDEX "delivery_run_stops_released_at_idx" ON "delivery_run_stops" USING btree ("released_at");--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_retry_shape_check" CHECK ((
                "delivery_run_stops"."retry_lane_rank" is null
                and "delivery_run_stops"."retry_attempt" = 0
            ) or (
                "delivery_run_stops"."retry_lane_rank" is not null
                and "delivery_run_stops"."retry_lane_rank" > 0
                and "delivery_run_stops"."retry_attempt" > 0
            ));--> statement-breakpoint
ALTER TABLE "delivery_run_stops" ADD CONSTRAINT "delivery_run_stops_release_shape_check" CHECK ("delivery_run_stops"."released_at" is null or "delivery_run_stops"."state" in ('delivered', 'failed', 'cancelled'));--> statement-breakpoint
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
                "delivery_run_stops"."state" in ('deferred', 'failed')
                and "delivery_run_stops"."delivered_at" is null
                and "delivery_run_stops"."exception_reason" is not null
                and "delivery_run_stops"."exception_occurred_at" is not null
                and "delivery_run_stops"."exception_recorded_by_user_id" is not null
            ) or (
                "delivery_run_stops"."state" = 'cancelled'
                and "delivery_run_stops"."delivered_at" is null
                and "delivery_run_stops"."exception_reason" = 'cancellation'
                and "delivery_run_stops"."exception_occurred_at" is not null
            ));
