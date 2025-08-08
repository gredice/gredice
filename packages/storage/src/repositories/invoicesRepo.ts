import 'server-only';
import { and, eq, desc, isNull, lte, like, gte, sql } from "drizzle-orm";
import {
    invoices,
    invoiceItems,
    receipts,
    InsertInvoice,
    UpdateInvoice,
    InsertInvoiceItem,
    UpdateInvoiceItem,
    InsertReceipt,
    UpdateReceipt
} from "../schema";
import { storage } from "../storage";
import { createEvent, knownEvents } from "./eventsRepo";
import { PgTransaction } from 'drizzle-orm/pg-core';

// Receipt creation data interface
export interface ReceiptCreationData {
    paymentMethod: string; // 'card', 'cash', 'bank_transfer', etc.
    paymentReference?: string; // External payment reference (e.g., Stripe payment ID)
    businessPin?: string; // Croatian business tax number
    businessName?: string;
    businessAddress?: string;
    customerPin?: string; // Customer's PIN for B2B transactions
    customerName?: string;
    customerAddress?: string; // Customer's address for B2B transactions
    // JIR and ZKI are optional - provided later during fiscalization
    jir?: string;
    zki?: string;
}

// Invoice CRUD operations
export async function createInvoice(invoice: InsertInvoice, items?: Omit<InsertInvoiceItem, 'invoiceId'>[]) {
    if (!invoice.accountId) {
        throw new Error("Invoice must have an accountId");
    }

    const maxRetries = 10;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
        try {
            const invoiceNumber = await generateInvoiceNumber();
            const invoiceId = (await storage()
                .insert(invoices)
                .values({
                    ...invoice,
                    invoiceNumber
                })
                .returning({ id: invoices.id }))[0].id;

            if (typeof invoiceId !== "number") {
                throw new Error("Failed to create invoice");
            }

            if (items && items.length > 0) {
                const invoiceItemsData = items.map(item => ({
                    ...item,
                    invoiceId: invoiceId as number,
                }));
                await storage().insert(invoiceItems).values(invoiceItemsData);
            }

            await createEvent(knownEvents.invoices.createdV1(invoiceId.toString(), {
                accountId: invoice.accountId,
                invoiceNumber: invoiceNumber,
                totalAmount: invoice.totalAmount,
                status: invoice.status || 'draft',
            }));

            return invoiceId;
        } catch (error) {
            attempt++;
            lastError = error as Error;

            // Check if the error is a unique constraint violation for invoice_number
            const isUniqueConstraintError = error instanceof Error &&
                (error.message.includes('unique constraint') ||
                    error.message.includes('duplicate key') ||
                    error.message.includes('UNIQUE violation') ||
                    error.message.includes('invoice_number'));

            if (!isUniqueConstraintError || attempt >= maxRetries) {
                break;
            }

            console.warn(`Retrying invoice creation (${attempt}/${maxRetries}) due to unique constraint violation: ${error.message}`);

            // Wait a small random amount before retrying to reduce collision chances
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        }
    }

    throw new Error(`Failed to create invoice after ${attempt} attempts. Last error: ${lastError?.message}`);
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
        where: and(eq(invoices.invoiceNumber, invoiceNumber), eq(invoices.isDeleted, false)),
        with: {
            invoiceItems: true,
            account: true,
            transaction: true,
        },
    });
}

export async function getInvoices(accountId: string) {
    return storage().query.invoices.findMany({
        where: and(eq(invoices.accountId, accountId), eq(invoices.isDeleted, false)),
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
            filters?.transactionId ? eq(invoices.transactionId, filters.transactionId) : undefined,
            eq(invoices.isDeleted, false)
        ),
        with: {
            invoiceItems: true,
            account: true,
            transaction: true,
        },
        orderBy: desc(invoices.issueDate),
    });
}

