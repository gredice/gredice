ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_attribute_definition_id_attribute_definitions_id_fk" FOREIGN KEY ("attribute_definition_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_users" ADD CONSTRAINT "account_users_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_users" ADD CONSTRAINT "account_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_logins" ADD CONSTRAINT "user_logins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_blocks" ADD CONSTRAINT "garden_blocks_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_stacks" ADD CONSTRAINT "garden_stacks_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gardens" ADD CONSTRAINT "gardens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gardens" ADD CONSTRAINT "gardens_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cms_adc_entity_type_name_idx" ON "attribute_definition_categories" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "cms_adc_order_idx" ON "attribute_definition_categories" USING btree ("order");--> statement-breakpoint
CREATE INDEX "cms_adc_is_deleted_idx" ON "attribute_definition_categories" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "cms_ad_category_idx" ON "attribute_definitions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "cms_ad_entity_type_name_idx" ON "attribute_definitions" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "cms_ad_order_idx" ON "attribute_definitions" USING btree ("order");--> statement-breakpoint
CREATE INDEX "cms_ad_is_deleted_idx" ON "attribute_definitions" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "cms_av_attribute_definition_id_idx" ON "attribute_values" USING btree ("attribute_definition_id");--> statement-breakpoint
CREATE INDEX "cms_av_entity_type_name_idx" ON "attribute_values" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "cms_av_entity_id_idx" ON "attribute_values" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "cms_av_order_idx" ON "attribute_values" USING btree ("order");--> statement-breakpoint
CREATE INDEX "cms_av_is_deleted_idx" ON "attribute_values" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "cms_e_entity_type_name_idx" ON "entities" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "cms_e_state_idx" ON "entities" USING btree ("state");--> statement-breakpoint
CREATE INDEX "cms_e_is_deleted_idx" ON "entities" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "cms_et_order_idx" ON "entity_types" USING btree ("order");--> statement-breakpoint
CREATE INDEX "cms_et_is_deleted_idx" ON "entity_types" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "users_au_account_id_idx" ON "account_users" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "users_au_user_id_idx" ON "account_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_ul_user_id_idx" ON "user_logins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_ul_login_type_idx" ON "user_logins" USING btree ("login_type");--> statement-breakpoint
CREATE INDEX "users_ul_login_id_idx" ON "user_logins" USING btree ("login_id");--> statement-breakpoint
CREATE INDEX "users_u_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "garden_gb_garden_id_idx" ON "garden_blocks" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "garden_gb_is_deleted_idx" ON "garden_blocks" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "garden_gs_garden_id_idx" ON "garden_stacks" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "garden_gs_is_deleted_idx" ON "garden_stacks" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "garden_g_account_id_idx" ON "gardens" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "garden_g_farm_id_idx" ON "gardens" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "garden_g_is_deleted_idx" ON "gardens" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "farms_f_is_deleted_idx" ON "farms" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "events_e_type_idx" ON "events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "events_e_aggregate_id_idx" ON "events" USING btree ("aggregate_id");--> statement-breakpoint
CREATE INDEX "events_e_created_at_idx" ON "events" USING btree ("created_at");