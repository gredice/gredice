import 'server-only';
import { and, desc, eq, gte, isNull, like, lte, sql } from 'drizzle-orm';
import {
    type InsertInvoice,
    type InsertInvoiceItem,
    type InsertReceipt,
    invoiceItems,
    invoices,
    receipts,
    transactions,
    type UpdateInvoice,
    type UpdateInvoiceItem,
    type UpdateReceipt,
} from '../schema';
import { storage } from '../storage';
import { createEvent, knownEvents } from './eventsRepo';

const DAY_MS = 24 * 60 * 60 * 1000;

// Receipt creation data interface
export interface ReceiptCreationData {
    paymentMethod: 'card' | 'cash' | 'bank_transfer';
    paymentReference?: string | null;
    businessPin?: string | null;
    businessName?: string | null;
    businessAddress?: string | null;
    customerPin?: string | null;
    customerName?: string | null;
    customerAddress?: string | null;
    // JIR and ZKI are optional - provided later during fiscalization
    jir?: string;
    zki?: string;
}

export interface InvoiceForTransactionLineItem {
    description: string;
    quantity?: number | string | null;
    unitPriceCents: number;
    totalPriceCents: number;
    entityId?: string | null;
    entityTypeName?: string | null;
}

export interface InvoiceForTransactionBillingSnapshot {
    billToName?: string | null;
    billToEmail?: string | null;
    billToAddress?: string | null;
    billToCity?: string | null;
    billToState?: string | null;
    billToZip?: string | null;
    billToCountry?: string | null;
    notes?: string | null;
    terms?: string | null;
}

export type EnsureInvoiceForTransactionSkippedReason =
    | 'transaction_not_found'
    | 'transaction_not_completed'
    | 'missing_account'
    | 'missing_billing_email'
    | 'missing_items'
    | 'invalid_item_amount'
    | 'amount_mismatch';

export type EnsureInvoiceForTransactionResult =
    | {
          status: 'created' | 'existing';
          invoiceId: number;
          invoiceNumber: string;
      }
    | {
          status: 'skipped';
          reason: EnsureInvoiceForTransactionSkippedReason;
          message: string;
      };

export interface ReceiptForInvoiceData
    extends Omit<ReceiptCreationData, 'jir' | 'zki'> {
    issuedAt?: Date | null;
}

export type EnsureReceiptForInvoiceSkippedReason =
    | 'invoice_not_found'
    | 'invoice_not_paid';

export type EnsureReceiptForInvoiceResult =
    | {
          status: 'created' | 'existing';
          receiptId: number;
          receiptNumber: string;
          yearReceiptNumber: string;
      }
    | {
          status: 'skipped';
          reason: EnsureReceiptForInvoiceSkippedReason;
          message: string;
      };

// Invoice CRUD operations
export async function createInvoice(
    invoice: InsertInvoice,
    items?: Omit<InsertInvoiceItem, 'invoiceId'>[],
) {
    if (!invoice.accountId) {
        throw new Error('Invoice must have an accountId');
    }

    const maxRetries = 10;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
        try {
            const invoiceNumber = await generateInvoiceNumber();
            const invoiceId = (
                await storage()
                    .insert(invoices)
                    .values({
                        ...invoice,
                        invoiceNumber,
                    })
                    .returning({ id: invoices.id })
            )[0].id;

            if (typeof invoiceId !== 'number') {
                throw new Error('Failed to create invoice');
            }

            if (items && items.length > 0) {
                const invoiceItemsData = items.map((item) => ({
                    ...item,
                    invoiceId: invoiceId as number,
                }));
                await storage().insert(invoiceItems).values(invoiceItemsData);
            }

            await createEvent(
                knownEvents.invoices.createdV1(invoiceId.toString(), {
                    accountId: invoice.accountId,
                    invoiceNumber: invoiceNumber,
                    totalAmount: invoice.totalAmount,
                    status: invoice.status || 'draft',
                }),
            );

            return invoiceId;
        } catch (error) {
            attempt++;
            lastError = error as Error;

            // Check if the error is a unique constraint violation for invoice_number
            const isUniqueConstraintError =
                error instanceof Error &&
                (error.message.includes('unique constraint') ||
                    error.message.includes('duplicate key') ||
                    error.message.includes('UNIQUE violation') ||
                    error.message.includes('invoice_number'));

            if (!isUniqueConstraintError || attempt >= maxRetries) {
                break;
            }

            console.warn(
                `Retrying invoice creation (${attempt}/${maxRetries}) due to unique constraint violation: ${error.message}`,
            );

            // Wait a small random amount before retrying to reduce collision chances
            await new Promise((resolve) =>
                setTimeout(resolve, Math.random() * 100),
            );
        }
    }

    throw new Error(
        `Failed to create invoice after ${attempt} attempts. Last error: ${lastError?.message}`,
    );
}

