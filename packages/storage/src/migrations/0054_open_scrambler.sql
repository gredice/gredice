CREATE TABLE "tutorial_checklist_task_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"task_key" text NOT NULL,
	"reward_sunflowers" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tutorial_checklist_task_claims" ADD CONSTRAINT "tutorial_checklist_task_claims_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tutorial_checklist_claims_account_id_idx" ON "tutorial_checklist_task_claims" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "tutorial_checklist_claims_task_key_idx" ON "tutorial_checklist_task_claims" USING btree ("task_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tutorial_checklist_claims_account_task_uq" ON "tutorial_checklist_task_claims" USING btree ("account_id","task_key");