export async function getInvoicesByStatus(status: string, accountId?: string) {
    const whereConditions = [
        eq(invoices.status, status),
        eq(invoices.isDeleted, false)
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
    const today = new Date();
    const whereConditions = [
        eq(invoices.status, 'sent'),
        lte(invoices.dueDate, today),
        isNull(invoices.paidDate),
        eq(invoices.isDeleted, false)
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
        .where(
            and(
                eq(invoices.id, invoice.id),
                eq(invoices.isDeleted, false)
            ));

    // Only create status update event if status is being updated
    if (invoice.status) {
        await createEvent(knownEvents.invoices.updatedV1(invoice.id.toString(), {
            status: invoice.status,
        }));
    }
}

// Invoice status validation and transition functions
export type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'paid' | 'cancelled';

export function isValidStatusTransition(currentStatus: InvoiceStatus, newStatus: InvoiceStatus): boolean {
    const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
        'draft': ['pending', 'cancelled'],
        'pending': ['sent', 'cancelled'],
        'sent': ['paid'],
        'paid': [], // Cannot transition from paid
        'cancelled': [] // Cannot transition from cancelled
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

export function isOverdue(invoice: { status: string; dueDate: Date; paidDate?: Date | null }): boolean {
    if (invoice.status === 'paid' || invoice.paidDate) {
        return false;
    }
    return invoice.status === 'sent' && new Date() > new Date(invoice.dueDate);
}

export async function changeInvoiceStatus(invoiceId: number, newStatus: InvoiceStatus) {
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        throw new Error(`Invoice with id ${invoiceId} not found`);
    }

    const currentStatus = invoice.status as InvoiceStatus;

    if (!isValidStatusTransition(currentStatus, newStatus)) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }

    // Special validation for cancelling paid invoices
    if (newStatus === 'cancelled' && currentStatus === 'paid') {
        throw new Error('Cannot cancel a paid invoice');
    }

    await updateInvoice({
        id: invoiceId,
        status: newStatus
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
        status: 'cancelled'
    });

    await createEvent(knownEvents.invoices.updatedV1(invoiceId.toString(), {
        status: 'cancelled',
    }));

    return invoice;
}

export async function softDeleteInvoice(invoiceId: number) {
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        throw new Error(`Invoice with id ${invoiceId} not found`);
    }

    const currentStatus = invoice.status as InvoiceStatus;

    if (!canDeleteInvoice(currentStatus)) {
        throw new Error(`Cannot delete invoice with status ${currentStatus}. Only draft and pending invoices can be deleted.`);
    }

    await deleteInvoice(invoiceId);
    return invoice;
}

export async function markInvoiceAsPaid(
    invoiceId: number,
    receiptData: ReceiptCreationData,
    paidDate: Date = new Date()
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
            updatedAt: new Date()
        })
        .where(
            and(
                eq(invoices.id, invoiceId),
                eq(invoices.isDeleted, false)
            ));

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

    await createEvent(knownEvents.invoices.paidV1(invoiceId.toString(), {
        paidDate: paidDate.toISOString(),
        receiptId: receiptId.toString(),
        receiptNumber: receipt.receiptNumber,
    }));

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
    return (await storage()
        .insert(invoiceItems)
        .values(item)
        .returning({ id: invoiceItems.id }))[0].id;
}

export async function updateInvoiceItem(item: UpdateInvoiceItem) {
    await storage()
        .update(invoiceItems)
        .set(item)
        .where(eq(invoiceItems.id, item.id));
}

export async function deleteInvoiceItem(itemId: number) {
    await storage()
        .delete(invoiceItems)
        .where(eq(invoiceItems.id, itemId));
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
        where: and(
            like(invoices.invoiceNumber, `${prefix}%`)
        ),
        orderBy: sql`CAST(SUBSTRING(${invoices.invoiceNumber} FROM ${prefix.length + 1}) AS INTEGER) DESC`,
    });

    const nextNumber = parseInt(latestInvoice?.invoiceNumber.substring(prefix.length) ?? "0", 10) + 1;

    // Check if the incremented number already exists, retry up to 100 times to find next available
    const maxAttempts = 100;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidateNumber = `${prefix}${(nextNumber + attempt).toString().padStart(4, '0')}`;

        // Check if this number already exists
        const existingInvoice = await storage().query.invoices.findFirst({
            where: and(
                eq(invoices.invoiceNumber, candidateNumber)
            ),
        });

        if (!existingInvoice) {
            // Number is available, use it
            return candidateNumber;
        }
    }

    throw new Error(`Failed to generate unique invoice number after ${maxAttempts} attempts`);
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
    receiptData: Omit<ReceiptCreationData, 'jir' | 'zki'>
) {
    // Get the invoice details
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        throw new Error("Invoice not found");
    }

    if (invoice.status !== 'paid') {
        throw new Error("Can only create receipt for paid invoices");
    }

    // Check if receipt already exists for this invoice
    const existingReceipt = await getReceiptByInvoice(invoiceId);
    if (existingReceipt) {
        throw new Error("Receipt already exists for this invoice");
    }

    // Generate receipt number
    const receiptToInsert = {
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
        cisStatus: 'pending', // Start as pending, not fiscalized yet
    } satisfies Omit<InsertReceipt, 'yearReceiptNumber'>;

    const receiptId = await createReceipt(receiptToInsert);
    return receiptId;
}

