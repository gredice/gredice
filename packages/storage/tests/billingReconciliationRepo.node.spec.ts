import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createEmailMessageLog,
    createInvoice,
    createReceipt,
    createTransaction,
    getBillingReconciliationIssues,
    updateEmailMessageLog,
    updateReceiptFiscalization,
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

function date() {
    return new Date();
}

async function createPaidInvoice({
    accountId,
    transactionId,
}: {
    accountId: string;
    transactionId?: number;
}) {
    const now = date();
    return createInvoice({
        accountId,
        transactionId,
        subtotal: '10.00',
        taxAmount: '0.00',
        totalAmount: '10.00',
        currency: 'eur',
        status: 'paid',
        issueDate: now,
        dueDate: now,
        paidDate: now,
        billToName: 'Kupac Test',
        billToEmail: `kupac-${randomUUID()}@example.test`,
        billToCountry: 'HR',
    });
}

async function createPendingReceipt(invoiceId: number) {
    return createReceipt({
        invoiceId,
        subtotal: '10.00',
        taxAmount: '0.00',
        totalAmount: '10.00',
        currency: 'eur',
        paymentMethod: 'card',
        paymentReference: `pi_${randomUUID()}`,
        issuedAt: date(),
    });
}

test('getBillingReconciliationIssues returns recoverable billing gaps', async () => {
    createTestDb();
    const accountId = await createTestAccount();

    const transactionWithoutInvoiceId = await createTransaction({
        accountId,
        amount: 1000,
        currency: 'eur',
        status: 'completed',
        stripePaymentId: `pi_${randomUUID()}`,
    });

    const transactionWithInvoiceId = await createTransaction({
        accountId,
        amount: 1000,
        currency: 'eur',
        status: 'completed',
        stripePaymentId: `pi_${randomUUID()}`,
    });
    await createPaidInvoice({
        accountId,
        transactionId: transactionWithInvoiceId,
    });

    const invoiceWithoutReceiptId = await createPaidInvoice({ accountId });
    const invoiceWithPendingReceiptId = await createPaidInvoice({ accountId });
    const pendingReceiptId = await createPendingReceipt(
        invoiceWithPendingReceiptId,
    );

    const invoiceWithConfirmedReceiptId = await createPaidInvoice({
        accountId,
    });
    const confirmedReceiptId = await createPendingReceipt(
        invoiceWithConfirmedReceiptId,
    );
    await updateReceiptFiscalization(confirmedReceiptId, {
        cisStatus: 'confirmed',
        jir: `jir-${randomUUID()}`,
        zki: `zki-${randomUUID()}`,
        cisTimestamp: date(),
    });

    const invoiceWithoutBillingEmailId = await createPaidInvoice({ accountId });
    const invoiceWithSentBillingEmailId = await createPaidInvoice({
        accountId,
    });
    await createEmailMessageLog({
        fromAddress: 'suncokret@obavijesti.gredice.com',
        subject: 'Gredice - dokumenti narudžbe',
        templateName: 'commerce-billing-documents',
        messageType: 'commerce',
        recipients: { to: [{ address: 'kupac@example.test' }] },
        metadata: {
            billingDeliveryKey: `billing-documents:invoice:${invoiceWithSentBillingEmailId}`,
            invoiceId: invoiceWithSentBillingEmailId,
        },
        status: 'sent',
    });

    const invoiceWithFailedBillingEmailId = await createPaidInvoice({
        accountId,
    });
    const failedEmail = await createEmailMessageLog({
        fromAddress: 'suncokret@obavijesti.gredice.com',
        subject: 'Gredice - dokumenti narudžbe',
        templateName: 'commerce-billing-documents',
        messageType: 'commerce',
        recipients: { to: [{ address: 'kupac@example.test' }] },
        metadata: {
            billingDeliveryKey: `billing-documents:invoice:${invoiceWithFailedBillingEmailId}`,
            invoiceId: invoiceWithFailedBillingEmailId,
        },
        status: 'failed',
    });
    await updateEmailMessageLog(failedEmail.id, {
        errorMessage: 'ACS unavailable',
    });

    const issues = await getBillingReconciliationIssues({ limit: 100 });

    assert.ok(
        issues.transactionsWithoutInvoices.some(
            (transaction) => transaction.id === transactionWithoutInvoiceId,
        ),
    );
    assert.equal(
        issues.transactionsWithoutInvoices.some(
            (transaction) => transaction.id === transactionWithInvoiceId,
        ),
        false,
    );
    assert.ok(
        issues.paidInvoicesWithoutReceipts.some(
            (invoice) => invoice.id === invoiceWithoutReceiptId,
        ),
    );
    assert.ok(
        issues.receiptsNeedingFiscalization.some(
            (receipt) => receipt.id === pendingReceiptId,
        ),
    );
    assert.equal(
        issues.receiptsNeedingFiscalization.some(
            (receipt) => receipt.id === confirmedReceiptId,
        ),
        false,
    );
    assert.ok(
        issues.missingBillingDocumentEmails.some(
            (emailIssue) =>
                emailIssue.invoiceId === invoiceWithoutBillingEmailId,
        ),
    );
    assert.equal(
        issues.missingBillingDocumentEmails.some(
            (emailIssue) =>
                emailIssue.invoiceId === invoiceWithSentBillingEmailId,
        ),
        false,
    );
    assert.ok(
        issues.failedBillingDocumentEmails.some(
            (emailIssue) =>
                emailIssue.id === failedEmail.id &&
                emailIssue.invoiceId === invoiceWithFailedBillingEmailId &&
                emailIssue.errorMessage === 'ACS unavailable',
        ),
    );
});

