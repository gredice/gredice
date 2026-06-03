import { relations } from 'drizzle-orm';
import {
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { entities } from './cmsSchema';
import { events } from './eventsSchema';
import { gardens, raisedBedFields, raisedBeds } from './gardenSchema';
import { operations } from './operationsSchema';
import { accounts } from './usersSchema';

export const harvestTraceLinkStatuses = ['active', 'revoked'] as const;
export type HarvestTraceLinkStatus = (typeof harvestTraceLinkStatuses)[number];

export const harvestTraceLinks = pgTable(
    'harvest_trace_links',
    {
        id: serial('id').primaryKey(),
        publicToken: text('public_token').notNull(),
        status: text('status')
            .notNull()
            .default('active')
            .$type<HarvestTraceLinkStatus>(),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id),
        gardenId: integer('garden_id')
            .notNull()
            .references(() => gardens.id),
        raisedBedId: integer('raised_bed_id')
            .notNull()
            .references(() => raisedBeds.id),
        raisedBedFieldId: integer('raised_bed_field_id')
            .notNull()
            .references(() => raisedBedFields.id),
        fieldPositionIndex: integer('field_position_index').notNull(),
        fieldLabel: text('field_label').notNull(),
        plantPlaceEventId: integer('plant_place_event_id')
            .notNull()
            .references(() => events.id),
        plantSortId: integer('plant_sort_id').references(() => entities.id),
        harvestOperationId: integer('harvest_operation_id')
            .notNull()
            .references(() => operations.id),
        tracePath: text('trace_path').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        printedAt: timestamp('printed_at'),
        revokedAt: timestamp('revoked_at'),
    },
    (table) => [
        uniqueIndex('harvest_trace_links_public_token_unique').on(
            table.publicToken,
        ),
        uniqueIndex('harvest_trace_links_target_unique').on(
            table.harvestOperationId,
            table.raisedBedFieldId,
            table.plantPlaceEventId,
        ),
        index('harvest_trace_links_status_idx').on(table.status),
        index('harvest_trace_links_target_idx').on(
            table.harvestOperationId,
            table.raisedBedId,
            table.raisedBedFieldId,
            table.plantPlaceEventId,
        ),
        index('harvest_trace_links_raised_bed_idx').on(table.raisedBedId),
        index('harvest_trace_links_plant_sort_idx').on(table.plantSortId),
        index('harvest_trace_links_created_at_idx').on(table.createdAt),
    ],
);

export const harvestTraceLinksRelations = relations(
    harvestTraceLinks,
    ({ one, many }) => ({
        account: one(accounts, {
            fields: [harvestTraceLinks.accountId],
            references: [accounts.id],
            relationName: 'accountHarvestTraceLinks',
        }),
        garden: one(gardens, {
            fields: [harvestTraceLinks.gardenId],
            references: [gardens.id],
            relationName: 'gardenHarvestTraceLinks',
        }),
        raisedBed: one(raisedBeds, {
            fields: [harvestTraceLinks.raisedBedId],
            references: [raisedBeds.id],
            relationName: 'raisedBedHarvestTraceLinks',
        }),
        raisedBedField: one(raisedBedFields, {
            fields: [harvestTraceLinks.raisedBedFieldId],
            references: [raisedBedFields.id],
            relationName: 'raisedBedFieldHarvestTraceLinks',
        }),
        plantSort: one(entities, {
            fields: [harvestTraceLinks.plantSortId],
            references: [entities.id],
            relationName: 'plantSortHarvestTraceLinks',
        }),
        harvestOperation: one(operations, {
            fields: [harvestTraceLinks.harvestOperationId],
            references: [operations.id],
            relationName: 'operationHarvestTraceLinks',
        }),
        scans: many(harvestTraceScans, {
            relationName: 'harvestTraceLinkScans',
        }),
    }),
);

export const harvestTraceScans = pgTable(
    'harvest_trace_scans',
    {
        id: serial('id').primaryKey(),
        harvestTraceLinkId: integer('harvest_trace_link_id')
            .notNull()
            .references(() => harvestTraceLinks.id),
        scannedAt: timestamp('scanned_at').notNull().defaultNow(),
        userAgentFamily: text('user_agent_family'),
    },
    (table) => [
        index('harvest_trace_scans_link_id_idx').on(table.harvestTraceLinkId),
        index('harvest_trace_scans_scanned_at_idx').on(table.scannedAt),
    ],
);

export const harvestTraceScansRelations = relations(
    harvestTraceScans,
    ({ one }) => ({
        harvestTraceLink: one(harvestTraceLinks, {
            fields: [harvestTraceScans.harvestTraceLinkId],
            references: [harvestTraceLinks.id],
            relationName: 'harvestTraceLinkScans',
        }),
    }),
);

export type InsertHarvestTraceLink = typeof harvestTraceLinks.$inferInsert;
export type SelectHarvestTraceLink = typeof harvestTraceLinks.$inferSelect;
export type SelectHarvestTraceScan = typeof harvestTraceScans.$inferSelect;
