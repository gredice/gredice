import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createEmailMessageLog,
    getEmailMessageByTemplateAndMetadata,
} from '@gredice/storage';
import { createTestDb } from './testDb';

test('getEmailMessageByTemplateAndMetadata filters active billing delivery logs', async () => {
    createTestDb();
    const deliveryKey = 'billing-documents:invoice:42';

    await createEmailMessageLog({
        fromAddress: 'suncokret@obavijesti.gredice.com',
        subject: 'Gredice - dokumenti narudžbe',
        templateName: 'commerce-billing-documents',
        messageType: 'commerce',
        recipients: { to: [{ address: 'kupac@example.test' }] },
        metadata: { billingDeliveryKey: deliveryKey },
        status: 'failed',
    });

    assert.equal(
        await getEmailMessageByTemplateAndMetadata({
            metadataKey: 'billingDeliveryKey',
            metadataValue: deliveryKey,
            statuses: ['queued', 'sending', 'sent'],
            templateName: 'commerce-billing-documents',
        }),
        undefined,
    );

    const sent = await createEmailMessageLog({
        fromAddress: 'suncokret@obavijesti.gredice.com',
        subject: 'Gredice - dokumenti narudžbe',
        templateName: 'commerce-billing-documents',
        messageType: 'commerce',
        recipients: { to: [{ address: 'kupac@example.test' }] },
        metadata: { billingDeliveryKey: deliveryKey },
        status: 'sent',
    });

    const found = await getEmailMessageByTemplateAndMetadata({
        metadataKey: 'billingDeliveryKey',
        metadataValue: deliveryKey,
        statuses: ['queued', 'sending', 'sent'],
        templateName: 'commerce-billing-documents',
    });

    assert.equal(found?.id, sent.id);
});
