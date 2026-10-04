CREATE TABLE "sunflower_ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"entry_type" text NOT NULL,
	"amount" integer NOT NULL,
	"available_delta" integer NOT NULL,
	"reserved_delta" integer NOT NULL,
	"available_balance_after" integer NOT NULL,
	"reserved_balance_after" integer NOT NULL,
	"total_balance_after" integer NOT NULL,
	"amount_eur" numeric(10, 2),
	"currency" text DEFAULT 'sunflower' NOT NULL,
	"package_code" text,
	"package_entity_id" integer,
	"operation_id" integer,
	"transaction_id" integer,
	"invoice_id" integer,
	"receipt_id" integer,
	"reservation_key" text,
	"source_type" text,
	"source_id" text,
	"reason" text,
	"actor_id" text,
	"metadata" jsonb,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sunflower_ledger_entries" ADD CONSTRAINT "sunflower_ledger_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sunflower_ledger_entries" ADD CONSTRAINT "sunflower_ledger_entries_package_entity_id_entities_id_fk" FOREIGN KEY ("package_entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sunflower_ledger_entries" ADD CONSTRAINT "sunflower_ledger_entries_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sunflower_ledger_entries" ADD CONSTRAINT "sunflower_ledger_entries_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sunflower_ledger_entries" ADD CONSTRAINT "sunflower_ledger_entries_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sunflower_ledger_entries" ADD CONSTRAINT "sunflower_ledger_entries_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sunflower_ledger_account_id_idx" ON "sunflower_ledger_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sunflower_ledger_entry_type_idx" ON "sunflower_ledger_entries" USING btree ("entry_type");--> statement-breakpoint
CREATE INDEX "sunflower_ledger_package_code_idx" ON "sunflower_ledger_entries" USING btree ("package_code");--> statement-breakpoint
CREATE INDEX "sunflower_ledger_package_entity_id_idx" ON "sunflower_ledger_entries" USING btree ("package_entity_id");--> statement-breakpoint
CREATE INDEX "sunflower_ledger_operation_id_idx" ON "sunflower_ledger_entries" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "sunflower_ledger_transaction_id_idx" ON "sunflower_ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "sunflower_ledger_invoice_id_idx" ON "sunflower_ledger_entries" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "sunflower_ledger_receipt_id_idx" ON "sunflower_ledger_entries" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "sunflower_ledger_reservation_key_idx" ON "sunflower_ledger_entries" USING btree ("reservation_key");--> statement-breakpoint
CREATE INDEX "sunflower_ledger_source_idx" ON "sunflower_ledger_entries" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "sunflower_ledger_created_at_idx" ON "sunflower_ledger_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sunflower_ledger_is_deleted_idx" ON "sunflower_ledger_entries" USING btree ("is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "sunflower_ledger_account_idempotency_unique" ON "sunflower_ledger_entries" USING btree ("account_id","idempotency_key");