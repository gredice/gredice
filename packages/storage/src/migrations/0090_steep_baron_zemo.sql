CREATE TABLE "garden_mutation_operations" (
	"garden_id" integer NOT NULL,
	"operation_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "garden_mutation_operations_garden_operation_pk" PRIMARY KEY("garden_id","operation_id"),
	CONSTRAINT "garden_mutation_operations_operation_id_length_check" CHECK (char_length("garden_mutation_operations"."operation_id") between 1 and 96),
	CONSTRAINT "garden_mutation_operations_kind_check" CHECK ("garden_mutation_operations"."kind" in ('block-purchase', 'garden-box-block-place', 'garden-box-block-store', 'gift-open')),
	CONSTRAINT "garden_mutation_operations_payload_hash_check" CHECK ("garden_mutation_operations"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "garden_mutation_operations_response_shape_check" CHECK (jsonb_typeof("garden_mutation_operations"."response") = 'object'),
	CONSTRAINT "garden_mutation_operations_response_size_check" CHECK (octet_length("garden_mutation_operations"."response"::text) <= 262144)
);
--> statement-breakpoint
ALTER TABLE "garden_mutation_operations" ADD CONSTRAINT "garden_mutation_operations_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "garden_mutation_operations_kind_idx" ON "garden_mutation_operations" USING btree ("kind");