export async function getInvoice(invoiceId: number) {
    return storage().query.invoices.findFirst({
        where: and(eq(invoices.id, invoiceId), eq(invoices.isDeleted, false)),
        with: {
            invoiceItems: true,
            account: true,
            transaction: true,
        },
    });
}

export async function getInvoiceByNumber(invoiceNumber: string) {
    return storage().query.invoices.findFirst({
        where: and(
            eq(invoices.invoiceNumber, invoiceNumber),
            eq(invoices.isDeleted, false),
        ),
        with: {
            invoiceItems: true,
            account: true,
            transaction: true,
        },
    });
}

function cleanInvoiceText(value: string | null | undefined) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : undefined;
}

function centsToDecimalString(cents: number) {
    return (cents / 100).toFixed(2);
}

function normalizeInvoiceQuantity(value: number | string | null | undefined) {
    const quantity = Number(value ?? 1);
    return Number.isFinite(quantity) && quantity > 0
        ? quantity.toFixed(2)
        : '1.00';
}

function buildSkippedInvoiceResult(
    reason: EnsureInvoiceForTransactionSkippedReason,
    message: string,
): EnsureInvoiceForTransactionResult {
    return {
        status: 'skipped',
        reason,
        message,
    };
}

function buildSkippedReceiptResult(
    reason: EnsureReceiptForInvoiceSkippedReason,
    message: string,
): EnsureReceiptForInvoiceResult {
    return {
        status: 'skipped',
        reason,
        message,
    };
}

async function withInvoiceTransactionGenerationLock<T>(
    transactionId: number,
    callback: () => Promise<T>,
) {
    if (process.env.GREDICE_TEST_DB_PROVIDER === 'pglite') {
        return callback();
    }

    return storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`invoice-transaction:${transactionId}`}));`,
        );

        return callback();
    });
}

async function withReceiptInvoiceGenerationLock<T>(
    invoiceId: number,
    callback: () => Promise<T>,
) {
    if (process.env.GREDICE_TEST_DB_PROVIDER === 'pglite') {
        return callback();
    }

    return storage().transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`receipt-invoice:${invoiceId}`}));`,
        );

        return callback();
    });
}

