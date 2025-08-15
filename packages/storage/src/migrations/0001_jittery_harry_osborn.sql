CREATE TABLE "delivery_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"label" text NOT NULL,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"street1" text NOT NULL,
	"street2" text,
	"city" text NOT NULL,
	"postal_code" text NOT NULL,
	"country_code" text DEFAULT 'HR' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"operation_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pickup_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"street1" text NOT NULL,
	"street2" text,
	"city" text NOT NULL,
	"postal_code" text NOT NULL,
	"country_code" text DEFAULT 'HR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"type" text NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attribute_values" DROP CONSTRAINT "attribute_values_attribute_definition_id_attribute_definitions_";
--> statement-breakpoint
DROP INDEX "cms_ad_category_idx";--> statement-breakpoint
DROP INDEX "cms_ad_entity_type_name_idx";--> statement-breakpoint
DROP INDEX "cms_ad_is_deleted_idx";--> statement-breakpoint
DROP INDEX "cms_ad_order_idx";--> statement-breakpoint
DROP INDEX "cms_adc_entity_type_name_idx";--> statement-breakpoint
DROP INDEX "cms_adc_is_deleted_idx";--> statement-breakpoint
DROP INDEX "cms_adc_order_idx";--> statement-breakpoint
DROP INDEX "users_ul_login_id_idx";--> statement-breakpoint
DROP INDEX "users_ul_login_type_idx";--> statement-breakpoint
DROP INDEX "users_ul_user_id_idx";--> statement-breakpoint
DROP INDEX "cms_et_category_id_idx";--> statement-breakpoint
DROP INDEX "cms_et_is_deleted_idx";--> statement-breakpoint
DROP INDEX "cms_et_order_idx";--> statement-breakpoint
DROP INDEX "cms_av_attribute_definition_id_idx";--> statement-breakpoint
DROP INDEX "cms_av_entity_id_idx";--> statement-breakpoint
DROP INDEX "cms_av_entity_type_name_idx";--> statement-breakpoint
DROP INDEX "cms_av_is_deleted_idx";--> statement-breakpoint
DROP INDEX "cms_av_order_idx";--> statement-breakpoint
DROP INDEX "cms_e_entity_type_name_idx";--> statement-breakpoint
DROP INDEX "cms_e_is_deleted_idx";--> statement-breakpoint
DROP INDEX "cms_e_state_idx";--> statement-breakpoint
DROP INDEX "users_au_account_id_idx";--> statement-breakpoint
DROP INDEX "users_au_user_id_idx";--> statement-breakpoint
DROP INDEX "garden_gb_garden_id_idx";--> statement-breakpoint
DROP INDEX "garden_gb_is_deleted_idx";--> statement-breakpoint
DROP INDEX "events_e_aggregate_id_idx";--> statement-breakpoint
DROP INDEX "events_e_created_at_idx";--> statement-breakpoint
DROP INDEX "events_e_type_idx";--> statement-breakpoint
DROP INDEX "users_u_username_idx";--> statement-breakpoint
DROP INDEX "garden_gs_garden_id_idx";--> statement-breakpoint
DROP INDEX "garden_gs_is_deleted_idx";--> statement-breakpoint
DROP INDEX "farms_f_is_deleted_idx";--> statement-breakpoint
DROP INDEX "garden_g_account_id_idx";--> statement-breakpoint
DROP INDEX "garden_g_farm_id_idx";--> statement-breakpoint
DROP INDEX "garden_g_is_deleted_idx";--> statement-breakpoint
DROP INDEX "raised_beds_account_id_idx";--> statement-breakpoint
DROP INDEX "raised_beds_block_id_idx";--> statement-breakpoint
DROP INDEX "raised_beds_garden_id_idx";--> statement-breakpoint
DROP INDEX "raised_beds_is_deleted_idx";--> statement-breakpoint
DROP INDEX "transactions_account_id_idx";--> statement-breakpoint
DROP INDEX "transactions_garden_id_idx";--> statement-breakpoint
DROP INDEX "transactions_is_deleted_idx";--> statement-breakpoint
DROP INDEX "transactions_stripe_payment_id_idx";--> statement-breakpoint
DROP INDEX "notifications_account_id_idx";--> statement-breakpoint
DROP INDEX "notifications_created_at_idx";--> statement-breakpoint
DROP INDEX "notifications_readAt_idx";--> statement-breakpoint
DROP INDEX "notifications_user_id_idx";--> statement-breakpoint
DROP INDEX "shopping_cart_items_cart_id_idx";--> statement-breakpoint
DROP INDEX "shopping_cart_items_entity_id_idx";--> statement-breakpoint
DROP INDEX "shopping_cart_items_garden_id_idx";--> statement-breakpoint
DROP INDEX "shopping_cart_items_is_deleted_idx";--> statement-breakpoint
DROP INDEX "shopping_cart_items_raised_bed_id_idx";--> statement-breakpoint
DROP INDEX "shopping_cart_items_status_idx";--> statement-breakpoint
DROP INDEX "shopping_carts_account_id_idx";--> statement-breakpoint
DROP INDEX "shopping_carts_is_deleted_idx";--> statement-breakpoint
DROP INDEX "shopping_carts_status_idx";--> statement-breakpoint
DROP INDEX "raised_bed_fields_is_deleted_idx";--> statement-breakpoint
DROP INDEX "raised_bed_fields_raised_bed_id_idx";--> statement-breakpoint
DROP INDEX "raised_bed_sensors_is_deleted_idx";--> statement-breakpoint
DROP INDEX "raised_bed_sensors_raised_bed_id_idx";--> statement-breakpoint
DROP INDEX "operations_account_id_idx";--> statement-breakpoint
DROP INDEX "operations_entity_id_idx";--> statement-breakpoint
DROP INDEX "operations_entity_type_name_idx";--> statement-breakpoint
DROP INDEX "operations_garden_id_idx";--> statement-breakpoint
DROP INDEX "operations_is_deleted_idx";--> statement-breakpoint
DROP INDEX "operations_raised_bed_field_id_idx";--> statement-breakpoint
DROP INDEX "operations_raised_bed_id_idx";--> statement-breakpoint
DROP INDEX "operations_timestamp_idx";--> statement-breakpoint
DROP INDEX "invoices_account_id_idx";--> statement-breakpoint
DROP INDEX "invoices_due_date_idx";--> statement-breakpoint
DROP INDEX "invoices_invoice_number_idx";--> statement-breakpoint
DROP INDEX "invoices_is_deleted_idx";--> statement-breakpoint
DROP INDEX "invoices_issue_date_idx";--> statement-breakpoint
DROP INDEX "invoices_status_idx";--> statement-breakpoint
DROP INDEX "invoices_transaction_id_idx";--> statement-breakpoint
DROP INDEX "invoice_items_entity_id_idx";--> statement-breakpoint
DROP INDEX "invoice_items_entity_type_idx";--> statement-breakpoint
DROP INDEX "invoice_items_invoice_id_idx";--> statement-breakpoint
DROP INDEX "fiscalization_pos_settings_is_active_idx";--> statement-breakpoint
DROP INDEX "fiscalization_pos_settings_is_deleted_idx";--> statement-breakpoint
DROP INDEX "fiscalization_pos_settings_pos_id_idx";--> statement-breakpoint
DROP INDEX "fiscalization_user_settings_is_active_idx";--> statement-breakpoint
DROP INDEX "fiscalization_user_settings_is_deleted_idx";--> statement-breakpoint
DROP INDEX "receipts_business_pin_idx";--> statement-breakpoint
DROP INDEX "receipts_cis_status_idx";--> statement-breakpoint
DROP INDEX "receipts_invoice_id_idx";--> statement-breakpoint
DROP INDEX "receipts_is_deleted_idx";--> statement-breakpoint
DROP INDEX "receipts_issued_at_idx";--> statement-breakpoint
DROP INDEX "receipts_jir_idx";--> statement-breakpoint
DROP INDEX "receipts_receipt_number_idx";--> statement-breakpoint
DROP INDEX "receipts_zki_idx";--> statement-breakpoint
DROP INDEX "cms_etc_is_deleted_idx";--> statement-breakpoint
DROP INDEX "cms_etc_order_idx";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "garden_stacks" ALTER COLUMN "blocks" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "shopping_cart_items" ALTER COLUMN "additional_data" SET DEFAULT null;--> statement-breakpoint
ALTER TABLE "delivery_addresses" ADD CONSTRAINT "delivery_addresses_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_location_id_pickup_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."pickup_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_addresses_account_id_idx" ON "delivery_addresses" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "delivery_addresses_is_default_idx" ON "delivery_addresses" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "delivery_addresses_deleted_at_idx" ON "delivery_addresses" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "delivery_requests_operation_id_idx" ON "delivery_requests" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "delivery_requests_created_at_idx" ON "delivery_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pickup_locations_is_active_idx" ON "pickup_locations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "time_slots_location_id_idx" ON "time_slots" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "time_slots_type_idx" ON "time_slots" USING btree ("type");--> statement-breakpoint
CREATE INDEX "time_slots_start_at_idx" ON "time_slots" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "time_slots_status_idx" ON "time_slots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "time_slots_unique_slot_idx" ON "time_slots" USING btree ("location_id","type","start_at");--> statement-breakpoint
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_attribute_definition_id_attribute_definitions_id_fk" FOREIGN KEY ("attribute_definition_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cms_ad_category_idx" ON "attribute_definitions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "cms_ad_entity_type_name_idx" ON "attribute_definitions" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "cms_ad_is_deleted_idx" ON "attribute_definitions" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "cms_ad_order_idx" ON "attribute_definitions" USING btree ("order");--> statement-breakpoint
CREATE INDEX "cms_adc_entity_type_name_idx" ON "attribute_definition_categories" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "cms_adc_is_deleted_idx" ON "attribute_definition_categories" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "cms_adc_order_idx" ON "attribute_definition_categories" USING btree ("order");--> statement-breakpoint
CREATE INDEX "users_ul_login_id_idx" ON "user_logins" USING btree ("login_id");--> statement-breakpoint
CREATE INDEX "users_ul_login_type_idx" ON "user_logins" USING btree ("login_type");--> statement-breakpoint
CREATE INDEX "users_ul_user_id_idx" ON "user_logins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cms_et_category_id_idx" ON "entity_types" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "cms_et_is_deleted_idx" ON "entity_types" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "cms_et_order_idx" ON "entity_types" USING btree ("order");--> statement-breakpoint
CREATE INDEX "cms_av_attribute_definition_id_idx" ON "attribute_values" USING btree ("attribute_definition_id");--> statement-breakpoint
CREATE INDEX "cms_av_entity_id_idx" ON "attribute_values" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "cms_av_entity_type_name_idx" ON "attribute_values" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "cms_av_is_deleted_idx" ON "attribute_values" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "cms_av_order_idx" ON "attribute_values" USING btree ("order");--> statement-breakpoint
CREATE INDEX "cms_e_entity_type_name_idx" ON "entities" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "cms_e_is_deleted_idx" ON "entities" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "cms_e_state_idx" ON "entities" USING btree ("state");--> statement-breakpoint
CREATE INDEX "users_au_account_id_idx" ON "account_users" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "users_au_user_id_idx" ON "account_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "garden_gb_garden_id_idx" ON "garden_blocks" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "garden_gb_is_deleted_idx" ON "garden_blocks" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "events_e_aggregate_id_idx" ON "events" USING btree ("aggregate_id");--> statement-breakpoint
CREATE INDEX "events_e_created_at_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_e_type_idx" ON "events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "users_u_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "garden_gs_garden_id_idx" ON "garden_stacks" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "garden_gs_is_deleted_idx" ON "garden_stacks" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "farms_f_is_deleted_idx" ON "farms" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "garden_g_account_id_idx" ON "gardens" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "garden_g_farm_id_idx" ON "gardens" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "garden_g_is_deleted_idx" ON "gardens" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "raised_beds_account_id_idx" ON "raised_beds" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "raised_beds_block_id_idx" ON "raised_beds" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "raised_beds_garden_id_idx" ON "raised_beds" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "raised_beds_is_deleted_idx" ON "raised_beds" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "transactions_account_id_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_garden_id_idx" ON "transactions" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "transactions_is_deleted_idx" ON "transactions" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "transactions_stripe_payment_id_idx" ON "transactions" USING btree ("stripe_payment_id");--> statement-breakpoint
CREATE INDEX "notifications_account_id_idx" ON "notifications" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_readAt_idx" ON "notifications" USING btree ("read_at");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shopping_cart_items_cart_id_idx" ON "shopping_cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "shopping_cart_items_entity_id_idx" ON "shopping_cart_items" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "shopping_cart_items_garden_id_idx" ON "shopping_cart_items" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "shopping_cart_items_is_deleted_idx" ON "shopping_cart_items" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "shopping_cart_items_raised_bed_id_idx" ON "shopping_cart_items" USING btree ("raised_bed_id");--> statement-breakpoint
CREATE INDEX "shopping_cart_items_status_idx" ON "shopping_cart_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shopping_carts_account_id_idx" ON "shopping_carts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "shopping_carts_is_deleted_idx" ON "shopping_carts" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "shopping_carts_status_idx" ON "shopping_carts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "raised_bed_fields_is_deleted_idx" ON "raised_bed_fields" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "raised_bed_fields_raised_bed_id_idx" ON "raised_bed_fields" USING btree ("raised_bed_id");--> statement-breakpoint
CREATE INDEX "raised_bed_sensors_is_deleted_idx" ON "raised_bed_sensors" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "raised_bed_sensors_raised_bed_id_idx" ON "raised_bed_sensors" USING btree ("raised_bed_id");--> statement-breakpoint
CREATE INDEX "operations_account_id_idx" ON "operations" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "operations_entity_id_idx" ON "operations" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "operations_entity_type_name_idx" ON "operations" USING btree ("entity_type_name");--> statement-breakpoint
CREATE INDEX "operations_garden_id_idx" ON "operations" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "operations_is_deleted_idx" ON "operations" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "operations_raised_bed_field_id_idx" ON "operations" USING btree ("raised_bed_field_id");--> statement-breakpoint
CREATE INDEX "operations_raised_bed_id_idx" ON "operations" USING btree ("raised_bed_id");--> statement-breakpoint
CREATE INDEX "operations_timestamp_idx" ON "operations" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "invoices_account_id_idx" ON "invoices" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "invoices_invoice_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_is_deleted_idx" ON "invoices" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "invoices_issue_date_idx" ON "invoices" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_transaction_id_idx" ON "invoices" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "invoice_items_entity_id_idx" ON "invoice_items" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "invoice_items_entity_type_idx" ON "invoice_items" USING btree ("entity_type_name");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "fiscalization_pos_settings_is_active_idx" ON "fiscalization_pos_settings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "fiscalization_pos_settings_is_deleted_idx" ON "fiscalization_pos_settings" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "fiscalization_pos_settings_pos_id_idx" ON "fiscalization_pos_settings" USING btree ("pos_id");--> statement-breakpoint
CREATE INDEX "fiscalization_user_settings_is_active_idx" ON "fiscalization_user_settings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "fiscalization_user_settings_is_deleted_idx" ON "fiscalization_user_settings" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "receipts_business_pin_idx" ON "receipts" USING btree ("business_pin");--> statement-breakpoint
CREATE INDEX "receipts_cis_status_idx" ON "receipts" USING btree ("cis_status");--> statement-breakpoint
CREATE INDEX "receipts_invoice_id_idx" ON "receipts" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "receipts_is_deleted_idx" ON "receipts" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "receipts_issued_at_idx" ON "receipts" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "receipts_jir_idx" ON "receipts" USING btree ("jir");--> statement-breakpoint
CREATE INDEX "receipts_receipt_number_idx" ON "receipts" USING btree ("receipt_number");--> statement-breakpoint
CREATE INDEX "receipts_zki_idx" ON "receipts" USING btree ("zki");--> statement-breakpoint
CREATE INDEX "cms_etc_is_deleted_idx" ON "entity_type_categories" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "cms_etc_order_idx" ON "entity_type_categories" USING btree ("order");