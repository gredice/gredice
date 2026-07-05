import { relations } from 'drizzle-orm';
import {
    boolean,
    decimal,
    index,
    integer,
    jsonb,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { entities } from './cmsSchema';
import { invoices, receipts } from './invoiceSchema';
import { operations } from './operationsSchema';
import { transactions } from './transactionSchema';
import { accounts } from './usersSchema';

export const sunflowerLedgerEntries = pgTable(
    'sunflower_ledger_entries',
    {
        id: serial('id').primaryKey(),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id),
        entryType: text('entry_type').notNull(),
        amount: integer('amount').notNull(),
        availableDelta: integer('available_delta').notNull(),
        reservedDelta: integer('reserved_delta').notNull(),
        availableBalanceAfter: integer('available_balance_after').notNull(),
        reservedBalanceAfter: integer('reserved_balance_after').notNull(),
        totalBalanceAfter: integer('total_balance_after').notNull(),
        amountEur: decimal('amount_eur', { precision: 10, scale: 2 }),
        currency: text('currency').notNull().default('sunflower'),
        packageCode: text('package_code'),
        packageEntityId: integer('package_entity_id').references(
            () => entities.id,
        ),
        operationId: integer('operation_id').references(() => operations.id),
        transactionId: integer('transaction_id').references(
            () => transactions.id,
        ),
        invoiceId: integer('invoice_id').references(() => invoices.id),
        receiptId: integer('receipt_id').references(() => receipts.id),
        reservationKey: text('reservation_key'),
        sourceType: text('source_type'),
        sourceId: text('source_id'),
        reason: text('reason'),
        actorId: text('actor_id'),
        metadata: jsonb('metadata'),
        idempotencyKey: text('idempotency_key').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('sunflower_ledger_account_id_idx').on(table.accountId),
        index('sunflower_ledger_entry_type_idx').on(table.entryType),
        index('sunflower_ledger_package_code_idx').on(table.packageCode),
        index('sunflower_ledger_package_entity_id_idx').on(
            table.packageEntityId,
        ),
        index('sunflower_ledger_operation_id_idx').on(table.operationId),
        index('sunflower_ledger_transaction_id_idx').on(table.transactionId),
        index('sunflower_ledger_invoice_id_idx').on(table.invoiceId),
        index('sunflower_ledger_receipt_id_idx').on(table.receiptId),
        index('sunflower_ledger_reservation_key_idx').on(table.reservationKey),
        index('sunflower_ledger_source_idx').on(
            table.sourceType,
            table.sourceId,
        ),
        index('sunflower_ledger_created_at_idx').on(table.createdAt),
        index('sunflower_ledger_is_deleted_idx').on(table.isDeleted),
        uniqueIndex('sunflower_ledger_account_idempotency_unique').on(
            table.accountId,
            table.idempotencyKey,
        ),
    ],
);

export const sunflowerLedgerEntriesRelations = relations(
    sunflowerLedgerEntries,
    ({ one }) => ({
        account: one(accounts, {
            fields: [sunflowerLedgerEntries.accountId],
            references: [accounts.id],
            relationName: 'accountSunflowerLedgerEntries',
        }),
        packageEntity: one(entities, {
            fields: [sunflowerLedgerEntries.packageEntityId],
            references: [entities.id],
            relationName: 'sunflowerLedgerPackageEntity',
        }),
        operation: one(operations, {
            fields: [sunflowerLedgerEntries.operationId],
            references: [operations.id],
            relationName: 'sunflowerLedgerOperation',
        }),
        transaction: one(transactions, {
            fields: [sunflowerLedgerEntries.transactionId],
            references: [transactions.id],
            relationName: 'sunflowerLedgerTransaction',
        }),
        invoice: one(invoices, {
            fields: [sunflowerLedgerEntries.invoiceId],
            references: [invoices.id],
            relationName: 'sunflowerLedgerInvoice',
        }),
        receipt: one(receipts, {
            fields: [sunflowerLedgerEntries.receiptId],
            references: [receipts.id],
            relationName: 'sunflowerLedgerReceipt',
        }),
    }),
);

export type InsertSunflowerLedgerEntry =
    typeof sunflowerLedgerEntries.$inferInsert;
export type SelectSunflowerLedgerEntry =
    typeof sunflowerLedgerEntries.$inferSelect;
