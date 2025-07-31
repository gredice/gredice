import { pgTable, serial, integer, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./usersSchema";
import { gardens } from "./gardenSchema";
import { invoices } from "./invoiceSchema";

export const transactions = pgTable('transactions', {
    id: serial('id').primaryKey(),
    accountId: text('account_id').references(() => accounts.id),
    gardenId: integer('garden_id').references(() => gardens.id),
    stripePaymentId: text('stripe_payment_id').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
}, (table) => [
    index('transactions_account_id_idx').on(table.accountId),
    index('transactions_garden_id_idx').on(table.gardenId),
    index('transactions_stripe_payment_id_idx').on(table.stripePaymentId),
    index('transactions_is_deleted_idx').on(table.isDeleted),
]);

export const transactionRelations = relations(transactions, ({ one, many }) => ({
    account: one(accounts, {
        fields: [transactions.accountId],
        references: [accounts.id],
        relationName: 'transactionAccount',
    }),
    garden: one(gardens, {
        fields: [transactions.gardenId],
        references: [gardens.id],
        relationName: 'transactionGarden',
    }),
    invoices: many(invoices, {
        relationName: 'invoiceTransaction',
    }),
}));

export type InsertTransaction = typeof transactions.$inferInsert;
export type UpdateTransaction =
    Partial<Omit<typeof transactions.$inferInsert, 'id' | 'accountId' | 'gardenId' | 'stripePaymentId' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof transactions.$inferSelect, 'id'>;
export type SelectTransaction = typeof transactions.$inferSelect;