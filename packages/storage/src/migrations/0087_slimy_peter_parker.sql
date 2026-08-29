CREATE TABLE "delivery_native_authorization_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text NOT NULL,
	"code_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "delivery_native_refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"session_family_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"generation" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"replaced_by_token_id" text
);
--> statement-breakpoint
CREATE TABLE "delivery_native_session_families" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"client_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"revocation_reason" text
);
--> statement-breakpoint
ALTER TABLE "delivery_native_authorization_grants" ADD CONSTRAINT "delivery_native_authorization_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_native_authorization_grants" ADD CONSTRAINT "delivery_native_authorization_grants_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_native_refresh_tokens" ADD CONSTRAINT "delivery_native_refresh_tokens_session_family_id_delivery_native_session_families_id_fk" FOREIGN KEY ("session_family_id") REFERENCES "public"."delivery_native_session_families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_native_session_families" ADD CONSTRAINT "delivery_native_session_families_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_native_session_families" ADD CONSTRAINT "delivery_native_session_families_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_native_grants_code_hash_idx" ON "delivery_native_authorization_grants" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "delivery_native_grants_user_id_idx" ON "delivery_native_authorization_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "delivery_native_grants_expires_at_idx" ON "delivery_native_authorization_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_native_refresh_tokens_hash_idx" ON "delivery_native_refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "delivery_native_refresh_tokens_family_id_idx" ON "delivery_native_refresh_tokens" USING btree ("session_family_id");--> statement-breakpoint
CREATE INDEX "delivery_native_refresh_tokens_expires_at_idx" ON "delivery_native_refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "delivery_native_session_families_user_id_idx" ON "delivery_native_session_families" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "delivery_native_session_families_expires_at_idx" ON "delivery_native_session_families" USING btree ("expires_at");