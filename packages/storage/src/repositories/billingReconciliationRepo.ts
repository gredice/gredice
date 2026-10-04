import 'server-only';

import {
    and,
    asc,
    desc,
    eq,
    gt,
    inArray,
    notExists,
    or,
    sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
    type EmailStatus,
    emailMessages,
    invoices,
    receipts,
    transactions,
} from '../schema';
import { storage } from '../storage';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const BILLING_DOCUMENTS_TEMPLATE_NAME = 'commerce-billing-documents';
const BILLING_DELIVERY_KEY_PREFIX = 'billing-documents:invoice:';

const failedBillingEmailStatuses = [
    'failed',
    'bounced',
] satisfies EmailStatus[];
const activeBillingEmailStatuses = [
    'queued',
    'sending',
    'sent',
] satisfies EmailStatus[];

export type BillingReconciliationSort = 'newest' | 'oldest';

function clampLimit(limit: number | undefined) {
    if (limit === undefined || !Number.isFinite(limit)) {
        return DEFAULT_LIMIT;
    }

    return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

function normalizeSort(
    sort: BillingReconciliationSort | undefined,
): BillingReconciliationSort {
    return sort === 'oldest' ? 'oldest' : 'newest';
}

export type BillingReconciliationTransactionIssue = {
    id: number;
    accountId: string | null;
    stripePaymentId: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: Date;
};

export type BillingReconciliationInvoiceIssue = {
    id: number;
    invoiceNumber: string;
    accountId: string;
    transactionId: number | null;
    billToEmail: string;
    totalAmount: string;
    currency: string;
    status: string;
    issueDate: Date;
    paidDate: Date | null;
    createdAt: Date;
};

export type BillingReconciliationReceiptIssue = {
    id: number;
    receiptNumber: string;
    yearReceiptNumber: string;
    invoiceId: number | null;
    invoiceNumber: string | null;
    accountId: string | null;
    totalAmount: string;
    currency: string;
    cisStatus: string;
    cisErrorMessage: string | null;
    issuedAt: Date;
    createdAt: Date;
};

export type BillingReconciliationEmailIssue = {
    id: number | null;
    invoiceId: number;
    invoiceNumber: string;
    accountId: string;
    billToEmail: string;
    totalAmount: string;
    currency: string;
    status: EmailStatus | 'missing';
    errorMessage: string | null;
    createdAt: Date;
};

export type BillingReconciliationIssues = {
    transactionsWithoutInvoices: BillingReconciliationTransactionIssue[];
    paidInvoicesWithoutReceipts: BillingReconciliationInvoiceIssue[];
    receiptsNeedingFiscalization: BillingReconciliationReceiptIssue[];
    missingBillingDocumentEmails: BillingReconciliationEmailIssue[];
    failedBillingDocumentEmails: BillingReconciliationEmailIssue[];
};

export async function getBillingReconciliationIssues({
    limit,
    sort,
}: {
    limit?: number;
    sort?: BillingReconciliationSort;
} = {}): Promise<BillingReconciliationIssues> {
    const rowLimit = clampLimit(limit);
    const rowSort = normalizeSort(sort);
    const resolvedBillingEmailMessages = alias(
        emailMessages,
        'resolved_billing_email_messages',
    );

    const [
        transactionsWithoutInvoices,
        paidInvoicesWithoutReceipts,
        receiptsNeedingFiscalization,
        missingBillingDocumentEmails,
        failedBillingDocumentEmails,
    ] = await Promise.all([
        storage()
            .select({
                id: transactions.id,
                accountId: transactions.accountId,
                stripePaymentId: transactions.stripePaymentId,
                amount: transactions.amount,
                currency: transactions.currency,
                status: transactions.status,
                createdAt: transactions.createdAt,
            })
            .from(transactions)
            .where(
                and(
                    eq(transactions.status, 'completed'),
                    eq(transactions.isDeleted, false),
                    notExists(
                        storage()
                            .select({ id: invoices.id })
                            .from(invoices)
                            .where(
                                and(
                                    eq(invoices.transactionId, transactions.id),
                                    eq(invoices.isDeleted, false),
                                ),
                            ),
                    ),
                ),
            )
            .orderBy(
                rowSort === 'oldest'
                    ? asc(transactions.createdAt)
                    : desc(transactions.createdAt),
            )
            .limit(rowLimit),
        storage()
            .select({
                id: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                accountId: invoices.accountId,
                transactionId: invoices.transactionId,
                billToEmail: invoices.billToEmail,
                totalAmount: invoices.totalAmount,
                currency: invoices.currency,
                status: invoices.status,
                issueDate: invoices.issueDate,
                paidDate: invoices.paidDate,
                createdAt: invoices.createdAt,
            })
            .from(invoices)
            .where(
                and(
                    eq(invoices.status, 'paid'),
                    eq(invoices.isDeleted, false),
                    notExists(
                        storage()
                            .select({ id: receipts.id })
                            .from(receipts)
                            .where(
                                and(
                                    eq(receipts.invoiceId, invoices.id),
                                    eq(receipts.isDeleted, false),
                                ),
                            ),
                    ),
                ),
            )
            .orderBy(
                rowSort === 'oldest'
                    ? asc(
                          sql<Date>`coalesce(${invoices.paidDate}, ${invoices.issueDate})`,
                      )
                    : desc(
                          sql<Date>`coalesce(${invoices.paidDate}, ${invoices.issueDate})`,
                      ),
            )
            .limit(rowLimit),
        storage()
            .select({
                id: receipts.id,
                receiptNumber: receipts.receiptNumber,
                yearReceiptNumber: receipts.yearReceiptNumber,
                invoiceId: receipts.invoiceId,
                invoiceNumber: invoices.invoiceNumber,
                accountId: invoices.accountId,
                totalAmount: receipts.totalAmount,
                currency: receipts.currency,
                cisStatus: receipts.cisStatus,
                cisErrorMessage: receipts.cisErrorMessage,
                issuedAt: receipts.issuedAt,
                createdAt: receipts.createdAt,
            })
            .from(receipts)
            .leftJoin(
                invoices,
                and(
                    eq(receipts.invoiceId, invoices.id),
                    eq(invoices.isDeleted, false),
                ),
            )
            .where(
                and(
                    inArray(receipts.cisStatus, ['pending', 'failed']),
                    eq(receipts.isDeleted, false),
                ),
            )
            .orderBy(
                rowSort === 'oldest'
                    ? asc(receipts.issuedAt)
                    : desc(receipts.issuedAt),
                rowSort === 'oldest'
                    ? asc(receipts.createdAt)
                    : desc(receipts.createdAt),
            )
            .limit(rowLimit),
        storage()
            .select({
                id: sql<null>`null`,
                invoiceId: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                accountId: invoices.accountId,
                billToEmail: invoices.billToEmail,
                totalAmount: invoices.totalAmount,
                currency: invoices.currency,
                status: sql<'missing'>`'missing'`,
                errorMessage: sql<null>`null`,
                createdAt: invoices.createdAt,
            })
            .from(invoices)
            .where(
                and(
                    eq(invoices.status, 'paid'),
                    eq(invoices.isDeleted, false),
                    notExists(
                        storage()
                            .select({ id: emailMessages.id })
                            .from(emailMessages)
                            .where(
                                and(
                                    eq(
                                        emailMessages.templateName,
                                        BILLING_DOCUMENTS_TEMPLATE_NAME,
                                    ),
                                    sql<boolean>`${emailMessages.metadata}->>'billingDeliveryKey' = ${BILLING_DELIVERY_KEY_PREFIX} || ${invoices.id}::text`,
                                ),
                            ),
                    ),
                ),
            )
            .orderBy(
                rowSort === 'oldest'
                    ? asc(
                          sql<Date>`coalesce(${invoices.paidDate}, ${invoices.issueDate})`,
                      )
                    : desc(
                          sql<Date>`coalesce(${invoices.paidDate}, ${invoices.issueDate})`,
                      ),
            )
            .limit(rowLimit),
        storage()
            .select({
                id: emailMessages.id,
                invoiceId: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                accountId: invoices.accountId,
                billToEmail: invoices.billToEmail,
                totalAmount: invoices.totalAmount,
                currency: invoices.currency,
                status: emailMessages.status,
                errorMessage: emailMessages.errorMessage,
                createdAt: emailMessages.createdAt,
            })
            .from(emailMessages)
            .innerJoin(
                invoices,
                and(
                    eq(
                        invoices.id,
                        sql<number>`nullif(${emailMessages.metadata}->>'invoiceId', '')::int`,
                    ),
                    eq(invoices.isDeleted, false),
                ),
            )
            .where(
                and(
                    eq(
                        emailMessages.templateName,
                        BILLING_DOCUMENTS_TEMPLATE_NAME,
                    ),
                    inArray(emailMessages.status, failedBillingEmailStatuses),
                    sql<boolean>`${emailMessages.metadata}->>'billingDeliveryKey' like ${`${BILLING_DELIVERY_KEY_PREFIX}%`}`,
                    notExists(
                        storage()
                            .select({ id: resolvedBillingEmailMessages.id })
                            .from(resolvedBillingEmailMessages)
                            .where(
                                and(
                                    eq(
                                        resolvedBillingEmailMessages.templateName,
                                        BILLING_DOCUMENTS_TEMPLATE_NAME,
                                    ),
                                    inArray(
                                        resolvedBillingEmailMessages.status,
                                        activeBillingEmailStatuses,
                                    ),
                                    sql<boolean>`${resolvedBillingEmailMessages.metadata}->>'billingDeliveryKey' = ${emailMessages.metadata}->>'billingDeliveryKey'`,
                                    or(
                                        gt(
                                            resolvedBillingEmailMessages.createdAt,
                                            emailMessages.createdAt,
                                        ),
                                        and(
                                            eq(
                                                resolvedBillingEmailMessages.createdAt,
                                                emailMessages.createdAt,
                                            ),
                                            gt(
                                                resolvedBillingEmailMessages.id,
                                                emailMessages.id,
                                            ),
                                        ),
                                    ),
                                ),
                            ),
                    ),
                ),
            )
            .orderBy(
                rowSort === 'oldest'
                    ? asc(emailMessages.createdAt)
                    : desc(emailMessages.createdAt),
            )
            .limit(rowLimit),
    ]);

    return {
        failedBillingDocumentEmails,
        missingBillingDocumentEmails,
        paidInvoicesWithoutReceipts,
        receiptsNeedingFiscalization,
        transactionsWithoutInvoices,
    };
}
