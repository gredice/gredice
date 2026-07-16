import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type CustomerDeliveryNotificationEvent,
    createCustomerDeliveryNotificationContent,
    type DeliveryLifecycleMilestone,
} from '@gredice/notifications/customer-delivery';
import { createElement } from 'react';
import DeliveryCancelledEmailTemplate from '../emails/Notifications/delivery-cancelled';
import DeliveryLifecycleUpdateEmailTemplate from '../emails/Notifications/delivery-lifecycle-update';
import DeliveryReadyEmailTemplate from '../emails/Notifications/delivery-ready';
import DeliveryScheduledEmailTemplate from '../emails/Notifications/delivery-scheduled';
import DeliverySurveyEmailTemplate from '../emails/Notifications/delivery-survey';
import { assertHtmlIncludes, renderNonEmpty } from './renderEmail';

const lifecycleRequestId = '018f0d12-2ec4-7fab-9d91-91f890ad5d73';

const lifecycleMilestones = [
    'route-started',
    'near-arrival',
    'next-stop',
    'delayed',
    'arrived',
    'delivered',
    'exception',
    'recovery',
] as const satisfies readonly DeliveryLifecycleMilestone[];

const lifecycleEventBase = {
    accountId: 'account-email-private',
    eventVersion: 1,
    idempotencyKey: 'delivery-lifecycle-email-private',
    occurredAt: '2026-07-16T10:00:00.000Z',
    requestId: lifecycleRequestId,
    retryAttempt: 0,
    runId: 'run-email-private',
    source: {
        id: 'source-email-private',
        kind: 'run-state',
        version: 1,
    },
    stopId: 'stop-email-private',
} as const;

function lifecycleEvent(
    milestone: DeliveryLifecycleMilestone,
): CustomerDeliveryNotificationEvent {
    if (milestone === 'exception') {
        return {
            ...lifecycleEventBase,
            exception: {
                outcome: 'deferred',
                reason: 'customer-unavailable',
            },
            milestone,
        };
    }
    return { ...lifecycleEventBase, milestone };
}

test('delivery-scheduled renders with delivery details', async () => {
    const deliveryWindow = '15. lipnja 2026. od 10:00 do 12:00';
    const manageUrl = 'https://example.test/delivery-scheduled';
    const html = await renderNonEmpty(
        createElement(DeliveryScheduledEmailTemplate, {
            addressLine: 'Testna ulica 12',
            contactName: 'Luka',
            deliveryWindow,
            email: 'scheduled@example.test',
            manageUrl,
        }),
    );

    assertHtmlIncludes(html, deliveryWindow);
    assertHtmlIncludes(html, manageUrl);
});

test('delivery-ready renders with ready items and delivery details', async () => {
    const deliveryWindow = '16. lipnja 2026. od 14:00 do 16:00';
    const manageUrl = 'https://example.test/delivery-ready';
    const readyItem = 'Testna rajcica';
    const html = await renderNonEmpty(
        createElement(DeliveryReadyEmailTemplate, {
            addressLine: 'Probna avenija 3',
            contactName: 'Ana',
            deliveryWindow,
            email: 'ready@example.test',
            manageUrl,
            readyItems: [readyItem, 'Testna salata'],
        }),
    );

    assertHtmlIncludes(html, deliveryWindow);
    assertHtmlIncludes(html, manageUrl);
    assertHtmlIncludes(html, readyItem);
});

test('delivery-cancelled renders with the cancelled delivery details', async () => {
    const deliveryWindow = '17. lipnja 2026. od 09:00 do 11:00';
    const manageUrl = 'https://example.test/delivery-cancelled';
    const html = await renderNonEmpty(
        createElement(DeliveryCancelledEmailTemplate, {
            addressLine: 'Primjer cesta 4',
            contactName: 'Iva',
            deliveryWindow,
            email: 'cancelled@example.test',
            manageUrl,
        }),
    );

    assertHtmlIncludes(html, deliveryWindow);
    assertHtmlIncludes(html, manageUrl);
});

test('delivery-survey renders with the survey URL and period', async () => {
    const deliveryPeriod = 'probnog lipnja';
    const surveyUrl = 'https://example.test/delivery-survey';
    const html = await renderNonEmpty(
        createElement(DeliverySurveyEmailTemplate, {
            deliveryCount: 3,
            deliveryPeriod,
            email: 'survey@example.test',
            surveyUrl,
        }),
    );

    assertHtmlIncludes(html, deliveryPeriod);
    assertHtmlIncludes(html, surveyUrl);
});

for (const milestone of lifecycleMilestones) {
    test(`delivery-lifecycle-update renders the ${milestone} catalog fixture`, async () => {
        const event = lifecycleEvent(milestone);
        const content = createCustomerDeliveryNotificationContent(event);
        const html = await renderNonEmpty(
            createElement(DeliveryLifecycleUpdateEmailTemplate, {
                email: 'lifecycle@example.test',
                event,
            }),
        );

        assertHtmlIncludes(html, content.title);
        assertHtmlIncludes(html, content.body);
        assertHtmlIncludes(html, content.actionLabel);
        assertHtmlIncludes(html, content.trackerUrl);
    });
}

test('delivery-lifecycle-update excludes private event and route metadata', async () => {
    const privateSentinel = 'PRIVATE_EMAIL_DELIVERY_SENTINEL_8675309';
    const event = {
        ...lifecycleEvent('exception'),
        address: privateSentinel,
        email: privateSentinel,
        lat: privateSentinel,
        lng: privateSentinel,
        metadata: { value: privateSentinel },
        notes: privateSentinel,
        phone: privateSentinel,
    };
    const html = await renderNonEmpty(
        createElement(DeliveryLifecycleUpdateEmailTemplate, {
            email: 'lifecycle@example.test',
            event,
        }),
    );

    for (const forbidden of [
        privateSentinel,
        lifecycleEventBase.accountId,
        lifecycleEventBase.runId,
        lifecycleEventBase.stopId,
        lifecycleEventBase.source.id,
        lifecycleEventBase.idempotencyKey,
    ]) {
        assert.equal(html.includes(forbidden), false);
    }
    assertHtmlIncludes(
        html,
        `https://dostava.gredice.com/?delivery=${lifecycleRequestId}`,
    );
});
