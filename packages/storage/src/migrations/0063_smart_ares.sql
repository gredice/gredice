CREATE TABLE "garden_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"garden_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garden_likes" ADD CONSTRAINT "garden_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_likes" ADD CONSTRAINT "garden_likes_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "garden_likes_user_garden_uq" ON "garden_likes" USING btree ("user_id","garden_id");--> statement-breakpoint
CREATE INDEX "garden_likes_user_id_idx" ON "garden_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "garden_likes_garden_id_idx" ON "garden_likes" USING btree ("garden_id");