export async function ensureInvoiceForTransaction({
    billingSnapshot,
    items,
    transactionId,
}: {
    billingSnapshot?: InvoiceForTransactionBillingSnapshot;
    items: InvoiceForTransactionLineItem[];
    transactionId: number;
}): Promise<EnsureInvoiceForTransactionResult> {
    return withInvoiceTransactionGenerationLock(transactionId, async () => {
        const existingInvoices = await getAllInvoices({ transactionId });
        if (existingInvoices.length > 0) {
            if (existingInvoices.length > 1) {
                console.warn(
                    'Multiple active invoices found for transaction during invoice generation',
                    {
                        invoiceIds: existingInvoices.map(
                            (invoice) => invoice.id,
                        ),
                        transactionId,
                    },
                );
            }

            const existingInvoice = existingInvoices[0];
            return {
                status: 'existing',
                invoiceId: existingInvoice.id,
                invoiceNumber: existingInvoice.invoiceNumber,
            };
        }

        const transaction = await storage().query.transactions.findFirst({
            where: and(
                eq(transactions.id, transactionId),
                eq(transactions.isDeleted, false),
            ),
            with: {
                account: {
                    with: {
                        accountUsers: {
                            with: {
                                user: true,
                            },
                        },
                    },
                },
            },
        });
        if (!transaction) {
            return buildSkippedInvoiceResult(
                'transaction_not_found',
                `Transaction ${transactionId} was not found.`,
            );
        }
        if (transaction.status !== 'completed') {
            return buildSkippedInvoiceResult(
                'transaction_not_completed',
                `Transaction ${transactionId} is not completed.`,
            );
        }
        if (!transaction.accountId) {
            return buildSkippedInvoiceResult(
                'missing_account',
                `Transaction ${transactionId} has no account.`,
            );
        }
        if (items.length === 0) {
            return buildSkippedInvoiceResult(
                'missing_items',
                `Transaction ${transactionId} has no invoice line items.`,
            );
        }

        const invalidItem = items.find(
            (item) =>
                !Number.isInteger(item.unitPriceCents) ||
                !Number.isInteger(item.totalPriceCents) ||
                item.unitPriceCents < 0 ||
                item.totalPriceCents < 0,
        );
        if (invalidItem) {
            return buildSkippedInvoiceResult(
                'invalid_item_amount',
                `Transaction ${transactionId} has an invalid invoice line amount.`,
            );
        }

        const itemTotalCents = items.reduce(
            (sum, item) => sum + item.totalPriceCents,
            0,
        );
        if (itemTotalCents !== transaction.amount) {
            return buildSkippedInvoiceResult(
                'amount_mismatch',
                `Transaction ${transactionId} amount ${transaction.amount} does not match invoice item total ${itemTotalCents}.`,
            );
        }

        const billToEmail =
            cleanInvoiceText(billingSnapshot?.billToEmail) ??
            cleanInvoiceText(
                transaction.account?.accountUsers[0]?.user.userName,
            );
        if (!billToEmail) {
            return buildSkippedInvoiceResult(
                'missing_billing_email',
                `Transaction ${transactionId} has no billing email snapshot.`,
            );
        }

        const issueDate = transaction.createdAt;
        const totalAmount = centsToDecimalString(transaction.amount);
        const invoiceId = await createInvoice(
            {
                accountId: transaction.accountId,
                transactionId,
                subtotal: totalAmount,
                taxAmount: '0.00',
                totalAmount,
                currency: transaction.currency.toLowerCase(),
                status: 'paid',
                issueDate,
                dueDate: issueDate,
                paidDate: issueDate,
                billToName: cleanInvoiceText(billingSnapshot?.billToName),
                billToEmail,
                billToAddress: cleanInvoiceText(billingSnapshot?.billToAddress),
                billToCity: cleanInvoiceText(billingSnapshot?.billToCity),
                billToState: cleanInvoiceText(billingSnapshot?.billToState),
                billToZip: cleanInvoiceText(billingSnapshot?.billToZip),
                billToCountry:
                    cleanInvoiceText(billingSnapshot?.billToCountry) ??
                    'Hrvatska',
                notes: cleanInvoiceText(billingSnapshot?.notes),
                terms: cleanInvoiceText(billingSnapshot?.terms),
            },
            items.map((item) => ({
                description:
                    cleanInvoiceText(item.description) ?? 'Plaćena narudžba',
                quantity: normalizeInvoiceQuantity(item.quantity),
                unitPrice: centsToDecimalString(item.unitPriceCents),
                totalPrice: centsToDecimalString(item.totalPriceCents),
                entityId: cleanInvoiceText(item.entityId),
                entityTypeName: cleanInvoiceText(item.entityTypeName),
            })),
        );
        const invoice = await getInvoice(invoiceId);
        if (!invoice) {
            throw new Error(
                `Failed to read created invoice ${invoiceId} for transaction ${transactionId}`,
            );
        }

        return {
            status: 'created',
            invoiceId,
            invoiceNumber: invoice.invoiceNumber,
        };
    });
}

