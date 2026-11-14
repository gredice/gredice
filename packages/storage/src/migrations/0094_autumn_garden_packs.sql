-- Fresh pack schema only; the normal migrator supplies the transaction.
SET LOCAL lock_timeout = '2s';
--> statement-breakpoint
SET LOCAL statement_timeout = '15s';
--> statement-breakpoint
CREATE TABLE "garden_pack_lifecycle_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text,
	"operation_id" text NOT NULL,
	"previous_operation_id" text,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "garden_pack_lifecycle_receipt_valid" CHECK (length("garden_pack_lifecycle_receipts"."operation_id") BETWEEN 1 AND 128 AND "garden_pack_lifecycle_receipts"."kind" IN ('store','retrieve','refund','recycle','garden-delete') AND jsonb_typeof("garden_pack_lifecycle_receipts"."payload") = 'object' AND jsonb_typeof("garden_pack_lifecycle_receipts"."response") = 'object')
);
--> statement-breakpoint
CREATE TABLE "garden_pack_product_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "garden_pack_product_version_identity_check" CHECK (length("garden_pack_product_versions"."id") BETWEEN 1 AND 100 AND "garden_pack_product_versions"."snapshot" ? 'productVersionId' AND ("garden_pack_product_versions"."snapshot"->>'productVersionId' = "garden_pack_product_versions"."id") IS TRUE)
);
--> statement-breakpoint
CREATE TABLE "garden_pack_purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text,
	"operation_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_version_id" text NOT NULL,
	"contract_version" integer NOT NULL,
	"charged_sunflowers" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "garden_pack_purchase_version_check" CHECK ("garden_pack_purchases"."contract_version" = 1 AND length("garden_pack_purchases"."product_id") BETWEEN 1 AND 100 AND length("garden_pack_purchases"."product_version_id") BETWEEN 1 AND 100 AND length("garden_pack_purchases"."operation_id") BETWEEN 1 AND 128),
	CONSTRAINT "garden_pack_purchase_snapshot_check" CHECK ((jsonb_typeof("garden_pack_purchases"."snapshot") = 'object' AND ("garden_pack_purchases"."snapshot"->>'contractVersion')::integer = "garden_pack_purchases"."contract_version" AND "garden_pack_purchases"."snapshot"->>'productId' = "garden_pack_purchases"."product_id" AND "garden_pack_purchases"."snapshot"->>'productVersionId' = "garden_pack_purchases"."product_version_id" AND "garden_pack_purchases"."snapshot"->>'currency' = 'sunflower' AND ("garden_pack_purchases"."snapshot"->>'chargedSunflowers')::integer = "garden_pack_purchases"."charged_sunflowers" AND "garden_pack_purchases"."charged_sunflowers" >= 0 AND "garden_pack_purchases"."snapshot" ?& ARRAY['contractVersion', 'productId', 'productVersionId', 'currency', 'chargedSunflowers', 'lines', 'policy']) IS TRUE)
);
--> statement-breakpoint
CREATE TABLE "garden_pack_unit_events" (
	"account_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"purchase_id" text NOT NULL,
	"line_id" text NOT NULL,
	"unit_ordinal" integer NOT NULL,
	"operation_id" text NOT NULL,
	"placement_payload" jsonb,
	"placement_response" jsonb,
	"kind" text NOT NULL,
	"credited_sunflowers" integer NOT NULL,
	"garden_id" integer,
	"block_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "garden_pack_unit_event_value_check" CHECK ("garden_pack_unit_events"."credited_sunflowers" >= 0 AND length("garden_pack_unit_events"."operation_id") BETWEEN 1 AND 128 AND "garden_pack_unit_events"."kind" IN ('placed', 'refunded', 'recycled') AND (("garden_pack_unit_events"."kind" = 'refunded' AND "garden_pack_unit_events"."garden_id" IS NULL AND "garden_pack_unit_events"."block_id" IS NULL) OR ("garden_pack_unit_events"."kind" IN ('placed', 'recycled') AND "garden_pack_unit_events"."garden_id" IS NOT NULL AND "garden_pack_unit_events"."block_id" IS NOT NULL AND "garden_pack_unit_events"."garden_id" > 0 AND length("garden_pack_unit_events"."block_id") BETWEEN 1 AND 128)) AND ("garden_pack_unit_events"."kind" <> 'placed' OR "garden_pack_unit_events"."credited_sunflowers" = 0))
);
--> statement-breakpoint
CREATE TABLE "garden_pack_unit_locations" (
	"purchase_id" text NOT NULL,
	"line_id" text NOT NULL,
	"unit_ordinal" integer NOT NULL,
	"garden_id" integer NOT NULL,
	"block_id" text NOT NULL,
	"garden_box_block_id" text,
	"last_operation_id" text,
	CONSTRAINT "garden_pack_unit_locations_purchase_id_line_id_unit_ordinal_pk" PRIMARY KEY("purchase_id","line_id","unit_ordinal"),
	CONSTRAINT "garden_pack_location_valid" CHECK ("garden_pack_unit_locations"."garden_id" > 0 AND length("garden_pack_unit_locations"."block_id") BETWEEN 1 AND 128 AND ("garden_pack_unit_locations"."garden_box_block_id" IS NULL OR (length("garden_pack_unit_locations"."garden_box_block_id") BETWEEN 1 AND 128 AND "garden_pack_unit_locations"."garden_box_block_id" <> "garden_pack_unit_locations"."block_id")))
);
--> statement-breakpoint
CREATE TABLE "garden_pack_units" (
	"purchase_id" text NOT NULL,
	"line_id" text NOT NULL,
	"unit_ordinal" integer NOT NULL,
	"paid_sunflowers" integer NOT NULL,
	"recycling_sunflowers" integer NOT NULL,
	"state" text DEFAULT 'available' NOT NULL,
	"garden_id" integer,
	"block_id" text,
	CONSTRAINT "garden_pack_units_purchase_id_line_id_unit_ordinal_pk" PRIMARY KEY("purchase_id","line_id","unit_ordinal"),
	CONSTRAINT "garden_pack_unit_quantity_value_check" CHECK (length("garden_pack_units"."line_id") BETWEEN 1 AND 100 AND "garden_pack_units"."unit_ordinal" BETWEEN 1 AND 1000 AND "garden_pack_units"."paid_sunflowers" >= 0 AND "garden_pack_units"."recycling_sunflowers" BETWEEN 0 AND "garden_pack_units"."paid_sunflowers"),
	CONSTRAINT "garden_pack_unit_state_check" CHECK ("garden_pack_units"."state" IN ('available', 'placed', 'refunded', 'recycled') AND (("garden_pack_units"."state" IN ('available', 'refunded') AND "garden_pack_units"."garden_id" IS NULL AND "garden_pack_units"."block_id" IS NULL) OR ("garden_pack_units"."state" IN ('placed', 'recycled') AND "garden_pack_units"."garden_id" IS NOT NULL AND "garden_pack_units"."block_id" IS NOT NULL AND "garden_pack_units"."garden_id" > 0 AND length("garden_pack_units"."block_id") BETWEEN 1 AND 128)))
);
--> statement-breakpoint
ALTER TABLE "garden_pack_lifecycle_receipts" ADD CONSTRAINT "garden_pack_lifecycle_receipts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_pack_purchases" ADD CONSTRAINT "garden_pack_purchases_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_pack_purchases" ADD CONSTRAINT "garden_pack_purchases_product_version_id_garden_pack_product_versions_id_fk" FOREIGN KEY ("product_version_id") REFERENCES "public"."garden_pack_product_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_pack_unit_events" ADD CONSTRAINT "garden_pack_unit_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_pack_unit_events" ADD CONSTRAINT "garden_pack_unit_events_purchase_id_line_id_unit_ordinal_garden_pack_units_purchase_id_line_id_unit_ordinal_fk" FOREIGN KEY ("purchase_id","line_id","unit_ordinal") REFERENCES "public"."garden_pack_units"("purchase_id","line_id","unit_ordinal") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_pack_unit_locations" ADD CONSTRAINT "garden_pack_unit_locations_purchase_id_line_id_unit_ordinal_garden_pack_units_purchase_id_line_id_unit_ordinal_fk" FOREIGN KEY ("purchase_id","line_id","unit_ordinal") REFERENCES "public"."garden_pack_units"("purchase_id","line_id","unit_ordinal") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_pack_units" ADD CONSTRAINT "garden_pack_units_purchase_id_garden_pack_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."garden_pack_purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "garden_pack_lifecycle_operation_unique" ON "garden_pack_lifecycle_receipts" USING btree ("account_id","operation_id");--> statement-breakpoint
CREATE INDEX "garden_pack_purchases_account_idx" ON "garden_pack_purchases" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "garden_pack_purchase_operation_unique" ON "garden_pack_purchases" USING btree ("account_id","operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "garden_pack_unit_event_operation_unique" ON "garden_pack_unit_events" USING btree ("account_id","operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "garden_pack_unit_event_transition_unique" ON "garden_pack_unit_events" USING btree ("purchase_id","line_id","unit_ordinal","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "garden_pack_location_block_unique" ON "garden_pack_unit_locations" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "garden_pack_location_box_idx" ON "garden_pack_unit_locations" USING btree ("garden_id","garden_box_block_id");--> statement-breakpoint
CREATE UNIQUE INDEX "garden_pack_unit_block_provenance_unique" ON "garden_pack_units" USING btree ("block_id") WHERE "garden_pack_units"."block_id" IS NOT NULL;
--> statement-breakpoint
-- Exact source-owned money, ownership and lifecycle guards.
CREATE FUNCTION garden_pack_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Garden pack history is immutable'; END IF;
  IF TG_TABLE_NAME = 'garden_pack_product_versions' THEN
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN RAISE EXCEPTION 'Garden pack product version is immutable'; END IF;
  ELSIF TG_TABLE_NAME IN ('garden_pack_purchases', 'garden_pack_unit_events', 'garden_pack_lifecycle_receipts') THEN
    IF (to_jsonb(NEW) - 'account_id') IS DISTINCT FROM (to_jsonb(OLD) - 'account_id') OR
       (NEW.account_id IS DISTINCT FROM OLD.account_id AND NOT (
         OLD.account_id IS NOT NULL AND NEW.account_id IS NULL AND
         NOT EXISTS (SELECT 1 FROM accounts WHERE id = OLD.account_id)
       )) THEN
      RAISE EXCEPTION 'Garden pack purchase snapshot is immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'garden_pack_units' THEN
    IF ROW(NEW.purchase_id, NEW.line_id, NEW.unit_ordinal, NEW.paid_sunflowers, NEW.recycling_sunflowers)
       IS DISTINCT FROM ROW(OLD.purchase_id, OLD.line_id, OLD.unit_ordinal, OLD.paid_sunflowers, OLD.recycling_sunflowers) THEN
      RAISE EXCEPTION 'Garden pack unit allocation is immutable';
    END IF;
    IF OLD.state <> 'available' AND ROW(NEW.garden_id, NEW.block_id) IS DISTINCT FROM ROW(OLD.garden_id, OLD.block_id) THEN RAISE EXCEPTION 'Garden pack original provenance is immutable'; END IF;
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

CREATE TRIGGER garden_pack_lifecycle_immutable BEFORE UPDATE OR DELETE ON garden_pack_lifecycle_receipts FOR EACH ROW EXECUTE FUNCTION garden_pack_immutable();
CREATE FUNCTION garden_pack_assert_location(target_purchase text, target_line text, target_ordinal integer) RETURNS void LANGUAGE plpgsql AS $$
DECLARE location garden_pack_unit_locations%ROWTYPE; unit garden_pack_units%ROWTYPE; owner_id text; receipt garden_pack_lifecycle_receipts%ROWTYPE;
BEGIN
  SELECT * INTO unit FROM garden_pack_units WHERE purchase_id = target_purchase AND line_id = target_line AND unit_ordinal = target_ordinal;
  SELECT account_id INTO owner_id FROM garden_pack_purchases WHERE id = target_purchase;
  SELECT * INTO location FROM garden_pack_unit_locations WHERE purchase_id = target_purchase AND line_id = target_line AND unit_ordinal = target_ordinal;
  IF owner_id IS NULL THEN
    IF location.block_id IS NOT NULL THEN RAISE EXCEPTION 'Detached pack must have no current location'; END IF;
    RETURN;
  END IF;
  IF unit.state = 'placed' THEN
    IF location.block_id IS NULL OR location.block_id IS DISTINCT FROM unit.block_id OR location.garden_id IS DISTINCT FROM unit.garden_id THEN RAISE EXCEPTION 'Placed pack unit requires exact physical location'; END IF;
    IF NOT EXISTS (SELECT 1 FROM gardens g JOIN garden_blocks b ON b.garden_id = g.id JOIN garden_pack_unit_events e ON e.purchase_id = unit.purchase_id AND e.line_id = unit.line_id AND e.unit_ordinal = unit.unit_ordinal AND e.kind = 'placed' WHERE g.id = location.garden_id AND b.id = location.block_id AND g.account_id = owner_id AND NOT g.is_deleted AND b.is_deleted = (location.garden_box_block_id IS NOT NULL) AND b.variant IS NOT DISTINCT FROM (e.placement_response->>'variant')::integer) THEN RAISE EXCEPTION 'Pack location or fixed appearance does not match physical block'; END IF;
    IF location.garden_box_block_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM garden_blocks b WHERE b.id = location.garden_box_block_id AND b.garden_id = location.garden_id AND b.name = 'GardenBox' AND NOT b.is_deleted) THEN RAISE EXCEPTION 'Pack box location is invalid'; END IF;
    SELECT * INTO receipt FROM garden_pack_lifecycle_receipts r WHERE r.account_id = owner_id AND r.operation_id = location.last_operation_id AND r.kind IN ('store','retrieve') AND r.response->>'blockId' = location.block_id;
    IF location.garden_box_block_id IS NOT NULL AND (receipt.kind IS DISTINCT FROM 'store' OR receipt.payload->>'gardenBoxBlockId' IS DISTINCT FROM location.garden_box_block_id) THEN RAISE EXCEPTION 'Stored location requires exact store receipt'; END IF;
    IF location.last_operation_id IS NULL AND EXISTS (SELECT 1 FROM garden_pack_lifecycle_receipts r WHERE r.account_id = owner_id AND r.kind IN ('store','retrieve') AND r.response->>'blockId' = location.block_id) THEN RAISE EXCEPTION 'Pack location cannot discard lifecycle receipt history'; END IF;
    IF location.garden_box_block_id IS NULL AND location.last_operation_id IS NOT NULL AND receipt.kind IS DISTINCT FROM 'retrieve' THEN RAISE EXCEPTION 'Retrieved location requires exact retrieve receipt'; END IF;
  ELSIF location.block_id IS NOT NULL THEN RAISE EXCEPTION 'Nonplaced pack unit must have no physical location'; END IF;
END $$;
CREATE FUNCTION garden_pack_validate_location() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'garden_pack_unit_locations' AND TG_OP = 'UPDATE' THEN
    IF OLD.purchase_id IS DISTINCT FROM NEW.purchase_id OR OLD.line_id IS DISTINCT FROM NEW.line_id OR OLD.unit_ordinal IS DISTINCT FROM NEW.unit_ordinal OR OLD.garden_id IS DISTINCT FROM NEW.garden_id OR OLD.block_id IS DISTINCT FROM NEW.block_id THEN RAISE EXCEPTION 'Pack location identity is immutable'; END IF;
    IF OLD.garden_box_block_id IS DISTINCT FROM NEW.garden_box_block_id OR OLD.last_operation_id IS DISTINCT FROM NEW.last_operation_id THEN
      IF NEW.last_operation_id IS NULL OR NEW.last_operation_id IS NOT DISTINCT FROM OLD.last_operation_id OR NOT EXISTS (SELECT 1 FROM garden_pack_lifecycle_receipts r JOIN garden_pack_purchases p ON p.account_id = r.account_id WHERE p.id = NEW.purchase_id AND r.operation_id = NEW.last_operation_id AND r.previous_operation_id IS NOT DISTINCT FROM OLD.last_operation_id AND r.response->>'blockId' = NEW.block_id AND r.kind = CASE WHEN NEW.garden_box_block_id IS NULL THEN 'retrieve' ELSE 'store' END) THEN RAISE EXCEPTION 'Pack location transition requires a new linked receipt'; END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN PERFORM garden_pack_assert_location(OLD.purchase_id, OLD.line_id, OLD.unit_ordinal);
  ELSE PERFORM garden_pack_assert_location(NEW.purchase_id, NEW.line_id, NEW.unit_ordinal); END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER garden_pack_location_validate AFTER INSERT OR UPDATE OR DELETE ON garden_pack_unit_locations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_pack_validate_location();
CREATE CONSTRAINT TRIGGER garden_pack_unit_location_validate AFTER INSERT OR UPDATE ON garden_pack_units DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_pack_validate_location();
CREATE FUNCTION garden_pack_validate_physical_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE unit garden_pack_units%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME = 'gardens' THEN
    FOR unit IN SELECT u.* FROM garden_pack_units u JOIN garden_pack_unit_locations l USING (purchase_id,line_id,unit_ordinal) WHERE l.garden_id = NEW.id LOOP PERFORM garden_pack_assert_location(unit.purchase_id,unit.line_id,unit.unit_ordinal); END LOOP;
  ELSE
    FOR unit IN SELECT u.* FROM garden_pack_units u JOIN garden_pack_unit_locations l USING (purchase_id,line_id,unit_ordinal) WHERE l.block_id = NEW.id OR l.garden_box_block_id = NEW.id LOOP PERFORM garden_pack_assert_location(unit.purchase_id,unit.line_id,unit.unit_ordinal); END LOOP;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER garden_pack_block_location_validate AFTER UPDATE ON garden_blocks DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_pack_validate_physical_change();
CREATE CONSTRAINT TRIGGER garden_pack_garden_location_validate AFTER UPDATE ON gardens DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garden_pack_validate_physical_change();
CREATE FUNCTION garden_pack_detach_locations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.account_id IS NOT NULL AND NEW.account_id IS NULL THEN DELETE FROM garden_pack_unit_locations WHERE purchase_id = NEW.id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER garden_pack_purchase_detach_locations AFTER UPDATE OF account_id ON garden_pack_purchases FOR EACH ROW EXECUTE FUNCTION garden_pack_detach_locations();
CREATE FUNCTION garden_pack_operation_namespace() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'garden_pack_unit_events' AND EXISTS (SELECT 1 FROM garden_pack_lifecycle_receipts r WHERE r.account_id = NEW.account_id AND r.operation_id = NEW.operation_id) THEN RAISE EXCEPTION 'Pack operation already belongs to lifecycle receipt'; END IF;
  IF TG_TABLE_NAME = 'garden_pack_lifecycle_receipts' THEN
    IF EXISTS (SELECT 1 FROM garden_pack_unit_events e WHERE e.account_id = NEW.account_id AND e.operation_id = NEW.operation_id AND NOT (NEW.kind = 'recycle' AND e.kind = 'recycled' AND NEW.payload->>'blockId' = e.block_id)) THEN RAISE EXCEPTION 'Pack operation already belongs to another unit event'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER garden_pack_event_operation_namespace BEFORE INSERT ON garden_pack_unit_events FOR EACH ROW EXECUTE FUNCTION garden_pack_operation_namespace();
CREATE TRIGGER garden_pack_lifecycle_operation_namespace BEFORE INSERT ON garden_pack_lifecycle_receipts FOR EACH ROW EXECUTE FUNCTION garden_pack_operation_namespace();
