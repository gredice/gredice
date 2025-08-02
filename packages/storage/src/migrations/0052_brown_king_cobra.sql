ALTER TABLE "receipts" DROP CONSTRAINT "receipts_invoice_id_unique";--> statement-breakpoint
ALTER TABLE "receipts" DROP CONSTRAINT "receipts_receipt_number_unique";--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "year_receipt_number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_year_receipt_number_unique" UNIQUE("year_receipt_number");