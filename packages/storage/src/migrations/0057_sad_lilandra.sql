DROP INDEX "delivery_requests_is_deleted_idx";--> statement-breakpoint
ALTER TABLE "delivery_requests" DROP COLUMN "is_deleted";