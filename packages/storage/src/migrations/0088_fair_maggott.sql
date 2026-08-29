ALTER TABLE "delivery_native_authorization_grants" DROP CONSTRAINT "delivery_native_authorization_grants_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_native_authorization_grants" DROP CONSTRAINT "delivery_native_authorization_grants_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_native_refresh_tokens" DROP CONSTRAINT "delivery_native_refresh_tokens_session_family_id_delivery_native_session_families_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_native_session_families" DROP CONSTRAINT "delivery_native_session_families_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_native_session_families" DROP CONSTRAINT "delivery_native_session_families_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_native_authorization_grants" ADD CONSTRAINT "delivery_native_authorization_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_native_authorization_grants" ADD CONSTRAINT "delivery_native_authorization_grants_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_native_refresh_tokens" ADD CONSTRAINT "delivery_native_refresh_tokens_session_family_id_delivery_native_session_families_id_fk" FOREIGN KEY ("session_family_id") REFERENCES "public"."delivery_native_session_families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_native_session_families" ADD CONSTRAINT "delivery_native_session_families_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_native_session_families" ADD CONSTRAINT "delivery_native_session_families_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;