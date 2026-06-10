CREATE TABLE "garden_visit_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"garden_id" integer NOT NULL,
	"last_opened_at" timestamp,
	"last_summary_seen_at" timestamp,
	"last_summary_facts_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garden_visit_states" ADD CONSTRAINT "garden_visit_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_visit_states" ADD CONSTRAINT "garden_visit_states_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_visit_states" ADD CONSTRAINT "garden_visit_states_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "garden_visit_states_user_account_garden_unique" ON "garden_visit_states" USING btree ("user_id","account_id","garden_id");--> statement-breakpoint
CREATE INDEX "garden_visit_states_account_garden_idx" ON "garden_visit_states" USING btree ("account_id","garden_id");--> statement-breakpoint
CREATE INDEX "garden_visit_states_garden_id_idx" ON "garden_visit_states" USING btree ("garden_id");