-- Migration 0084 made newly created gardens public by default, but existing
-- rows retained the previous false default. Backfill only gardens that were
-- created and last updated before the visibility control was introduced in
-- PR 3881. Those owners could not have explicitly selected privacy. Later
-- false values are ambiguous or explicit opt-outs and must remain private.
UPDATE "gardens"
SET
    "is_public" = true,
    "updated_at" = now()
WHERE
    "is_public" = false
    AND "is_deleted" = false
    AND "is_sandbox" = false
    AND "created_at" < TIMESTAMP '2026-07-01 13:07:36'
    AND "updated_at" < TIMESTAMP '2026-07-01 13:07:36';
