import { relations } from 'drizzle-orm';
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
import { receipts } from './invoiceSchema';
import { farms } from './farmsSchema';
import { users } from './usersSchema';

export const operationPrices = pgTable(
    'operation_prices',
    {
        id: serial('id').primaryKey(),
        farmId: integer('farm_id')
            .notNull()
            .references(() => farms.id),
        entityTypeName: text('entity_type_name').notNull(),
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
        uniqueIndex('operation_prices_farm_entity_unique').on(
            table.farmId,
            table.entityTypeName,
        ),
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

export const farmerPayoutRequestsRelations = relations(
    farmerPayoutRequests,
    ({ one }) => ({
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
    }),
);

export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export type InsertFarmerPayoutRequest = Omit<
    typeof farmerPayoutRequests.$inferInsert,
    'id' | 'createdAt' | 'updatedAt'
>;
export type SelectFarmerPayoutRequest =
    typeof farmerPayoutRequests.$inferSelect;