export async function ensureReceiptForInvoice(
    invoiceId: number,
    receiptData: ReceiptForInvoiceData,
): Promise<EnsureReceiptForInvoiceResult> {
    return withReceiptInvoiceGenerationLock(invoiceId, async () => {
        const existingReceipt = await getReceiptByInvoice(invoiceId);
        if (existingReceipt) {
            return {
                status: 'existing',
                receiptId: existingReceipt.id,
                receiptNumber: existingReceipt.receiptNumber,
                yearReceiptNumber: existingReceipt.yearReceiptNumber,
            };
        }

        const invoice = await getInvoice(invoiceId);
        if (!invoice) {
            return buildSkippedReceiptResult(
                'invoice_not_found',
                `Invoice ${invoiceId} was not found.`,
            );
        }
        if (invoice.status !== 'paid') {
            return buildSkippedReceiptResult(
                'invoice_not_paid',
                `Invoice ${invoiceId} is not paid.`,
            );
        }

        const issuedAt = receiptData.issuedAt ?? invoice.paidDate ?? new Date();
        const receiptId = await createReceipt({
            invoiceId,
            subtotal: invoice.subtotal,
            taxAmount: invoice.taxAmount,
            totalAmount: invoice.totalAmount,
            currency: invoice.currency,
            paymentMethod: receiptData.paymentMethod,
            paymentReference:
                receiptData.paymentReference ??
                invoice.transaction?.stripePaymentId ??
                invoice.transactionId?.toString(),
            businessPin: receiptData.businessPin,
            businessName: receiptData.businessName,
            businessAddress: receiptData.businessAddress,
            customerPin: receiptData.customerPin,
            customerName: receiptData.customerName ?? invoice.billToName,
            customerAddress:
                receiptData.customerAddress ?? invoice.billToAddress,
            issuedAt,
            cisStatus: 'pending',
        });

        const receipt = await getReceipt(receiptId);
        if (!receipt) {
            throw new Error(
                `Failed to create receipt for invoice ${invoiceId}`,
            );
        }

        return {
            status: 'created',
            receiptId,
            receiptNumber: receipt.receiptNumber,
            yearReceiptNumber: receipt.yearReceiptNumber,
        };
    });
}

export async function getInvoices(accountId: string) {
    return storage().query.invoices.findMany({
        where: and(
            eq(invoices.accountId, accountId),
            eq(invoices.isDeleted, false),
        ),
        with: {
            invoiceItems: true,
            transaction: true,
        },
        orderBy: desc(invoices.issueDate),
    });
}

export async function getAllInvoices(filters?: { transactionId?: number }) {
    return storage().query.invoices.findMany({
        where: and(
            filters?.transactionId
                ? eq(invoices.transactionId, filters.transactionId)
                : undefined,
            eq(invoices.isDeleted, false),
        ),
        with: {
            invoiceItems: true,
            account: true,
            transaction: true,
        },
        orderBy: desc(invoices.issueDate),
    });
}

export async function getAccountBillingInvoices(accountId: string) {
    const accountInvoices = await getInvoices(accountId);

    return Promise.all(
        accountInvoices.map(async (invoice) => ({
            ...invoice,
            receipt: await getReceiptByInvoice(invoice.id),
        })),
    );
}

export async function getAccountBillingInvoice(
    accountId: string,
    invoiceId: number,
) {
    const invoice = await getInvoice(invoiceId);
    if (!invoice || invoice.accountId !== accountId) {
        return undefined;
    }

    return {
        ...invoice,
        receipt: await getReceiptByInvoice(invoice.id),
    };
}

