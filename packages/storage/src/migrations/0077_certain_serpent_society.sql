ALTER TABLE "users" ADD COLUMN "default_garden_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_garden_id_gardens_id_fk" FOREIGN KEY ("default_garden_id") REFERENCES "public"."gardens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_u_default_garden_id_idx" ON "users" USING btree ("default_garden_id");