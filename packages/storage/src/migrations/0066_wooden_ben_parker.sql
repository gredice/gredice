CREATE TABLE "garden_preview_blob_deletions" (
	"id" serial PRIMARY KEY NOT NULL,
	"pathname" text NOT NULL,
	"image_url" text NOT NULL,
	"reason" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_attempt_at" timestamp,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"claim_id" text,
	"claim_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garden_preview_blob_scan_states" (
	"name" text PRIMARY KEY NOT NULL,
	"cursor" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garden_preview_capture_leases" (
	"garden_id" integer PRIMARY KEY NOT NULL,
	"lease_id" text NOT NULL,
	"acquired_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garden_previews" (
	"garden_id" integer PRIMARY KEY NOT NULL,
	"capture_request_id" text NOT NULL,
	"image_url" text NOT NULL,
	"pathname" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"source_revision" text NOT NULL,
	"renderer_version" text NOT NULL,
	"capture_requested_at" timestamp NOT NULL,
	"captured_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garden_preview_capture_leases" ADD CONSTRAINT "garden_preview_capture_leases_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_previews" ADD CONSTRAINT "garden_previews_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "garden_preview_blob_deletions_pathname_uq" ON "garden_preview_blob_deletions" USING btree ("pathname");--> statement-breakpoint
CREATE INDEX "garden_preview_blob_deletions_next_attempt_at_idx" ON "garden_preview_blob_deletions" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "garden_preview_blob_deletions_claim_expires_at_idx" ON "garden_preview_blob_deletions" USING btree ("claim_expires_at");--> statement-breakpoint
CREATE INDEX "garden_preview_capture_leases_expires_at_idx" ON "garden_preview_capture_leases" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "garden_previews_capture_request_id_uq" ON "garden_previews" USING btree ("capture_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "garden_previews_pathname_uq" ON "garden_previews" USING btree ("pathname");--> statement-breakpoint
CREATE INDEX "garden_previews_captured_at_idx" ON "garden_previews" USING btree ("captured_at");