export async function getAccountBillingReceipt(
    accountId: string,
    receiptId: number,
) {
    const receipt = await getReceipt(receiptId);
    if (!receipt || receipt.invoice?.accountId !== accountId) {
        return undefined;
    }

    return receipt;
}

export async function getInvoicesByStatus(status: string, accountId?: string) {
    const whereConditions = [
        eq(invoices.status, status),
        eq(invoices.isDeleted, false),
    ];

    if (accountId) {
        whereConditions.push(eq(invoices.accountId, accountId));
    }

    return storage().query.invoices.findMany({
        where: and(...whereConditions),
        with: {
            invoiceItems: true,
            account: true,
            transaction: true,
        },
        orderBy: desc(invoices.issueDate),
    });
}

export async function getOverdueInvoices(accountId?: string) {
    const overdueBoundary = new Date(Date.now() - DAY_MS);
    const whereConditions = [
        eq(invoices.status, 'sent'),
        lte(invoices.dueDate, overdueBoundary),
        isNull(invoices.paidDate),
        eq(invoices.isDeleted, false),
    ];

    if (accountId) {
        whereConditions.push(eq(invoices.accountId, accountId));
    }

    return storage().query.invoices.findMany({
        where: and(...whereConditions),
        with: {
            invoiceItems: true,
            account: true,
            transaction: true,
        },
        orderBy: invoices.dueDate,
    });
}

export async function updateInvoice(invoice: UpdateInvoice) {
    await storage()
        .update(invoices)
        .set(invoice)
        .where(and(eq(invoices.id, invoice.id), eq(invoices.isDeleted, false)));

    // Only create status update event if status is being updated
    if (invoice.status) {
        await createEvent(
            knownEvents.invoices.updatedV1(invoice.id.toString(), {
                status: invoice.status,
            }),
        );
    }
}

// Invoice status validation and transition functions
export type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'paid' | 'cancelled';

export function isValidStatusTransition(
    currentStatus: InvoiceStatus,
    newStatus: InvoiceStatus,
): boolean {
    const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
        draft: ['pending', 'cancelled'],
        pending: ['sent', 'cancelled'],
        sent: ['paid'],
        paid: [], // Cannot transition from paid
        cancelled: [], // Cannot transition from cancelled
    };

    return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

export function canEditInvoice(status: InvoiceStatus): boolean {
    return status === 'draft' || status === 'pending';
}

export function canDeleteInvoice(status: InvoiceStatus): boolean {
    return status === 'draft' || status === 'pending';
}

export function canCancelInvoice(status: InvoiceStatus): boolean {
    return status === 'draft' || status === 'pending' || status === 'sent';
}

export function isOverdue(invoice: {
    status: string;
    dueDate: Date;
    paidDate?: Date | null;
}): boolean {
    if (invoice.status === 'paid' || invoice.paidDate) {
        return false;
    }
    return (
        invoice.status === 'sent' &&
        Date.now() >= new Date(invoice.dueDate).getTime() + DAY_MS
    );
}

export async function changeInvoiceStatus(
    invoiceId: number,
    newStatus: InvoiceStatus,
) {
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        throw new Error(`Invoice with id ${invoiceId} not found`);
    }

    const currentStatus = invoice.status as InvoiceStatus;

    if (!isValidStatusTransition(currentStatus, newStatus)) {
        throw new Error(
            `Invalid status transition from ${currentStatus} to ${newStatus}`,
        );
    }

    // Special validation for cancelling paid invoices
    if (newStatus === 'cancelled' && currentStatus === 'paid') {
        throw new Error('Cannot cancel a paid invoice');
    }

    await updateInvoice({
        id: invoiceId,
        status: newStatus,
    });

    return invoice;
}