// Receipt CRUD operations
export async function createReceipt(receipt: Omit<InsertReceipt, 'yearReceiptNumber'>) {
    const maxRetries = 10;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
        try {
            const receiptNumber = await generateReceiptNumber();
            const yearReceiptNumber = `${new Date().getFullYear()}-${receiptNumber}`;

            const receiptId = (await storage()
                .insert(receipts)
                .values({
                    ...receipt,
                    receiptNumber,
                    yearReceiptNumber
                })
                .returning({ id: receipts.id }))[0].id;

            await createEvent(knownEvents.receipts?.createdV1?.(receiptId.toString(), {
                invoiceId: receipt.invoiceId.toString(),
                receiptNumber,
                totalAmount: receipt.totalAmount,
                paymentMethod: receipt.paymentMethod,
            }) ?? {
                name: 'receipt.created.v1',
                entityId: receiptId.toString(),
                entityTypeName: 'receipt',
                eventData: {
                    invoiceId: receipt.invoiceId.toString(),
                    receiptNumber,
                    totalAmount: receipt.totalAmount,
                    paymentMethod: receipt.paymentMethod,
                }
            });

            return receiptId;
        } catch (error) {
            attempt++;
            lastError = error as Error;

            // Check if the error is a unique constraint violation for year_receipt_number or receipt_number
            const isUniqueConstraintError = error instanceof Error &&
                (error.message.includes('unique constraint') ||
                    error.message.includes('duplicate key') ||
                    error.message.includes('UNIQUE violation') ||
                    error.message.includes('year_receipt_number') ||
                    error.message.includes('receipt_number'));

            if (!isUniqueConstraintError || attempt >= maxRetries) {
                break;
            }

            // Wait a small random amount before retrying to reduce collision chances
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        }
    }

    throw new Error(`Failed to create receipt after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

export async function getReceipt(receiptId: number) {
    return storage().query.receipts.findFirst({
        where: and(eq(receipts.id, receiptId), eq(receipts.isDeleted, false)),
        with: {
            invoice: {
                with: {
                    invoiceItems: true,
                }
            },
        },
    });
}

export async function getReceiptByInvoice(invoiceId: number) {
    return storage().query.receipts.findFirst({
        where: and(eq(receipts.invoiceId, invoiceId), eq(receipts.isDeleted, false)),
    });
}

export async function getReceiptByNumber(receiptNumber: string) {
    return storage().query.receipts.findFirst({
        where: and(eq(receipts.receiptNumber, receiptNumber), eq(receipts.isDeleted, false)),
        with: {
            invoice: {
                with: {
                    invoiceItems: true,
                }
            },
        },
    });
}

export async function updateReceipt(receipt: UpdateReceipt) {
    await storage()
        .update(receipts)
        .set(receipt)
        .where(
            and(
                eq(receipts.id, receipt.id),
                eq(receipts.isDeleted, false)
            ));

    await createEvent(knownEvents.receipts?.updatedV1?.(receipt.id.toString()) ?? {
        name: 'receipt.updated.v1',
        entityId: receipt.id.toString(),
        entityTypeName: 'receipt',
        eventData: {}
    });
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
    }
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
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(receipts.id, receiptId),
                eq(receipts.isDeleted, false)
            ));

    await createEvent(knownEvents.receipts?.fiscalizedV1?.(receiptId.toString(), {
        jir: fiscalizationData.jir,
        zki: fiscalizationData.zki,
        cisStatus: fiscalizationData.cisStatus,
    }) ?? {
        name: 'receipt.fiscalized.v1',
        entityId: receiptId.toString(),
        entityTypeName: 'receipt',
        eventData: {
            jir: fiscalizationData.jir,
            zki: fiscalizationData.zki,
            cisStatus: fiscalizationData.cisStatus,
        }
    });
}

export async function getReceiptsByStatus(cisStatus: string) {
    return storage().query.receipts.findMany({
        where: and(eq(receipts.cisStatus, cisStatus), eq(receipts.isDeleted, false)),
        with: {
            invoice: true,
        },
        orderBy: desc(receipts.issuedAt),
    });
}

export async function getReceiptsByBusinessPin(businessPin: string) {
    return storage().query.receipts.findMany({
        where: and(eq(receipts.businessPin, businessPin), eq(receipts.isDeleted, false)),
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
        where: and(
            gte(receipts.issuedAt, firstDateOfYear),
        ),
        orderBy: sql`CAST(${receipts.receiptNumber} AS INTEGER) DESC`
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

    throw new Error(`Failed to generate unique receipt number after ${maxAttempts} attempts`);
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
            yearReceiptNumber: `${receipt.yearReceiptNumber}-deleted-${new Date().toISOString()}`
        })
        .where(
            and(
                eq(receipts.id, receiptId),
                eq(receipts.isDeleted, false)
            ));

    // Create event using the same pattern as other receipt operations
    await createEvent(knownEvents.receipts?.updatedV1?.(receiptId.toString()) ?? {
        name: 'receipt.deleted.v1',
        entityId: receiptId.toString(),
        entityTypeName: 'receipt',
        eventData: {}
    });
}
