CREATE TABLE "entity_search_documents" (
	"entity_id" integer PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"public_category" text NOT NULL,
	"public_category_label" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"image_url" text,
	"image_alt" text,
	"searchable_text" text NOT NULL,
	"state" text NOT NULL,
	"published_at" timestamp,
	"updated_at" timestamp NOT NULL,
	"indexed_at" timestamp DEFAULT now() NOT NULL,
	"search_vector" "tsvector" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_search_documents" ADD CONSTRAINT "entity_search_documents_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
WITH "public_search_categories"("entity_type", "public_category", "public_category_label") AS (
	VALUES
		('plant', 'plants', 'Biljke'),
		('operation', 'operations', 'Radnje'),
		('block', 'blocks', 'Blokovi'),
		('plantSort', 'sorts', 'Sorte')
),
"search_attributes" AS (
	SELECT
		"av"."entity_id",
		(array_agg("av"."value" ORDER BY "av"."id") FILTER (WHERE "ad"."category" = 'information' AND "ad"."name" = 'label' AND btrim(coalesce("av"."value", '')) <> ''))[1] AS "label_value",
		(array_agg("av"."value" ORDER BY "av"."id") FILTER (WHERE "ad"."category" = 'information' AND "ad"."name" = 'name' AND btrim(coalesce("av"."value", '')) <> ''))[1] AS "name_value",
		(array_agg("av"."value" ORDER BY "av"."id") FILTER (WHERE "ad"."category" = 'information' AND "ad"."name" = 'shortDescription' AND btrim(coalesce("av"."value", '')) <> ''))[1] AS "short_description_value",
		(array_agg("av"."value" ORDER BY "av"."id") FILTER (WHERE "ad"."category" = 'information' AND "ad"."name" = 'description' AND btrim(coalesce("av"."value", '')) <> ''))[1] AS "description_value",
		(array_agg(substring("av"."value" from '"url"[[:space:]]*:[[:space:]]*"([^"]+)"') ORDER BY CASE WHEN "ad"."category" = 'image' THEN 0 ELSE 1 END, "ad"."name") FILTER (WHERE "ad"."data_type" = 'image' AND substring("av"."value" from '"url"[[:space:]]*:[[:space:]]*"([^"]+)"') IS NOT NULL))[1] AS "image_url",
		(array_agg(substring("av"."value" from '"alt"[[:space:]]*:[[:space:]]*"([^"]+)"') ORDER BY CASE WHEN "ad"."category" = 'image' THEN 0 ELSE 1 END, "ad"."name") FILTER (WHERE "ad"."data_type" = 'image' AND substring("av"."value" from '"url"[[:space:]]*:[[:space:]]*"([^"]+)"') IS NOT NULL))[1] AS "image_alt",
		string_agg("av"."value", ' ' ORDER BY "ad"."category", "ad"."name", "av"."id") FILTER (
			WHERE
				btrim(coalesce("av"."value", '')) <> ''
				AND "ad"."data_type" NOT LIKE 'ref:%'
				AND "ad"."data_type" NOT IN ('image', 'boolean', 'number', 'range')
				AND "ad"."data_type" NOT LIKE 'range|%'
		) AS "body_search_text"
	FROM "attribute_values" "av"
	INNER JOIN "attribute_definitions" "ad" ON "ad"."id" = "av"."attribute_definition_id" AND "ad"."is_deleted" = false
	WHERE "av"."is_deleted" = false
	GROUP BY "av"."entity_id"
),
"documents" AS (
	SELECT
		"e"."id" AS "entity_id",
		"e"."entity_type",
		"c"."public_category",
		"c"."public_category_label",
		coalesce(nullif(btrim("sa"."label_value"), ''), nullif(btrim("sa"."name_value"), ''), "et"."label" || ' ' || "e"."id"::text) AS "title",
		nullif(btrim(concat_ws(' ', nullif(btrim("sa"."short_description_value"), ''), nullif(btrim("sa"."description_value"), ''))), '') AS "summary",
		"sa"."image_url",
		nullif(btrim("sa"."image_alt"), '') AS "image_alt",
		coalesce("sa"."body_search_text", '') AS "body_search_text",
		"e"."state",
		"e"."published_at",
		"e"."updated_at",
		"et"."label" AS "entity_type_label"
	FROM "entities" "e"
	INNER JOIN "entity_types" "et" ON "et"."name" = "e"."entity_type" AND "et"."is_deleted" = false
	INNER JOIN "public_search_categories" "c" ON "c"."entity_type" = "e"."entity_type"
	LEFT JOIN "search_attributes" "sa" ON "sa"."entity_id" = "e"."id"
	WHERE "e"."is_deleted" = false AND "e"."state" = 'published' AND "e"."published_at" IS NOT NULL
)
INSERT INTO "entity_search_documents" (
	"entity_id",
	"entity_type",
	"public_category",
	"public_category_label",
	"title",
	"summary",
	"image_url",
	"image_alt",
	"searchable_text",
	"state",
	"published_at",
	"updated_at",
	"search_vector"
)
SELECT
	"entity_id",
	"entity_type",
	"public_category",
	"public_category_label",
	"title",
	"summary",
	"image_url",
	"image_alt",
	concat_ws(' ', "title", "summary", "body_search_text"),
	"state",
	"published_at",
	"updated_at",
	setweight(to_tsvector('simple', regexp_replace(translate(lower("title"), 'čćžšđ', 'cczsd'), '\s+', ' ', 'g')), 'A') ||
	setweight(to_tsvector('simple', regexp_replace(translate(lower(concat_ws(' ', "summary", "entity_type_label", "public_category_label")), 'čćžšđ', 'cczsd'), '\s+', ' ', 'g')), 'B') ||
	setweight(to_tsvector('simple', regexp_replace(translate(lower("body_search_text"), 'čćžšđ', 'cczsd'), '\s+', ' ', 'g')), 'C')
FROM "documents";--> statement-breakpoint
CREATE INDEX "cms_esd_entity_type_idx" ON "entity_search_documents" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "cms_esd_public_category_idx" ON "entity_search_documents" USING btree ("public_category");--> statement-breakpoint
CREATE INDEX "cms_esd_state_idx" ON "entity_search_documents" USING btree ("state");--> statement-breakpoint
CREATE INDEX "cms_esd_published_at_idx" ON "entity_search_documents" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "cms_esd_search_vector_idx" ON "entity_search_documents" USING gin ("search_vector");
