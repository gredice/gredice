CREATE TABLE "ai_account_limit_overrides" (
	"account_id" text PRIMARY KEY NOT NULL,
	"active_daily_limit_micro_usd" integer,
	"trial_daily_limit_micro_usd" integer,
	"trial_chat_days" integer,
	"disabled" boolean DEFAULT false NOT NULL,
	"notes" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"user_id" text NOT NULL,
	"garden_id" integer,
	"raised_bed_id" integer,
	"title" text,
	"model" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"last_message_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"message_id" text,
	"tool_call_id" text,
	"tool_name" text NOT NULL,
	"state" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"needs_approval" boolean DEFAULT false NOT NULL,
	"approved_by_user_id" text,
	"approved_at" timestamp,
	"duration_ms" integer,
	"mcp_correlation_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" text,
	"request_id" text NOT NULL,
	"feature" text DEFAULT 'suncokret-chat' NOT NULL,
	"model" text NOT NULL,
	"provider" text,
	"usage_date" text NOT NULL,
	"status" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"reserved_micro_usd" integer DEFAULT 0 NOT NULL,
	"input_micro_usd" integer DEFAULT 0 NOT NULL,
	"output_micro_usd" integer DEFAULT 0 NOT NULL,
	"total_micro_usd" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finalized_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "ai_account_limit_overrides" ADD CONSTRAINT "ai_account_limit_overrides_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_account_limit_overrides" ADD CONSTRAINT "ai_account_limit_overrides_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_conversations" ADD CONSTRAINT "ai_chat_conversations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_conversations" ADD CONSTRAINT "ai_chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_conversations" ADD CONSTRAINT "ai_chat_conversations_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_conversations" ADD CONSTRAINT "ai_chat_conversations_raised_bed_id_raised_beds_id_fk" FOREIGN KEY ("raised_bed_id") REFERENCES "public"."raised_beds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_conversation_id_ai_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_tool_calls" ADD CONSTRAINT "ai_chat_tool_calls_conversation_id_ai_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_tool_calls" ADD CONSTRAINT "ai_chat_tool_calls_message_id_ai_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ai_chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_tool_calls" ADD CONSTRAINT "ai_chat_tool_calls_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_ledger" ADD CONSTRAINT "ai_usage_ledger_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_ledger" ADD CONSTRAINT "ai_usage_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_ledger" ADD CONSTRAINT "ai_usage_ledger_conversation_id_ai_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_chat_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_account_limit_overrides_disabled_idx" ON "ai_account_limit_overrides" USING btree ("disabled");--> statement-breakpoint
CREATE INDEX "ai_chat_conversations_account_idx" ON "ai_chat_conversations" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "ai_chat_conversations_user_idx" ON "ai_chat_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_chat_conversations_last_message_idx" ON "ai_chat_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "ai_chat_messages_conversation_idx" ON "ai_chat_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ai_chat_messages_created_at_idx" ON "ai_chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_chat_tool_calls_conversation_idx" ON "ai_chat_tool_calls" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ai_chat_tool_calls_tool_name_idx" ON "ai_chat_tool_calls" USING btree ("tool_name");--> statement-breakpoint
CREATE INDEX "ai_chat_tool_calls_created_at_idx" ON "ai_chat_tool_calls" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_ledger_request_unique" ON "ai_usage_ledger" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "ai_usage_ledger_account_date_idx" ON "ai_usage_ledger" USING btree ("account_id","usage_date");--> statement-breakpoint
CREATE INDEX "ai_usage_ledger_conversation_idx" ON "ai_usage_ledger" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ai_usage_ledger_status_idx" ON "ai_usage_ledger" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_usage_ledger_created_at_idx" ON "ai_usage_ledger" USING btree ("created_at");