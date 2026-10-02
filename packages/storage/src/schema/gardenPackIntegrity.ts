/**
 * Source-owned PostgreSQL guards that Drizzle cannot express as table checks.
 * Maintainers append this SQL to the reviewed, ordered deployment migration.
 * Tests install the SAME guards against DDL generated from the Drizzle source.
 * This module neither executes SQL nor creates/applies a migration on import.
 */
export const gardenPackIntegritySql = `
CREATE FUNCTION garden_pack_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Garden pack history is immutable'; END IF;
  IF TG_TABLE_NAME = 'garden_pack_product_versions' THEN
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN RAISE EXCEPTION 'Garden pack product version is immutable'; END IF;
  ELSIF TG_TABLE_NAME IN ('garden_pack_purchases', 'garden_pack_unit_events') THEN
    IF (to_jsonb(NEW) - 'account_id') IS DISTINCT FROM (to_jsonb(OLD) - 'account_id') OR
       (NEW.account_id IS DISTINCT FROM OLD.account_id AND NOT (OLD.account_id IS NOT NULL AND NEW.account_id IS NULL)) THEN
      RAISE EXCEPTION 'Garden pack purchase snapshot is immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'garden_pack_units' THEN
    IF ROW(NEW.purchase_id, NEW.line_id, NEW.unit_ordinal, NEW.paid_sunflowers, NEW.recycling_sunflowers)
       IS DISTINCT FROM ROW(OLD.purchase_id, OLD.line_id, OLD.unit_ordinal, OLD.paid_sunflowers, OLD.recycling_sunflowers) THEN
      RAISE EXCEPTION 'Garden pack unit allocation is immutable';
    END IF;
  ELSE RAISE EXCEPTION 'Garden pack audit is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER garden_pack_version_immutable BEFORE UPDATE OR DELETE ON garden_pack_product_versions FOR EACH ROW EXECUTE FUNCTION garden_pack_immutable();
CREATE TRIGGER garden_pack_purchase_immutable BEFORE UPDATE OR DELETE ON garden_pack_purchases FOR EACH ROW EXECUTE FUNCTION garden_pack_immutable();
CREATE TRIGGER garden_pack_unit_immutable BEFORE UPDATE OR DELETE ON garden_pack_units FOR EACH ROW EXECUTE FUNCTION garden_pack_immutable();
CREATE TRIGGER garden_pack_event_immutable BEFORE UPDATE OR DELETE ON garden_pack_unit_events FOR EACH ROW EXECUTE FUNCTION garden_pack_immutable();

CREATE FUNCTION garden_pack_validate_contents() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchase garden_pack_purchases%ROWTYPE; target_id text; expected_count integer; actual_count integer; allocated bigint;
BEGIN
  IF TG_TABLE_NAME = 'garden_pack_purchases' THEN target_id := NEW.id; ELSE target_id := NEW.purchase_id; END IF;
  SELECT * INTO purchase FROM garden_pack_purchases WHERE id = target_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Garden pack purchase missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM garden_pack_product_versions WHERE id = purchase.product_version_id AND snapshot = purchase.snapshot) THEN
    RAISE EXCEPTION 'Garden pack product version snapshot mismatch';
  END IF;
  IF jsonb_typeof(purchase.snapshot->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(purchase.snapshot->'lines') NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid garden pack lines';
  END IF;
  SELECT sum((line->>'quantity')::integer) INTO expected_count FROM jsonb_array_elements(purchase.snapshot->'lines') line;
  IF expected_count IS NULL OR expected_count NOT BETWEEN 1 AND 1000 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(purchase.snapshot->'lines') line WHERE
      (jsonb_typeof(line) = 'object' AND jsonb_typeof(line->'quantity') = 'number' AND
      (line->>'quantity')::integer BETWEEN 1 AND 1000 AND jsonb_typeof(line->'paidSunflowersByUnit') = 'array' AND
      jsonb_typeof(line->'recyclingSunflowersByUnit') = 'array' AND
      jsonb_array_length(line->'paidSunflowersByUnit') = (line->>'quantity')::integer AND
      jsonb_array_length(line->'recyclingSunflowersByUnit') = (line->>'quantity')::integer) IS NOT TRUE
  ) OR (SELECT count(DISTINCT line->>'lineId') FROM jsonb_array_elements(purchase.snapshot->'lines') line) <> jsonb_array_length(purchase.snapshot->'lines') THEN
    RAISE EXCEPTION 'Invalid garden pack quantities or identities';
  END IF;
  SELECT count(*), coalesce(sum(paid_sunflowers), 0) INTO actual_count, allocated FROM garden_pack_units WHERE purchase_id = target_id;
  IF actual_count <> expected_count OR allocated <> purchase.charged_sunflowers OR EXISTS (
    SELECT 1 FROM garden_pack_units u WHERE u.purchase_id = target_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(purchase.snapshot->'lines') line WHERE
        line->>'lineId' = u.line_id AND u.unit_ordinal <= (line->>'quantity')::integer AND
        (line->'paidSunflowersByUnit'->>(u.unit_ordinal - 1))::integer = u.paid_sunflowers AND
        (line->'recyclingSunflowersByUnit'->>(u.unit_ordinal - 1))::integer = u.recycling_sunflowers
    )
  ) THEN RAISE EXCEPTION 'Garden pack contents or paid allocation mismatch'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER garden_pack_purchase_contents AFTER INSERT ON garden_pack_purchases DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_pack_validate_contents();
CREATE CONSTRAINT TRIGGER garden_pack_unit_contents AFTER INSERT ON garden_pack_units DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_pack_validate_contents();

CREATE FUNCTION garden_pack_validate_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE unit garden_pack_units%ROWTYPE;
BEGIN
  PERFORM 1 FROM garden_pack_purchases WHERE id = NEW.purchase_id AND account_id = NEW.account_id AND account_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Garden pack has no active owner'; END IF;
  SELECT * INTO unit FROM garden_pack_units WHERE purchase_id = NEW.purchase_id AND line_id = NEW.line_id AND unit_ordinal = NEW.unit_ordinal FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Garden pack unit missing'; END IF;
  IF NEW.kind IN ('placed', 'refunded') AND unit.state <> 'available' OR NEW.kind = 'recycled' AND unit.state <> 'placed' THEN
    RAISE EXCEPTION 'Invalid garden pack transition';
  END IF;
  IF (NEW.kind IN ('placed', 'refunded') AND EXISTS (
    SELECT 1 FROM garden_pack_unit_events WHERE purchase_id = NEW.purchase_id AND line_id = NEW.line_id AND unit_ordinal = NEW.unit_ordinal
  )) OR (NEW.kind = 'recycled' AND NOT EXISTS (
    SELECT 1 FROM garden_pack_unit_events WHERE purchase_id = NEW.purchase_id AND line_id = NEW.line_id AND unit_ordinal = NEW.unit_ordinal AND kind = 'placed'
  )) THEN RAISE EXCEPTION 'Garden pack transition requires valid prior audit'; END IF;
  IF NEW.credited_sunflowers <> (CASE NEW.kind WHEN 'placed' THEN 0 WHEN 'refunded' THEN unit.paid_sunflowers WHEN 'recycled' THEN unit.recycling_sunflowers END) THEN
    RAISE EXCEPTION 'Garden pack credit differs from original allocation';
  END IF;
  IF NEW.kind = 'recycled' AND ROW(NEW.garden_id, NEW.block_id) IS DISTINCT FROM ROW(unit.garden_id, unit.block_id) THEN
    RAISE EXCEPTION 'Garden pack recycling provenance mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER garden_pack_event_validate BEFORE INSERT ON garden_pack_unit_events FOR EACH ROW EXECUTE FUNCTION garden_pack_validate_event();

CREATE FUNCTION garden_pack_validate_state() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE unit garden_pack_units%ROWTYPE; expected_state text; event_garden integer; event_block text;
BEGIN
  SELECT * INTO unit FROM garden_pack_units WHERE purchase_id = NEW.purchase_id AND line_id = NEW.line_id AND unit_ordinal = NEW.unit_ordinal;
  SELECT kind, garden_id, block_id INTO expected_state, event_garden, event_block FROM garden_pack_unit_events
    WHERE purchase_id = unit.purchase_id AND line_id = unit.line_id AND unit_ordinal = unit.unit_ordinal
    ORDER BY CASE kind WHEN 'recycled' THEN 2 ELSE 1 END DESC LIMIT 1;
  IF unit.state <> coalesce(expected_state, 'available') OR ROW(unit.garden_id, unit.block_id) IS DISTINCT FROM ROW(event_garden, event_block) THEN
    RAISE EXCEPTION 'Garden pack state requires matching audit';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER garden_pack_unit_state_audit AFTER INSERT OR UPDATE ON garden_pack_units DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_pack_validate_state();
CREATE CONSTRAINT TRIGGER garden_pack_event_state_audit AFTER INSERT ON garden_pack_unit_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_pack_validate_state();
`;
