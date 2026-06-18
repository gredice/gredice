import { relations, sql } from 'drizzle-orm';
import {
    decimal,
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { farms } from './farmsSchema';
import { receipts } from './invoiceSchema';
import { users } from './usersSchema';

// entityTypeName values:
//   'operation'        → regular operation; entityId identifies the specific CMS operation entity
//   'sowing'           → flat price per verified direct sowing; entityId is null
//   'sowingGreenhouse' → flat price per verified greenhouse sowing; entityId is null
export const operationPrices = pgTable(
    'operation_prices',
    {
        id: serial('id').primaryKey(),
        farmId: integer('farm_id')
            .notNull()
            .references(() => farms.id),
        entityTypeName: text('entity_type_name').notNull(),
        entityId: integer('entity_id'),
        pricePerUnit: decimal('price_per_unit', {
            precision: 10,
            scale: 2,
        }).notNull(),
        currency: text('currency').notNull().default('eur'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        // For sowing rows (entityId IS NULL): one price per farm+entityTypeName
        uniqueIndex('operation_prices_farm_type_null_unique')
            .on(table.farmId, table.entityTypeName)
            .where(sql`${table.entityId} IS NULL`),
        // For operation rows (entityId IS NOT NULL): one price per farm+entityTypeName+entityId
        uniqueIndex('operation_prices_farm_type_entity_unique')
            .on(table.farmId, table.entityTypeName, table.entityId)
            .where(sql`${table.entityId} IS NOT NULL`),
        index('operation_prices_farm_id_idx').on(table.farmId),
    ],
);

export const operationPricesRelations = relations(
    operationPrices,
    ({ one }) => ({
        farm: one(farms, {
            fields: [operationPrices.farmId],
            references: [farms.id],
        }),
    }),
);

export type InsertOperationPrice = Omit<
    typeof operationPrices.$inferInsert,
    'id' | 'createdAt' | 'updatedAt'
>;
export type SelectOperationPrice = typeof operationPrices.$inferSelect;

export const farmerPayoutRequests = pgTable(
    'farmer_payout_requests',
    {
        id: serial('id').primaryKey(),
        farmId: integer('farm_id')
            .notNull()
            .references(() => farms.id),
        userId: text('user_id')
            .notNull()
            .references(() => users.id),
        requestedAmount: decimal('requested_amount', {
            precision: 10,
            scale: 2,
        }).notNull(),
        currency: text('currency').notNull().default('eur'),
        // pending → approved → paid (or rejected from pending/approved)
        status: text('status').notNull().default('pending'),
        farmerNote: text('farmer_note'),
        adminNote: text('admin_note'),
        bankReference: text('bank_reference'),
        receiptId: integer('receipt_id').references(() => receipts.id),
        approvedByUserId: text('approved_by_user_id').references(
            () => users.id,
        ),
        approvedAt: timestamp('approved_at'),
        paidAt: timestamp('paid_at'),
        rejectedAt: timestamp('rejected_at'),
        rejectionReason: text('rejection_reason'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('farmer_payout_requests_farm_id_idx').on(table.farmId),
        index('farmer_payout_requests_user_id_idx').on(table.userId),
        index('farmer_payout_requests_status_idx').on(table.status),
    ],
);

export const farmerPayoutRequestAdjustments = pgTable(
    'farmer_payout_request_adjustments',
    {
        id: serial('id').primaryKey(),
        payoutRequestId: integer('payout_request_id')
            .notNull()
            .references(() => farmerPayoutRequests.id),
        label: text('label').notNull(),
        amount: decimal('amount', {
            precision: 10,
            scale: 2,
        }).notNull(),
        currency: text('currency').notNull().default('eur'),
        createdByUserId: text('created_by_user_id').references(() => users.id),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('farmer_payout_adjustments_request_id_idx').on(
            table.payoutRequestId,
        ),
    ],
);

export const farmerPayoutRequestItems = pgTable(
    'farmer_payout_request_items',
    {
        id: serial('id').primaryKey(),
        payoutRequestId: integer('payout_request_id')
            .notNull()
            .references(() => farmerPayoutRequests.id),
        entityTypeName: text('entity_type_name').notNull(),
        entityId: integer('entity_id'),
        label: text('label').notNull(),
        operationCount: integer('operation_count').notNull(),
        durationMinutes: decimal('duration_minutes', {
            precision: 10,
            scale: 2,
        }).notNull(),
        totalDurationMinutes: decimal('total_duration_minutes', {
            precision: 10,
            scale: 2,
        }).notNull(),
        pricePerUnit: decimal('price_per_unit', {
            precision: 10,
            scale: 2,
        }).notNull(),
        totalAmount: decimal('total_amount', {
            precision: 10,
            scale: 2,
        }).notNull(),
        currency: text('currency').notNull().default('eur'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('farmer_payout_items_request_id_idx').on(table.payoutRequestId),
    ],
);

export const farmerPayoutRequestsRelations = relations(
    farmerPayoutRequests,
    ({ many, one }) => ({
        farm: one(farms, {
            fields: [farmerPayoutRequests.farmId],
            references: [farms.id],
        }),
        user: one(users, {
            fields: [farmerPayoutRequests.userId],
            references: [users.id],
            relationName: 'farmerPayoutRequestUser',
        }),
        approvedByUser: one(users, {
            fields: [farmerPayoutRequests.approvedByUserId],
            references: [users.id],
            relationName: 'farmerPayoutRequestApprovedByUser',
        }),
        receipt: one(receipts, {
            fields: [farmerPayoutRequests.receiptId],
            references: [receipts.id],
        }),
        adjustments: many(farmerPayoutRequestAdjustments),
        items: many(farmerPayoutRequestItems),
    }),
);

export const farmerPayoutRequestAdjustmentsRelations = relations(
    farmerPayoutRequestAdjustments,
    ({ one }) => ({
        payoutRequest: one(farmerPayoutRequests, {
            fields: [farmerPayoutRequestAdjustments.payoutRequestId],
            references: [farmerPayoutRequests.id],
        }),
        createdByUser: one(users, {
            fields: [farmerPayoutRequestAdjustments.createdByUserId],
            references: [users.id],
        }),
    }),
);

export const farmerPayoutRequestItemsRelations = relations(
    farmerPayoutRequestItems,
    ({ one }) => ({
        payoutRequest: one(farmerPayoutRequests, {
            fields: [farmerPayoutRequestItems.payoutRequestId],
            references: [farmerPayoutRequests.id],
        }),
    }),
);

export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export type InsertFarmerPayoutRequest = Omit<
    typeof farmerPayoutRequests.$inferInsert,
    'id' | 'createdAt' | 'updatedAt'
>;
export type SelectFarmerPayoutRequest =
    typeof farmerPayoutRequests.$inferSelect;

export type InsertFarmerPayoutRequestAdjustment = Omit<
    typeof farmerPayoutRequestAdjustments.$inferInsert,
    'id' | 'createdAt' | 'updatedAt'
>;
export type SelectFarmerPayoutRequestAdjustment =
    typeof farmerPayoutRequestAdjustments.$inferSelect;

export type InsertFarmerPayoutRequestItem = Omit<
    typeof farmerPayoutRequestItems.$inferInsert,
    'id' | 'createdAt' | 'updatedAt'
>;
export type SelectFarmerPayoutRequestItem =
    typeof farmerPayoutRequestItems.$inferSelect;
