CREATE TABLE "invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1.00' NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"entity_id" text,
	"entity_type_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"account_id" text NOT NULL,
	"transaction_id" integer,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"bill_to_name" text,
	"bill_to_email" text NOT NULL,
	"bill_to_address" text,
	"bill_to_city" text,
	"bill_to_state" text,
	"bill_to_zip" text,
	"bill_to_country" text,
	"notes" text,
	"terms" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"receipt_number" text NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax_amount" numeric(10, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" text NOT NULL,
	"payment_method" text NOT NULL,
	"payment_reference" text,
	"jir" text,
	"zki" text,
	"cis_status" text DEFAULT 'pending' NOT NULL,
	"cis_reference" text,
	"cis_error_message" text,
	"cis_timestamp" timestamp,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"business_pin" text,
	"business_name" text,
	"business_address" text,
	"customer_pin" text,
	"customer_name" text,
	"customer_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "receipts_invoice_id_unique" UNIQUE("invoice_id"),
	CONSTRAINT "receipts_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_items_entity_id_idx" ON "invoice_items" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "invoice_items_entity_type_idx" ON "invoice_items" USING btree ("entity_type_name");--> statement-breakpoint
CREATE INDEX "invoices_invoice_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_account_id_idx" ON "invoices" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "invoices_transaction_id_idx" ON "invoices" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_issue_date_idx" ON "invoices" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "invoices_is_deleted_idx" ON "invoices" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "receipts_invoice_id_idx" ON "receipts" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "receipts_receipt_number_idx" ON "receipts" USING btree ("receipt_number");--> statement-breakpoint
CREATE INDEX "receipts_jir_idx" ON "receipts" USING btree ("jir");--> statement-breakpoint
CREATE INDEX "receipts_zki_idx" ON "receipts" USING btree ("zki");--> statement-breakpoint
CREATE INDEX "receipts_cis_status_idx" ON "receipts" USING btree ("cis_status");--> statement-breakpoint
CREATE INDEX "receipts_issued_at_idx" ON "receipts" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "receipts_business_pin_idx" ON "receipts" USING btree ("business_pin");--> statement-breakpoint
CREATE INDEX "receipts_is_deleted_idx" ON "receipts" USING btree ("is_deleted");