test('getBillingReconciliationIssues applies sort before limiting', async () => {
    createTestDb();
    const accountId = await createTestAccount();

    const oldestTransactionId = await createTransaction({
        accountId,
        amount: 1000,
        currency: 'eur',
        status: 'completed',
        stripePaymentId: `pi_${randomUUID()}`,
        createdAt: new Date('2020-07-01T10:00:00.000Z'),
    });
    const newestTransactionId = await createTransaction({
        accountId,
        amount: 1000,
        currency: 'eur',
        status: 'completed',
        stripePaymentId: `pi_${randomUUID()}`,
        createdAt: new Date('2030-07-02T10:00:00.000Z'),
    });

    const oldestIssues = await getBillingReconciliationIssues({
        limit: 1,
        sort: 'oldest',
    });
    const newestIssues = await getBillingReconciliationIssues({
        limit: 1,
        sort: 'newest',
    });

    assert.equal(
        oldestIssues.transactionsWithoutInvoices[0]?.id,
        oldestTransactionId,
    );
    assert.equal(
        newestIssues.transactionsWithoutInvoices[0]?.id,
        newestTransactionId,
    );
});

test('getBillingReconciliationIssues suppresses failed email logs after a later active retry', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const invoiceId = await createPaidInvoice({ accountId });
    const deliveryKey = `billing-documents:invoice:${invoiceId}`;

    const failedEmail = await createEmailMessageLog({
        fromAddress: 'suncokret@obavijesti.gredice.com',
        subject: 'Gredice - dokumenti narudžbe',
        templateName: 'commerce-billing-documents',
        messageType: 'commerce',
        recipients: { to: [{ address: 'kupac@example.test' }] },
        metadata: {
            billingDeliveryKey: deliveryKey,
            invoiceId,
        },
        status: 'failed',
    });
    await updateEmailMessageLog(failedEmail.id, {
        createdAt: new Date('2026-07-01T10:00:00.000Z'),
        errorMessage: 'Temporary ACS outage',
    });

    const sentEmail = await createEmailMessageLog({
        fromAddress: 'suncokret@obavijesti.gredice.com',
        subject: 'Gredice - dokumenti narudžbe',
        templateName: 'commerce-billing-documents',
        messageType: 'commerce',
        recipients: { to: [{ address: 'kupac@example.test' }] },
        metadata: {
            billingDeliveryKey: deliveryKey,
            invoiceId,
        },
        status: 'sent',
    });
    await updateEmailMessageLog(sentEmail.id, {
        createdAt: new Date('2026-07-01T10:05:00.000Z'),
        sentAt: new Date('2026-07-01T10:05:00.000Z'),
    });

    const issues = await getBillingReconciliationIssues({ limit: 100 });

    assert.equal(
        issues.failedBillingDocumentEmails.some(
            (emailIssue) => emailIssue.invoiceId === invoiceId,
        ),
        false,
    );
    assert.equal(
        issues.missingBillingDocumentEmails.some(
            (emailIssue) => emailIssue.invoiceId === invoiceId,
        ),
        false,
    );
});
