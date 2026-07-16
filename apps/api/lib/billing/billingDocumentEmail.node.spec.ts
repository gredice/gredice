import assert from 'node:assert/strict';
import test from 'node:test';
import type { SelectEmailMessage } from '@gredice/storage';
import type { sendBillingDocuments } from '../email/transactional';
import {
    billingDocumentDeliveryKey,
    notifyBillingDocumentsEmail,
} from './billingDocumentEmail';

const date = new Date('2026-07-05T10:00:00.000Z');

type SendBillingDocumentsArgs = Parameters<typeof sendBillingDocuments>;

function emailSendResponse(): Awaited<ReturnType<typeof sendBillingDocuments>> {
    return {
        id: 'test-email-operation',
        status: 'Succeeded',
    };
}

function emailMessage(
    overrides: Partial<SelectEmailMessage> = {},
): SelectEmailMessage {
    return {
        id: 123,
        provider: 'acs',
        providerMessageId: null,
        status: 'sent',
        providerStatus: null,
        fromAddress: 'suncokret@obavijesti.gredice.com',
        subject: 'Gredice - dokumenti narudžbe',
        templateName: 'commerce-billing-documents',
        messageType: 'commerce',
        recipients: {
            to: [{ address: 'kupac@example.test' }],
        },
        attachments: [],
        metadata: {},
        htmlBody: null,
        textBody: null,
        errorCode: null,
        errorMessage: null,
        queuedAt: date,
        sentAt: date,
        completedAt: date,
        createdAt: date,
        updatedAt: date,
        lastAttemptAt: null,
        bouncedAt: null,
        ...overrides,
    };
}

test('notifyBillingDocumentsEmail skips missing recipient', async () => {
    let sendCount = 0;
    const result = await notifyBillingDocumentsEmail(
        {
            invoiceId: 42,
            invoiceNumber: 'PON-2026-0042',
            to: ' ',
        },
        {
            getEmailMessageByTemplateAndMetadata: async () => undefined,
            sendBillingDocuments: async () => {
                sendCount += 1;
                return emailSendResponse();
            },
        },
    );

    assert.deepEqual(result, {
        status: 'skipped',
        reason: 'missing_recipient',
    });
    assert.equal(sendCount, 0);
});

test('notifyBillingDocumentsEmail skips active duplicate delivery log', async () => {
    let sendCount = 0;
    const result = await notifyBillingDocumentsEmail(
        {
            invoiceId: 42,
            invoiceNumber: 'PON-2026-0042',
            to: 'kupac@example.test',
        },
        {
            getEmailMessageByTemplateAndMetadata: async () =>
                emailMessage({ id: 123 }),
            sendBillingDocuments: async () => {
                sendCount += 1;
                return emailSendResponse();
            },
        },
    );

    assert.deepEqual(result, {
        status: 'skipped',
        reason: 'already_sent',
        emailMessageId: 123,
    });
    assert.equal(sendCount, 0);
});

test('notifyBillingDocumentsEmail sends invoice and receipt links with idempotency metadata', async () => {
    const sends: SendBillingDocumentsArgs[] = [];
    const lookups: unknown[] = [];
    const result = await notifyBillingDocumentsEmail(
        {
            cartIds: [100],
            checkoutSessionId: 'cs_paid',
            invoiceId: 42,
            invoiceNumber: 'PON-2026-0042',
            receiptId: 77,
            receiptNumber: '2026-77',
            to: 'kupac@example.test',
        },
        {
            getEmailMessageByTemplateAndMetadata: async (query) => {
                lookups.push(query);
                return undefined;
            },
            sendBillingDocuments: async (...args: SendBillingDocumentsArgs) => {
                sends.push(args);
                return emailSendResponse();
            },
        },
    );

    assert.deepEqual(result, { status: 'sent' });
    assert.deepEqual(lookups, [
        {
            metadataKey: 'billingDeliveryKey',
            metadataValue: billingDocumentDeliveryKey(42),
            statuses: ['queued', 'sending', 'sent'],
            templateName: 'commerce-billing-documents',
        },
    ]);
    assert.equal(sends.length, 1);
    assert.equal(sends[0]?.[0], 'kupac@example.test');
    assert.match(
        sends[0]?.[1].invoiceUrl ?? '',
        /\/api\/accounts\/current\/billing\/invoices\/42\/document$/,
    );
    assert.match(
        sends[0]?.[1].receiptUrl ?? '',
        /\/api\/accounts\/current\/billing\/receipts\/77\/document$/,
    );
    assert.deepEqual(sends[0]?.[2], {
        billingDeliveryKey: billingDocumentDeliveryKey(42),
        cartIds: [100],
        checkoutSessionId: 'cs_paid',
        invoiceId: 42,
        receiptId: 77,
    });
});

test('notifyBillingDocumentsEmail reports send failures without throwing', async () => {
    const result = await notifyBillingDocumentsEmail(
        {
            invoiceId: 42,
            invoiceNumber: 'PON-2026-0042',
            to: 'kupac@example.test',
        },
        {
            getEmailMessageByTemplateAndMetadata: async () => undefined,
            sendBillingDocuments: async () => {
                throw new Error('acs offline');
            },
        },
    );

    assert.deepEqual(result, {
        status: 'failed',
        message: 'acs offline',
    });
});
