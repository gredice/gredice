import { pgTable, serial, integer, text, timestamp, boolean, index, decimal } from "drizzle-orm/pg-core";
import { relations, eq } from "drizzle-orm";
import { accounts } from "./usersSchema";
import { transactions } from "./transactionSchema";

export const invoices = pgTable('invoices', {
    id: serial('id').primaryKey(),
    invoiceNumber: text('invoice_number').notNull().unique(),
    accountId: text('account_id').notNull().references(() => accounts.id),
    transactionId: integer('transaction_id').references(() => transactions.id),

    // Invoice details
    subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
    taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('eur'),

    // Status and dates
    status: text('status').notNull().default('draft'), // draft, pending, sent, paid, cancelled
    issueDate: timestamp('issue_date').notNull(),
    dueDate: timestamp('due_date').notNull(),
    paidDate: timestamp('paid_date'),

    // Billing information
    billToName: text('bill_to_name'),
    billToEmail: text('bill_to_email').notNull(),
    billToAddress: text('bill_to_address'),
    billToCity: text('bill_to_city'),
    billToState: text('bill_to_state'),
    billToZip: text('bill_to_zip'),
    billToCountry: text('bill_to_country'),

    // Additional fields
    notes: text('notes'),
    terms: text('terms'),

    // System fields
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
}, (table) => [
    index('invoices_invoice_number_idx').on(table.invoiceNumber),
    index('invoices_account_id_idx').on(table.accountId),
    index('invoices_transaction_id_idx').on(table.transactionId),
    index('invoices_status_idx').on(table.status),
    index('invoices_issue_date_idx').on(table.issueDate),
    index('invoices_due_date_idx').on(table.dueDate),
    index('invoices_is_deleted_idx').on(table.isDeleted),
]);

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
    account: one(accounts, {
        fields: [invoices.accountId],
        references: [accounts.id],
        relationName: 'invoiceAccount',
    }),
    transaction: one(transactions, {
        fields: [invoices.transactionId],
        references: [transactions.id],
        relationName: 'invoiceTransaction',
    }),
    invoiceItems: many(invoiceItems, {
        relationName: 'invoiceInvoiceItems',
    }),
}));

export type InsertInvoice = Omit<typeof invoices.$inferInsert, 'invoiceNumber'>;
export type UpdateInvoice =
    Partial<Omit<typeof invoices.$inferInsert, 'id' | 'accountId' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof invoices.$inferSelect, 'id'>;
export type SelectInvoice = typeof invoices.$inferSelect;

export const invoiceItems = pgTable('invoice_items', {
    id: serial('id').primaryKey(),
    invoiceId: integer('invoice_id').notNull().references(() => invoices.id),

    // Item details
    description: text('description').notNull(),
    quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1.00'),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
    totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),

    // Optional product/service reference
    entityId: text('entity_id'),
    entityTypeName: text('entity_type_name'),

    // System fields
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
}, (table) => [
    index('invoice_items_invoice_id_idx').on(table.invoiceId),
    index('invoice_items_entity_id_idx').on(table.entityId),
    index('invoice_items_entity_type_idx').on(table.entityTypeName),
]);

export const invoiceItemRelations = relations(invoiceItems, ({ one }) => ({
    invoice: one(invoices, {
        fields: [invoiceItems.invoiceId],
        references: [invoices.id],
        relationName: 'invoiceInvoiceItems',
    }),
}));

export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;
export type UpdateInvoiceItem =
    Partial<Omit<typeof invoiceItems.$inferInsert, 'id' | 'invoiceId' | 'createdAt' | 'updatedAt'>> &
    Pick<typeof invoiceItems.$inferSelect, 'id'>;
export type SelectInvoiceItem = typeof invoiceItems.$inferSelect;

// Receipts table for Croatian fiscalization
export const receipts = pgTable('receipts', {
    id: serial('id').primaryKey(),
    invoiceId: integer('invoice_id').notNull().references(() => invoices.id), // Allow multiple receipts per invoice (for soft-deleted ones)

    // Receipt identification
    receiptNumber: text('receipt_number').notNull(),
    yearReceiptNumber: text('year_receipt_number').notNull().unique(), // e.g. "2023-1"

    // Financial details (copied from invoice when paid)
    subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
    taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).notNull(),
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').notNull(),

    // Payment information
    paymentMethod: text('payment_method').notNull(), // 'card', 'cash', 'bank_transfer', etc.
    paymentReference: text('payment_reference'), // External payment reference (e.g., Stripe payment ID)

    // Croatian fiscalization fields (CIS - Centralni informacijski sustav)
    jir: text('jir'), // Jedinstveni identifikator računa (Unique Receipt Identifier) - provided by tax authority
    zki: text('zki'), // Zaštitni kod izdavatelja (Issuer's Protective Code) - generated before sending to CIS
    cisStatus: text('cis_status').notNull().default('pending'), // 'pending', 'sent', 'confirmed', 'failed'
    cisReference: text('cis_reference'), // Reference number from CIS system
    cisErrorMessage: text('cis_error_message'), // Error message if fiscalization failed
    cisTimestamp: timestamp('cis_timestamp'), // When receipt was processed by CIS

    // Receipt dates
    issuedAt: timestamp('issued_at').notNull().defaultNow(),

    // Business information (for fiscalization)
    businessPin: text('business_pin'), // OIB of the business (Croatian tax number)
    businessName: text('business_name'),
    businessAddress: text('business_address'),

    // Customer information (optional, for B2B receipts)
    customerPin: text('customer_pin'), // Customer's PIN for B2B transactions
    customerName: text('customer_name'),
    customerAddress: text('customer_address'),

    // System fields
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
}, (table) => [
    index('receipts_invoice_id_idx').on(table.invoiceId),
    index('receipts_receipt_number_idx').on(table.receiptNumber),
    index('receipts_jir_idx').on(table.jir),
    index('receipts_zki_idx').on(table.zki),
    index('receipts_cis_status_idx').on(table.cisStatus),
    index('receipts_issued_at_idx').on(table.issuedAt),
    index('receipts_business_pin_idx').on(table.businessPin),
    index('receipts_is_deleted_idx').on(table.isDeleted),
]);

export const receiptRelations = relations(receipts, ({ one }) => ({
    invoice: one(invoices, {
        fields: [receipts.invoiceId],
        references: [invoices.id],
        relationName: 'invoiceReceipt',
    }),
}));

export type InsertReceipt = Omit<typeof receipts.$inferInsert, 'receiptNumber'>;
export type UpdateReceipt =
    Partial<Omit<typeof receipts.$inferInsert, 'id' | 'invoiceId' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof receipts.$inferSelect, 'id'>;
export type SelectReceipt = typeof receipts.$inferSelect;
