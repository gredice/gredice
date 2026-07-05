import assert from 'node:assert/strict';
import test from 'node:test';
import type { MiddlewareHandler } from 'hono';
import {
    type AccountBillingRouteDeps,
    createAccountBillingRoutes,
    createTestAuthMiddleware,
} from '../../app/api/[...route]/accountBillingRoutes';
import type { AuthVariables } from '../hono/authValidator';

const date = new Date('2026-07-05T10:15:00.000Z');

function receipt(overrides: Record<string, unknown> = {}) {
    return {
        id: 20,
        invoiceId: 10,
        receiptNumber: '5',
        yearReceiptNumber: '2026-5',
        subtotal: '25.00',
        taxAmount: '0.00',
        totalAmount: '25.00',
        currency: 'eur',
        paymentMethod: 'card',
        paymentReference: 'cs_test',
        jir: 'jir-123',
        zki: 'zki-456',
        cisStatus: 'confirmed',
        cisReference: null,
        cisErrorMessage: 'internal failure detail',
        cisTimestamp: date,
        cisResponse: '{"secret":"debug"}',
        issuedAt: date,
        businessPin: null,
        businessName: 'Gredice',
        businessAddress: 'Zagreb',
        customerPin: null,
        customerName: null,
        customerAddress: null,
        createdAt: date,
        updatedAt: date,
        isDeleted: false,
        invoice: null,
        ...overrides,
    };
}

function invoice(overrides: Record<string, unknown> = {}) {
    return {
        id: 10,
        invoiceNumber: 'PON-2026-0005',
        accountId: 'account-1',
        transactionId: 30,
        subtotal: '25.00',
        taxAmount: '0.00',
        totalAmount: '25.00',
        currency: 'eur',
        status: 'paid',
        issueDate: date,
        dueDate: date,
        paidDate: date,
        billToName: 'Kupac',
        billToEmail: 'kupac@example.com',
        billToAddress: null,
        billToCity: null,
        billToState: null,
        billToZip: null,
        billToCountry: 'Hrvatska',
        notes: null,
        terms: null,
        createdAt: date,
        updatedAt: date,
        isDeleted: false,
        account: null,
        transaction: null,
        invoiceItems: [
            {
                id: 1,
                invoiceId: 10,
                description: 'Sadnja',
                quantity: '1.00',
                unitPrice: '25.00',
                totalPrice: '25.00',
                entityId: '42',
                entityTypeName: 'operation',
                createdAt: date,
                updatedAt: date,
            },
        ],
        receipt: receipt(),
        ...overrides,
    };
}

function unauthorizedAuth(): MiddlewareHandler<{ Variables: AuthVariables }> {
    return async (context) => {
        return context.json({ error: 'Unauthorized' }, 401);
    };
}

function deps(
    overrides: Partial<AccountBillingRouteDeps> = {},
): AccountBillingRouteDeps {
    return {
        authValidator: () =>
            createTestAuthMiddleware({ accountId: 'account-1' }),
        getAccountBillingInvoice: async () => invoice() as never,
        getAccountBillingInvoices: async () => [invoice()] as never,
        getAccountBillingReceipt: async () =>
            receipt({ invoice: invoice({ receipt: null }) }) as never,
        ...overrides,
    };
}

test('account billing routes reject unauthenticated requests before storage reads', async () => {
    let readCount = 0;
    const app = createAccountBillingRoutes(
        deps({
            authValidator: () => unauthorizedAuth(),
            getAccountBillingInvoices: async () => {
                readCount += 1;
                return [] as never;
            },
        }),
    );

    const response = await app.request('/invoices');

    assert.equal(response.status, 401);
    assert.equal(readCount, 0);
});

test('account billing document routes authenticate before validating params', async () => {
    let readCount = 0;
    const app = createAccountBillingRoutes(
        deps({
            authValidator: () => unauthorizedAuth(),
            getAccountBillingInvoice: async () => {
                readCount += 1;
                return undefined;
            },
        }),
    );

    const response = await app.request('/invoices/not-a-number/document');

    assert.equal(response.status, 401);
    assert.equal(readCount, 0);
});

test('account billing list serializes current-account invoice summaries', async () => {
    const seenAccountIds: string[] = [];
    const app = createAccountBillingRoutes(
        deps({
            getAccountBillingInvoices: async (accountId) => {
                seenAccountIds.push(accountId);
                return [invoice()] as never;
            },
        }),
    );

    const response = await app.request('/invoices');
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(seenAccountIds, ['account-1']);
    assert.equal(body.invoices[0].invoiceNumber, 'PON-2026-0005');
    assert.equal(
        body.invoices[0].documentUrl,
        'http://localhost/api/accounts/current/billing/invoices/10/document',
    );
    assert.equal(body.invoices[0].receipt.cisStatus, 'confirmed');
    assert.equal('cisResponse' in body.invoices[0].receipt, false);
    assert.equal('cisErrorMessage' in body.invoices[0].receipt, false);
});

test('account billing detail denies guessed cross-account invoice IDs', async () => {
    const calls: Array<{ accountId: string; invoiceId: number }> = [];
    const app = createAccountBillingRoutes(
        deps({
            getAccountBillingInvoice: async (accountId, invoiceId) => {
                calls.push({ accountId, invoiceId });
                return undefined;
            },
        }),
    );

    const response = await app.request('/invoices/999');

    assert.equal(response.status, 404);
    assert.deepEqual(calls, [{ accountId: 'account-1', invoiceId: 999 }]);
});

test('account billing document routes render customer-safe html', async () => {
    const app = createAccountBillingRoutes(deps());

    const invoiceResponse = await app.request('/invoices/10/document');
    const invoiceHtml = await invoiceResponse.text();
    const receiptResponse = await app.request('/receipts/20/document');
    const receiptHtml = await receiptResponse.text();

    assert.equal(invoiceResponse.status, 200);
    assert.match(
        invoiceResponse.headers.get('content-type') ?? '',
        /text\/html/,
    );
    assert.match(invoiceHtml, /PON-2026-0005/);
    assert.doesNotMatch(invoiceHtml, /\/admin\//);
    assert.equal(receiptResponse.status, 200);
    assert.match(receiptHtml, /2026-5/);
    assert.doesNotMatch(receiptHtml, /secret/);
    assert.doesNotMatch(receiptHtml, /\/admin\//);
});