export async function cancelInvoice(invoiceId: number) {
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        throw new Error(`Invoice with id ${invoiceId} not found`);
    }

    const currentStatus = invoice.status as InvoiceStatus;

    if (!canCancelInvoice(currentStatus)) {
        throw new Error(`Cannot cancel invoice with status ${currentStatus}`);
    }

    await updateInvoice({
        id: invoiceId,
        status: 'cancelled',
    });

    await createEvent(
        knownEvents.invoices.updatedV1(invoiceId.toString(), {
            status: 'cancelled',
        }),
    );

    return invoice;
}

export async function softDeleteInvoice(invoiceId: number) {
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        throw new Error(`Invoice with id ${invoiceId} not found`);
    }

    const currentStatus = invoice.status as InvoiceStatus;

    if (!canDeleteInvoice(currentStatus)) {
        throw new Error(
            `Cannot delete invoice with status ${currentStatus}. Only draft and pending invoices can be deleted.`,
        );
    }

    await deleteInvoice(invoiceId);
    return invoice;
}

export async function markInvoiceAsPaid(
    invoiceId: number,
    receiptData: ReceiptCreationData,
    paidDate: Date = new Date(),
) {
    // First get the invoice to copy financial data to receipt
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        throw new Error(`Invoice with id ${invoiceId} not found`);
    }

    if (invoice.status === 'paid') {
        throw new Error(`Invoice ${invoiceId} is already marked as paid`);
    }

    // Update invoice status to paid
    await storage()
        .update(invoices)
        .set({
            status: 'paid',
            paidDate,
            updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.isDeleted, false)));

    // Create receipt
    const receiptId = await createReceipt({
        invoiceId,
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        paymentMethod: receiptData.paymentMethod,
        paymentReference: receiptData.paymentReference,
        businessPin: receiptData.businessPin,
        businessName: receiptData.businessName,
        businessAddress: receiptData.businessAddress,
        customerPin: receiptData.customerPin,
        customerName: receiptData.customerName,
        customerAddress: receiptData.customerAddress,
        jir: receiptData.jir,
        zki: receiptData.zki,
        issuedAt: paidDate,
    });

    const receipt = await getReceipt(receiptId);
    if (!receipt) {
        throw new Error(`Failed to create receipt for invoice ${invoiceId}`);
    }

    await createEvent(
        knownEvents.invoices.paidV1(invoiceId.toString(), {
            paidDate: paidDate.toISOString(),
            receiptId: receiptId.toString(),
            receiptNumber: receipt.receiptNumber,
        }),
    );

    return receiptId;
}

export async function deleteInvoice(invoiceId: number) {
    await storage()
        .update(invoices)
        .set({ isDeleted: true })
        .where(eq(invoices.id, invoiceId));

    await createEvent(knownEvents.invoices.deletedV1(invoiceId.toString()));
}

// Invoice Items CRUD operations
export async function addInvoiceItem(item: InsertInvoiceItem) {
    return (
        await storage()
            .insert(invoiceItems)
            .values(item)
            .returning({ id: invoiceItems.id })
    )[0].id;
}

export async function updateInvoiceItem(item: UpdateInvoiceItem) {
    await storage()
        .update(invoiceItems)
        .set(item)
        .where(eq(invoiceItems.id, item.id));
}

export async function deleteInvoiceItem(itemId: number) {
    await storage().delete(invoiceItems).where(eq(invoiceItems.id, itemId));
}

export async function getInvoiceItems(invoiceId: number) {
    return storage().query.invoiceItems.findMany({
        where: eq(invoiceItems.invoiceId, invoiceId),
        orderBy: invoiceItems.id,
    });
}

