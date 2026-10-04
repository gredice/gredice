CREATE TABLE "weather_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"symbol" integer,
	"temperature" real,
	"rain" real DEFAULT 0 NOT NULL,
	"wind_direction" text,
	"wind_speed" real DEFAULT 0 NOT NULL,
	"rainy" real DEFAULT 0 NOT NULL,
	"snowy" real DEFAULT 0 NOT NULL,
	"cloudy" real DEFAULT 0 NOT NULL,
	"foggy" real DEFAULT 0 NOT NULL,
	"thundery" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "weather_history_recorded_at_idx" ON "weather_history" USING btree ("recorded_at");