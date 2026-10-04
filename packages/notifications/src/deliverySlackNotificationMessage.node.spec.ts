import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDeliverySlackNotificationMessage } from './deliverySlackNotificationMessage';

test('preserves the existing single delivery request Slack message', () => {
    const message = buildDeliverySlackNotificationMessage(
        [
            {
                id: 'request-1',
                operationName: 'Berba rajcice',
                farmName: 'Farma Zagreb',
                locationDescription: 'vrt Istok · gredica 12 · polje 3',
                slotStartAt: new Date('2026-08-06T08:00:00.000Z'),
                mode: 'delivery',
                status: 'preparing',
            },
        ],
        'updated',
    );

    assert.equal(
        message,
        [
            ':package: *Ažuriran zahtjev za dostavu*',
            '• ID zahtjeva: request-1',
            '• Radnja: Berba rajcice',
            '• Farma: Farma Zagreb',
            '• Lokacija: vrt Istok · gredica 12 · polje 3',
            `• Termin: ${new Intl.DateTimeFormat('hr-HR', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(new Date('2026-08-06T08:00:00.000Z'))}`,
            '• Način: Dostava',
            '• Status: preparing',
        ].join('\n'),
    );
});

test('builds one message for a delivery group and summarizes mixed statuses', () => {
    const slot = new Date('2026-08-06T08:00:00.000Z');
    const message = buildDeliverySlackNotificationMessage(
        [
            {
                id: 'request-1',
                operationName: 'Berba rajcice',
                farmName: 'Farma Zagreb',
                locationDescription: 'gredica 12 · polje 1',
                slotStartAt: slot,
                mode: 'delivery',
                status: 'preparing',
            },
            {
                id: 'request-2',
                operationName: 'Berba paprike',
                farmName: 'Farma Zagreb',
                locationDescription: 'gredica 12 · polje 2',
                slotStartAt: slot,
                mode: 'delivery',
                status: 'preparing',
            },
            {
                id: 'request-3',
                operationName: 'Berba salate',
                farmName: 'Farma Zagreb',
                locationDescription: 'gredica 13 · polje 1',
                slotStartAt: slot,
                mode: 'delivery',
                status: 'fulfilled',
            },
        ],
        'updated',
    );

    assert.match(
        message ?? '',
        /^:package: \*Ažurirana grupa zahtjeva za dostavu\*/,
    );
    assert.match(message ?? '', /• Broj zahtjeva: 3/);
    assert.match(message ?? '', /• Farma: Farma Zagreb/);
    assert.match(message ?? '', /• Način: Dostava/);
    assert.match(message ?? '', /• Statusi: preparing \(2\), fulfilled/);
    assert.match(
        message ?? '',
        /◦ request-2 — Berba paprike · gredica 12 · polje 2/,
    );
});

test('does not build a Slack message for an empty request collection', () => {
    assert.equal(
        buildDeliverySlackNotificationMessage([], 'updated'),
        undefined,
    );
});
