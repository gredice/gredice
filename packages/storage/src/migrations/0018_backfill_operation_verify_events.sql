-- Backfill operation.verify events for historically completed operations
-- that were completed before the verify step was introduced.
-- Without this, those operations appear as 'pendingVerification' indefinitely.
INSERT INTO events (type, version, aggregate_id, data, created_at)
SELECT
    'operation.verify',
    1,
    c.aggregate_id,
    jsonb_build_object('verifiedBy', 'system-migration'),
    c.created_at + interval '1 second'
FROM events c
WHERE c.type = 'operation.complete'
  AND NOT EXISTS (
      SELECT 1
      FROM events v
      WHERE v.type = 'operation.verify'
        AND v.aggregate_id = c.aggregate_id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM events f
      WHERE f.type IN ('operation.fail', 'operation.cancel')
        AND f.aggregate_id = c.aggregate_id
  );
