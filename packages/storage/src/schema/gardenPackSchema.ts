import { sql } from 'drizzle-orm';
import {
    check,
    foreignKey,
    index,
    integer,
    jsonb,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { GardenPackProductSnapshot } from '../gardenPackContract';
import { accounts } from './usersSchema';

export const gardenPackProductVersions = pgTable(
    'garden_pack_product_versions',
    {
        id: text('id').primaryKey(),
        snapshot: jsonb('snapshot')
            .$type<GardenPackProductSnapshot>()
            .notNull(),
    },
    (table) => [
        check(
            'garden_pack_product_version_identity_check',
            sql`length(${table.id}) BETWEEN 1 AND 100 AND ${table.snapshot} ? 'productVersionId' AND (${table.snapshot}->>'productVersionId' = ${table.id}) IS TRUE`,
        ),
    ],
);

export const gardenPackPurchases = pgTable(
    'garden_pack_purchases',
    {
        id: text('id').primaryKey(),
        // Detach on account deletion; retain nonpersonal purchase/audit history.
        accountId: text('account_id').references(() => accounts.id, {
            onDelete: 'set null',
        }),
        operationId: text('operation_id').notNull(),
        productId: text('product_id').notNull(),
        productVersionId: text('product_version_id')
            .notNull()
            .references(() => gardenPackProductVersions.id),
        contractVersion: integer('contract_version').notNull(),
        chargedSunflowers: integer('charged_sunflowers').notNull(),
        snapshot: jsonb('snapshot')
            .$type<GardenPackProductSnapshot>()
            .notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('garden_pack_purchases_account_idx').on(table.accountId),
        uniqueIndex('garden_pack_purchase_operation_unique').on(
            table.accountId,
            table.operationId,
        ),
        check(
            'garden_pack_purchase_version_check',
            sql`${table.contractVersion} = 1 AND length(${table.productId}) BETWEEN 1 AND 100 AND length(${table.productVersionId}) BETWEEN 1 AND 100 AND length(${table.operationId}) BETWEEN 1 AND 128`,
        ),
        check(
            'garden_pack_purchase_snapshot_check',
            sql`(jsonb_typeof(${table.snapshot}) = 'object' AND (${table.snapshot}->>'contractVersion')::integer = ${table.contractVersion} AND ${table.snapshot}->>'productId' = ${table.productId} AND ${table.snapshot}->>'productVersionId' = ${table.productVersionId} AND ${table.snapshot}->>'currency' = 'sunflower' AND (${table.snapshot}->>'chargedSunflowers')::integer = ${table.chargedSunflowers} AND ${table.chargedSunflowers} >= 0 AND ${table.snapshot} ?& ARRAY['contractVersion', 'productId', 'productVersionId', 'currency', 'chargedSunflowers', 'lines', 'policy']) IS TRUE`,
        ),
    ],
);

export const gardenPackUnits = pgTable(
    'garden_pack_units',
    {
        purchaseId: text('purchase_id')
            .notNull()
            .references(() => gardenPackPurchases.id),
        lineId: text('line_id').notNull(),
        unitOrdinal: integer('unit_ordinal').notNull(),
        paidSunflowers: integer('paid_sunflowers').notNull(),
        recyclingSunflowers: integer('recycling_sunflowers').notNull(),
        state: text('state', {
            enum: ['available', 'placed', 'refunded', 'recycled'],
        })
            .notNull()
            .default('available'),
        // Historical provenance, deliberately not cascading garden/block FKs.
        gardenId: integer('garden_id'),
        blockId: text('block_id'),
    },
    (table) => [
        primaryKey({
            columns: [table.purchaseId, table.lineId, table.unitOrdinal],
        }),
        uniqueIndex('garden_pack_unit_block_provenance_unique')
            .on(table.blockId)
            .where(sql`${table.blockId} IS NOT NULL`),
        check(
            'garden_pack_unit_quantity_value_check',
            sql`length(${table.lineId}) BETWEEN 1 AND 100 AND ${table.unitOrdinal} BETWEEN 1 AND 1000 AND ${table.paidSunflowers} >= 0 AND ${table.recyclingSunflowers} BETWEEN 0 AND ${table.paidSunflowers}`,
        ),
        check(
            'garden_pack_unit_state_check',
            sql`${table.state} IN ('available', 'placed', 'refunded', 'recycled') AND ((${table.state} IN ('available', 'refunded') AND ${table.gardenId} IS NULL AND ${table.blockId} IS NULL) OR (${table.state} IN ('placed', 'recycled') AND ${table.gardenId} IS NOT NULL AND ${table.blockId} IS NOT NULL AND ${table.gardenId} > 0 AND length(${table.blockId}) BETWEEN 1 AND 128))`,
        ),
    ],
);

export const gardenPackUnitEvents = pgTable(
    'garden_pack_unit_events',
    {
        accountId: text('account_id').references(() => accounts.id, {
            onDelete: 'set null',
        }),
        id: text('id').primaryKey(),
        purchaseId: text('purchase_id').notNull(),
        lineId: text('line_id').notNull(),
        unitOrdinal: integer('unit_ordinal').notNull(),
        operationId: text('operation_id').notNull(),
        placementPayload:
            jsonb('placement_payload').$type<Record<string, unknown>>(),
        placementResponse:
            jsonb('placement_response').$type<Record<string, unknown>>(),
        kind: text('kind', {
            enum: ['placed', 'refunded', 'recycled'],
        }).notNull(),
        creditedSunflowers: integer('credited_sunflowers').notNull(),
        gardenId: integer('garden_id'),
        blockId: text('block_id'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        foreignKey({
            columns: [table.purchaseId, table.lineId, table.unitOrdinal],
            foreignColumns: [
                gardenPackUnits.purchaseId,
                gardenPackUnits.lineId,
                gardenPackUnits.unitOrdinal,
            ],
        }),
        uniqueIndex('garden_pack_unit_event_operation_unique').on(
            table.accountId,
            table.operationId,
        ),
        uniqueIndex('garden_pack_unit_event_transition_unique').on(
            table.purchaseId,
            table.lineId,
            table.unitOrdinal,
            table.kind,
        ),
        check(
            'garden_pack_unit_event_value_check',
            sql`${table.creditedSunflowers} >= 0 AND length(${table.operationId}) BETWEEN 1 AND 128 AND ${table.kind} IN ('placed', 'refunded', 'recycled') AND ((${table.kind} = 'refunded' AND ${table.gardenId} IS NULL AND ${table.blockId} IS NULL) OR (${table.kind} IN ('placed', 'recycled') AND ${table.gardenId} IS NOT NULL AND ${table.blockId} IS NOT NULL AND ${table.gardenId} > 0 AND length(${table.blockId}) BETWEEN 1 AND 128)) AND (${table.kind} <> 'placed' OR ${table.creditedSunflowers} = 0)`,
        ),
    ],
);

/** Mutable physical location; the original unit provenance remains immutable. */
export const gardenPackUnitLocations = pgTable(
    'garden_pack_unit_locations',
    {
        purchaseId: text('purchase_id').notNull(),
        lineId: text('line_id').notNull(),
        unitOrdinal: integer('unit_ordinal').notNull(),
        gardenId: integer('garden_id').notNull(),
        blockId: text('block_id').notNull(),
        gardenBoxBlockId: text('garden_box_block_id'),
    },
    (table) => [
        primaryKey({
            columns: [table.purchaseId, table.lineId, table.unitOrdinal],
        }),
        foreignKey({
            columns: [table.purchaseId, table.lineId, table.unitOrdinal],
            foreignColumns: [
                gardenPackUnits.purchaseId,
                gardenPackUnits.lineId,
                gardenPackUnits.unitOrdinal,
            ],
        }),
        uniqueIndex('garden_pack_location_block_unique').on(table.blockId),
        index('garden_pack_location_box_idx').on(
            table.gardenId,
            table.gardenBoxBlockId,
        ),
        check(
            'garden_pack_location_valid',
            sql`${table.gardenId} > 0 AND length(${table.blockId}) BETWEEN 1 AND 128 AND (${table.gardenBoxBlockId} IS NULL OR (length(${table.gardenBoxBlockId}) BETWEEN 1 AND 128 AND ${table.gardenBoxBlockId} <> ${table.blockId}))`,
        ),
    ],
);

export const gardenPackLifecycleReceipts = pgTable(
    'garden_pack_lifecycle_receipts',
    {
        id: text('id').primaryKey(),
        accountId: text('account_id').references(() => accounts.id, {
            onDelete: 'set null',
        }),
        operationId: text('operation_id').notNull(),
        kind: text('kind', {
            enum: ['store', 'retrieve', 'refund', 'recycle', 'garden-delete'],
        }).notNull(),
        payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
        response: jsonb('response').$type<Record<string, unknown>>().notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex('garden_pack_lifecycle_operation_unique').on(
            table.accountId,
            table.operationId,
        ),
        check(
            'garden_pack_lifecycle_receipt_valid',
            sql`length(${table.operationId}) BETWEEN 1 AND 128 AND ${table.kind} IN ('store','retrieve','refund','recycle','garden-delete') AND jsonb_typeof(${table.payload}) = 'object' AND jsonb_typeof(${table.response}) = 'object'`,
        ),
    ],
);
