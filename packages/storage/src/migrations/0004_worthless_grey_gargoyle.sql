CREATE TABLE "web_push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"auth" text NOT NULL,
	"p256dh" text NOT NULL,
	"expiration_time" timestamp,
	"user_agent" text,
	"platform" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "web_push_subscriptions" ADD CONSTRAINT "web_push_subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_push_subscriptions" ADD CONSTRAINT "web_push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "web_push_subscriptions_endpoint_idx" ON "web_push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "web_push_subscriptions_account_id_idx" ON "web_push_subscriptions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "web_push_subscriptions_user_id_idx" ON "web_push_subscriptions" USING btree ("user_id");