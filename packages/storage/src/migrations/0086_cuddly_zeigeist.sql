ALTER TABLE "garden_previews" ADD COLUMN "phase" text DEFAULT 'day' NOT NULL;--> statement-breakpoint
ALTER TABLE "garden_previews" DROP CONSTRAINT "garden_previews_pkey";--> statement-breakpoint
ALTER TABLE "garden_previews" ADD CONSTRAINT "garden_previews_garden_id_phase_pk" PRIMARY KEY("garden_id","phase");
