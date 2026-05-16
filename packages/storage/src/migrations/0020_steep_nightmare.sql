CREATE TABLE "inventory_item_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"action" text NOT NULL,
	"previous_quantity" integer,
	"new_quantity" integer,
	"previous_state" text,
	"new_state" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_item_events" ADD CONSTRAINT "inventory_item_events_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inv_item_events_inventory_item_id_idx" ON "inventory_item_events" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "inv_item_events_is_deleted_idx" ON "inventory_item_events" USING btree ("is_deleted");