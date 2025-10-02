CREATE TABLE "farm_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farm_users" ADD CONSTRAINT "farm_users_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_users" ADD CONSTRAINT "farm_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "farm_users_farm_id_idx" ON "farm_users" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "farm_users_user_id_idx" ON "farm_users" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "farm_users_farm_user_unique" ON "farm_users" USING btree ("farm_id","user_id");