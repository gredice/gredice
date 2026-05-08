CREATE TABLE "entity_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"action" text NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"attribute_value_id" integer,
	"attribute_definition_id" integer,
	"previous_value" text,
	"next_value" text,
	"previous_state" text,
	"next_state" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_revisions" ADD CONSTRAINT "entity_revisions_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cms_er_entity_id_idx" ON "entity_revisions" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "cms_er_entity_type_name_idx" ON "entity_revisions" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "cms_er_action_idx" ON "entity_revisions" USING btree ("action");