// Utility functions
async function generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PON-${year}-`;

    // Get the latest invoice number for this year
    // Pull the deleted invoices too so we don't run into unique constraint issues
    const latestInvoice = await storage().query.invoices.findFirst({
        where: and(like(invoices.invoiceNumber, `${prefix}%`)),
        orderBy: sql`CAST(SUBSTRING(${invoices.invoiceNumber} FROM ${prefix.length + 1}) AS INTEGER) DESC`,
    });

    const nextNumber =
        parseInt(
            latestInvoice?.invoiceNumber.substring(prefix.length) ?? '0',
            10,
        ) + 1;

    // Check if the incremented number already exists, retry up to 100 times to find next available
    const maxAttempts = 100;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidateNumber = `${prefix}${(nextNumber + attempt).toString().padStart(4, '0')}`;

        // Check if this number already exists
        const existingInvoice = await storage().query.invoices.findFirst({
            where: and(eq(invoices.invoiceNumber, candidateNumber)),
        });

        if (!existingInvoice) {
            // Number is available, use it
            return candidateNumber;
        }
    }

    throw new Error(
        `Failed to generate unique invoice number after ${maxAttempts} attempts`,
    );
}

export async function calculateInvoiceTotals(invoiceId: number) {
    const items = await getInvoiceItems(invoiceId);

    const subtotal = items.reduce((sum, item) => {
        return sum + parseFloat(item.totalPrice);
    }, 0);

    // You can implement tax calculation logic here
    // For now, we'll assume tax is already included in the invoice

    return {
        subtotal: subtotal.toFixed(2),
        itemCount: items.length,
    };
}

export async function createReceiptFromInvoice(
    invoiceId: number,
    receiptData: Omit<ReceiptCreationData, 'jir' | 'zki'>,
) {
    const result = await ensureReceiptForInvoice(invoiceId, receiptData);
    if (result.status === 'skipped') {
        throw new Error(result.message);
    }

    return result.receiptId;
}

// Receipt CRUD operations
export async function createReceipt(
    receipt: Omit<InsertReceipt, 'yearReceiptNumber'>,
) {
    const maxRetries = 10;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
        try {
            const receiptNumber = await generateReceiptNumber();
            const yearReceiptNumber = `${new Date().getFullYear()}-${receiptNumber}`;

            const receiptId = (
                await storage()
                    .insert(receipts)
                    .values({
                        ...receipt,
                        receiptNumber,
                        yearReceiptNumber,
                    })
                    .returning({ id: receipts.id })
            )[0].id;

            await createEvent(
                knownEvents.receipts.createdV1(receiptId.toString(), {
                    invoiceId: receipt.invoiceId?.toString() ?? null,
                    receiptNumber,
                    totalAmount: receipt.totalAmount,
                    paymentMethod: receipt.paymentMethod,
                }),
            );

            return receiptId;
        } catch (error) {
            attempt++;
            lastError = error as Error;

            // Check if the error is a unique constraint violation for year_receipt_number or receipt_number
            const isUniqueConstraintError =
                error instanceof Error &&
                (error.message.includes('unique constraint') ||
                    error.message.includes('duplicate key') ||
                    error.message.includes('UNIQUE violation') ||
                    error.message.includes('year_receipt_number') ||
                    error.message.includes('receipt_number'));

            if (!isUniqueConstraintError || attempt >= maxRetries) {
                break;
            }

            // Wait a small random amount before retrying to reduce collision chances
            await new Promise((resolve) =>
                setTimeout(resolve, Math.random() * 100),
            );
        }
    }

    throw new Error(
        `Failed to create receipt after ${maxRetries} attempts. Last error: ${lastError?.message}`,
    );
}

export async function getReceipt(receiptId: number) {
    return storage().query.receipts.findFirst({
        where: and(eq(receipts.id, receiptId), eq(receipts.isDeleted, false)),
        with: {
            invoice: {
                with: {
                    invoiceItems: true,
                },
            },
        },
    });
}

export async function getReceiptByInvoice(invoiceId: number) {
    return storage().query.receipts.findFirst({
        where: and(
            eq(receipts.invoiceId, invoiceId),
            eq(receipts.isDeleted, false),
        ),
    });
}

export async function getReceiptByNumber(receiptNumber: string) {
    return storage().query.receipts.findFirst({
        where: and(
            eq(receipts.receiptNumber, receiptNumber),
            eq(receipts.isDeleted, false),
        ),
        with: {
            invoice: {
                with: {
                    invoiceItems: true,
                },
            },
        },
    });
}

export async function updateReceipt(receipt: UpdateReceipt) {
    await storage()
        .update(receipts)
        .set(receipt)
        .where(and(eq(receipts.id, receipt.id), eq(receipts.isDeleted, false)));

    await createEvent(knownEvents.receipts.updatedV1(receipt.id.toString()));
}

// Croatian fiscalization functions
export async function updateReceiptFiscalization(
    receiptId: number,
    fiscalizationData: {
        jir?: string;
        zki?: string;
        cisStatus: 'sent' | 'confirmed' | 'failed';
        cisReference?: string;
        cisErrorMessage?: string | null;
        cisTimestamp?: Date;
        cisResponse?: string | null;
    },
) {
    await storage()
        .update(receipts)
        .set({
            jir: fiscalizationData.jir,
            zki: fiscalizationData.zki,
            cisStatus: fiscalizationData.cisStatus,
            cisReference: fiscalizationData.cisReference,
            cisErrorMessage: fiscalizationData.cisErrorMessage,
            cisTimestamp: fiscalizationData.cisTimestamp,
            cisResponse: fiscalizationData.cisResponse,
            updatedAt: new Date(),
        })
        .where(and(eq(receipts.id, receiptId), eq(receipts.isDeleted, false)));

    await createEvent(
        knownEvents.receipts.fiscalizedV1(receiptId.toString(), {
            jir: fiscalizationData.jir,
            zki: fiscalizationData.zki,
            cisStatus: fiscalizationData.cisStatus,
            cisResponse: fiscalizationData.cisResponse,
        }),
    );
}

export async function getReceiptsByStatus(cisStatus: string) {
    return storage().query.receipts.findMany({
        where: and(
            eq(receipts.cisStatus, cisStatus),
            eq(receipts.isDeleted, false),
        ),
        with: {
            invoice: true,
        },
        orderBy: desc(receipts.issuedAt),
    });
}

async function generateReceiptNumber(): Promise<string> {
    const firstDateOfYear = new Date(new Date().getFullYear(), 0, 1);

    // Get the latest receipt number for this year
    // Order by id desc to get the most recently created receipt, which should have the highest number
    // Pull the deleted invoices too so we don't run into unique constraint issues
    const latestReceipt = await storage().query.receipts.findFirst({
        where: and(gte(receipts.issuedAt, firstDateOfYear)),
        orderBy: sql`CAST(${receipts.receiptNumber} AS INTEGER) DESC`,
    });

    const nextNumber = parseInt(latestReceipt?.receiptNumber ?? '0', 10) + 1;

    // Check if the incremented number already exists, retry up to 100 times to find next available
    const maxAttempts = 100;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidateNumber = `${nextNumber + attempt}`;

        // Check if this number already exists
        const existingReceipt = await storage().query.receipts.findFirst({
            where: and(
                eq(receipts.receiptNumber, candidateNumber),
                gte(receipts.issuedAt, firstDateOfYear),
            ),
        });

        if (!existingReceipt) {
            // Number is available, use it
            return candidateNumber;
        }
    }

    throw new Error(
        `Failed to generate unique receipt number after ${maxAttempts} attempts`,
    );
}

export async function softDeleteReceipt(receiptId: number) {
    const receipt = await getReceipt(receiptId);
    if (!receipt) {
        throw new Error(`Receipt with id ${receiptId} not found`);
    }

    await storage()
        .update(receipts)
        .set({
            isDeleted: true,
            updatedAt: new Date(),
            yearReceiptNumber: `${receipt.yearReceiptNumber}-deleted-${new Date().toISOString()}`,
        })
        .where(and(eq(receipts.id, receiptId), eq(receipts.isDeleted, false)));

    // Create event using the same pattern as other receipt operations
    await createEvent(knownEvents.receipts.updatedV1(receiptId.toString()));
}
