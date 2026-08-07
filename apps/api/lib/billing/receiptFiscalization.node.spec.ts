import assert from 'node:assert/strict';
import test from 'node:test';
import {
    fiscalizeReceipt,
    issueReceiptForPaidInvoice,
} from '@gredice/fiscalization/server';
import type {
    getAllFiscalizationSettings,
    getFiscalizationUserSettings,
    getReceipt,
    updateReceiptFiscalization,
} from '@gredice/storage';

const date = new Date('2026-07-05T10:00:00.000Z');

type ReceiptRecord = NonNullable<Awaited<ReturnType<typeof getReceipt>>>;
type FiscalizationSettings = Awaited<
    ReturnType<typeof getAllFiscalizationSettings>
>;
type FiscalizationUserSettings = NonNullable<
    Awaited<ReturnType<typeof getFiscalizationUserSettings>>
>;
type FiscalizationPosSettings = NonNullable<
    FiscalizationSettings['posSettings']
>;
type UpdateReceiptFiscalizationArgs = Parameters<
    typeof updateReceiptFiscalization
>;

function receipt(overrides: Partial<ReceiptRecord> = {}): ReceiptRecord {
    return {
        id: 77,
        invoiceId: 42,
        receiptNumber: '7',
        yearReceiptNumber: '2026-7',
        subtotal: '25.00',
        taxAmount: '0.00',
        totalAmount: '25.00',
        currency: 'eur',
        paymentMethod: 'card',
        paymentReference: 'cs_paid',
        jir: null,
        zki: null,
        cisStatus: 'pending',
        cisReference: null,
        cisErrorMessage: null,
        cisTimestamp: null,
        cisResponse: 'previous debug',
        issuedAt: date,
        businessPin: null,
        businessName: 'Gredice d.o.o.',
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

function userSettings(
    overrides: Partial<FiscalizationUserSettings> = {},
): FiscalizationUserSettings {
    return {
        id: 1,
        pin: '12345678901',
        useVat: true,
        environment: 'educ',
        certBase64: Buffer.from('cert').toString('base64'),
        certPassword: 'secret',
        receiptNumberOnDevice: false,
        isActive: true,
        createdAt: date,
        updatedAt: date,
        isDeleted: false,
        ...overrides,
    };
}

function posSettings(
    overrides: Partial<FiscalizationPosSettings> = {},
): FiscalizationPosSettings {
    return {
        id: 1,
        name: 'Web checkout',
        posId: '1',
        premiseId: 'WEB',
        isActive: true,
        createdAt: date,
        updatedAt: date,
        isDeleted: false,
        ...overrides,
    };
}

test('issueReceiptForPaidInvoice fills business settings and delegates idempotent issuing', async () => {
    const calls: unknown[] = [];

    const result = await issueReceiptForPaidInvoice(
        {
            invoiceId: 42,
            paymentReference: 'cs_paid',
        },
        {
            getFiscalizationUserSettings: async () => userSettings(),
            ensureReceiptForInvoice: async (...args: unknown[]) => {
                calls.push(args);
                return {
                    status: 'created',
                    receiptId: 77,
                    receiptNumber: '7',
                    yearReceiptNumber: '2026-7',
                };
            },
        },
    );

    assert.equal(result.status, 'created');
    assert.deepEqual(calls, [
        [
            42,
            {
                issuedAt: undefined,
                paymentMethod: 'card',
                paymentReference: 'cs_paid',
                businessPin: '12345678901',
                businessName: 'Gredice d.o.o.',
                businessAddress:
                    'Ulica Julija Knifera 3, 10000 Zagreb, Hrvatska',
            },
        ],
    ]);
});

test('fiscalizeReceipt records missing fiscalization settings as failed', async () => {
    const updates: UpdateReceiptFiscalizationArgs[] = [];

    const result = await fiscalizeReceipt(77, {
        getReceipt: async () => receipt(),
        getAllFiscalizationSettings: async () => ({
            userSettings: null,
            posSettings: null,
        }),
        receiptRequest: async () => {
            throw new Error('should not call CIS');
        },
        updateReceiptFiscalization: async (
            ...args: UpdateReceiptFiscalizationArgs
        ) => {
            updates.push(args);
        },
    });

    assert.equal(result.status, 'failed');
    assert.ok('reason' in result);
    assert.equal(result.reason, 'missing_user_settings');
    assert.deepEqual(updates, [
        [
            77,
            {
                zki: undefined,
                cisStatus: 'failed',
                cisErrorMessage:
                    'Fiscalization user settings not found for account.',
                cisTimestamp: updates[0]?.[1]?.cisTimestamp,
                cisResponse: 'previous debug',
            },
        ],
    ]);
});

test('fiscalizeReceipt records CIS rejection response', async () => {
    const updates: UpdateReceiptFiscalizationArgs[] = [];

    const result = await fiscalizeReceipt(77, {
        getReceipt: async () => receipt(),
        getAllFiscalizationSettings: async () => ({
            userSettings: userSettings(),
            posSettings: posSettings(),
        }),
        receiptRequest: async () => ({
            success: false,
            zki: 'zki-failed',
            responseText: '<xml>failed</xml>',
            errors: [{ errorMessage: 'CIS says no' }],
        }),
        updateReceiptFiscalization: async (
            ...args: UpdateReceiptFiscalizationArgs
        ) => {
            updates.push(args);
        },
    });

    assert.equal(result.status, 'failed');
    assert.ok('reason' in result);
    assert.equal(result.reason, 'cis_rejected');
    assert.equal(updates[0]?.[1]?.zki, 'zki-failed');
    assert.equal(updates[0]?.[1]?.cisResponse, '<xml>failed</xml>');
    assert.equal(updates[0]?.[1]?.cisErrorMessage, 'CIS says no');
});

test('fiscalizeReceipt records successful confirmation', async () => {
    const updates: UpdateReceiptFiscalizationArgs[] = [];

    const result = await fiscalizeReceipt(77, {
        getReceipt: async () => receipt(),
        getAllFiscalizationSettings: async () => ({
            userSettings: userSettings(),
            posSettings: posSettings(),
        }),
        receiptRequest: async () => ({
            success: true,
            dateTime: date,
            receiptNumber: '7',
            jir: 'jir-123',
            zki: 'zki-123',
            responseText: '<xml>ok</xml>',
        }),
        updateReceiptFiscalization: async (
            ...args: UpdateReceiptFiscalizationArgs
        ) => {
            updates.push(args);
        },
    });

    assert.deepEqual(result, {
        status: 'confirmed',
        receiptId: 77,
        receiptNumber: '7',
        jir: 'jir-123',
        zki: 'zki-123',
    });
    assert.deepEqual(updates, [
        [
            77,
            {
                jir: 'jir-123',
                zki: 'zki-123',
                cisTimestamp: date,
                cisStatus: 'confirmed',
                cisErrorMessage: null,
                cisReference: '7',
                cisResponse: '<xml>ok</xml>',
            },
        ],
    ]);
});

test('fiscalizeReceipt returns existing confirmed receipt without calling CIS', async () => {
    let requestCount = 0;

    const result = await fiscalizeReceipt(77, {
        getReceipt: async () =>
            receipt({
                cisStatus: 'confirmed',
                jir: 'jir-123',
                zki: 'zki-123',
            }),
        getAllFiscalizationSettings: async () => ({
            userSettings: null,
            posSettings: null,
        }),
        receiptRequest: async () => {
            requestCount += 1;
            throw new Error('should not call CIS');
        },
        updateReceiptFiscalization: async () => undefined,
    });

    assert.equal(result.status, 'existing');
    assert.equal(requestCount, 0);
});
