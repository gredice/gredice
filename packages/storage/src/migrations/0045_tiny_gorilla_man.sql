CREATE TABLE "community_edit_request_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"field_key" text NOT NULL,
	"section_key" text,
	"attribute_definition_id" integer NOT NULL,
	"attribute_value_id" integer,
	"attribute_path" text NOT NULL,
	"data_type" text NOT NULL,
	"previous_value" text,
	"proposed_value" text,
	"base_value_hash" text NOT NULL,
	"review_diff" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_edit_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"public_path" text NOT NULL,
	"section_key" text,
	"submitter_user_id" text NOT NULL,
	"submitter_name" text,
	"submitter_email" text,
	"submitter_note" text,
	"reviewer_user_id" text,
	"reviewer_name" text,
	"reviewer_note" text,
	"application_failure_reason" text,
	"reviewed_at" timestamp,
	"applied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "community_edit_request_changes" ADD CONSTRAINT "community_edit_request_changes_request_id_community_edit_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."community_edit_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_edit_request_changes" ADD CONSTRAINT "community_edit_request_changes_attribute_definition_id_attribute_definitions_id_fk" FOREIGN KEY ("attribute_definition_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_edit_request_changes" ADD CONSTRAINT "community_edit_request_changes_attribute_value_id_attribute_values_id_fk" FOREIGN KEY ("attribute_value_id") REFERENCES "public"."attribute_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_edit_requests" ADD CONSTRAINT "community_edit_requests_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_edit_requests" ADD CONSTRAINT "community_edit_requests_submitter_user_id_users_id_fk" FOREIGN KEY ("submitter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_edit_requests" ADD CONSTRAINT "community_edit_requests_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_edit_changes_request_id_idx" ON "community_edit_request_changes" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "community_edit_changes_field_key_idx" ON "community_edit_request_changes" USING btree ("field_key");--> statement-breakpoint
CREATE INDEX "community_edit_changes_attribute_definition_idx" ON "community_edit_request_changes" USING btree ("attribute_definition_id");--> statement-breakpoint
CREATE INDEX "community_edit_requests_status_idx" ON "community_edit_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "community_edit_requests_entity_type_idx" ON "community_edit_requests" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "community_edit_requests_entity_id_idx" ON "community_edit_requests" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "community_edit_requests_submitter_idx" ON "community_edit_requests" USING btree ("submitter_user_id");--> statement-breakpoint
CREATE INDEX "community_edit_requests_created_at_idx" ON "community_edit_requests" USING btree ("created_at");