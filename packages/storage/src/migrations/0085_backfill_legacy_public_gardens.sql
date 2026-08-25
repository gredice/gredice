-- Migration 0084 made newly created gardens public by default, but existing
-- rows retained the previous false default. Before that change, false did not
-- prove that an owner had explicitly chosen privacy. Backfill only gardens
-- that predate the public-by-default rollout; later false values are explicit
-- opt-outs and must remain private.
UPDATE "gardens"
SET
    "is_public" = true,
    "updated_at" = now()
WHERE
    "is_public" = false
    AND "is_deleted" = false
    AND "is_sandbox" = false
    AND "created_at" < TIMESTAMP '2026-08-24 21:58:09'
    AND "updated_at" < TIMESTAMP '2026-08-24 21:58:09';
