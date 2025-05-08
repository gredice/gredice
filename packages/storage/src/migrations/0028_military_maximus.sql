CREATE TABLE "raised_beds" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"garden_id" integer NOT NULL,
	"block_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer NOT NULL,
	"entity_type_name" text NOT NULL,
	"entity_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"garden_id" integer,
	"stripe_payment_id" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_id" integer NOT NULL,
	"entity_id" text NOT NULL,
	"entity_type_name" text NOT NULL,
	"garden_id" integer,
	"raised_bed_id" integer,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_carts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "address_street1" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "address_street2" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "address_city" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "address_zip" text;--> statement-breakpoint
ALTER TABLE "raised_beds" ADD CONSTRAINT "raised_beds_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raised_beds" ADD CONSTRAINT "raised_beds_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raised_beds" ADD CONSTRAINT "raised_beds_block_id_garden_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."garden_blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_entities" ADD CONSTRAINT "transaction_entities_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_cart_items" ADD CONSTRAINT "shopping_cart_items_cart_id_shopping_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."shopping_carts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_cart_items" ADD CONSTRAINT "shopping_cart_items_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_cart_items" ADD CONSTRAINT "shopping_cart_items_raised_bed_id_raised_beds_id_fk" FOREIGN KEY ("raised_bed_id") REFERENCES "public"."raised_beds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_carts" ADD CONSTRAINT "shopping_carts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "raised_beds_account_id_idx" ON "raised_beds" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "raised_beds_garden_id_idx" ON "raised_beds" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "raised_beds_block_id_idx" ON "raised_beds" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "raised_beds_is_deleted_idx" ON "raised_beds" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "transaction_entities_transaction_id_idx" ON "transaction_entities" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "transaction_entities_entity_type_name_idx" ON "transaction_entities" USING btree ("entity_type_name");--> statement-breakpoint
CREATE INDEX "transactions_account_id_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_garden_id_idx" ON "transactions" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "transactions_stripe_payment_id_idx" ON "transactions" USING btree ("stripe_payment_id");--> statement-breakpoint
CREATE INDEX "transactions_is_deleted_idx" ON "transactions" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "shopping_cart_items_cart_id_idx" ON "shopping_cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "shopping_cart_items_entity_id_idx" ON "shopping_cart_items" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "shopping_cart_items_garden_id_idx" ON "shopping_cart_items" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "shopping_cart_items_raised_bed_id_idx" ON "shopping_cart_items" USING btree ("raised_bed_id");--> statement-breakpoint
CREATE INDEX "shopping_cart_items_is_deleted_idx" ON "shopping_cart_items" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "shopping_carts_account_id_idx" ON "shopping_carts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "shopping_carts_expires_at_idx" ON "shopping_carts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "shopping_carts_is_deleted_idx" ON "shopping_carts" USING btree ("is_deleted");