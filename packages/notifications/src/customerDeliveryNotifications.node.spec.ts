import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type {
    DeliveryRunExceptionOutcome,
    DeliveryRunExceptionReason,
} from '@gredice/storage';
import {
    buildCustomerDeliveryTrackerLink,
    createCustomerDeliveryNotificationContent,
    customerDeliveryExceptionCopy,
    customerDeliveryNotificationCatalog,
    customerDeliveryNotificationCopy,
    customerDeliveryNotificationLimits,
    customerDeliveryTrackerOrigin,
} from './customerDeliveryNotifications';
import {
    type DeliveryLifecycleEvent,
    type DeliveryLifecycleMilestone,
    deliveryLifecycleMilestones,
} from './deliveryLifecycle';

const requestId = '018f0d12-2ec4-7fab-9d91-91f890ad5d73';

const eventBase = {
    accountId: 'account-private-sentinel',
    eventVersion: 1,
    idempotencyKey: 'delivery-lifecycle-private-sentinel',
    occurredAt: '2026-07-16T10:00:00.000Z',
    requestId,
    retryAttempt: 0,
    runId: 'run-private-sentinel',
    source: {
        id: 'source-private-sentinel',
        kind: 'run-state',
        version: 1,
    },
    stopId: 'stop-private-sentinel',
} as const;

function milestoneEvent(
    milestone: Exclude<DeliveryLifecycleMilestone, 'exception'>,
): DeliveryLifecycleEvent {
    return { ...eventBase, milestone };
}

function exceptionEvent(exception: {
    outcome: DeliveryRunExceptionOutcome;
    reason: DeliveryRunExceptionReason;
}): DeliveryLifecycleEvent {
    return { ...eventBase, exception, milestone: 'exception' };
}

const exceptionOutcomes = ['deferred', 'failed', 'cancelled'] as const;
const exceptionReasons = [
    'customer-unavailable',
    'address-inaccessible',
    'address-wrong',
    'harvest-damaged',
    'harvest-missing',
    'cancellation',
    'operational-other',
] as const;

describe('customer delivery notification catalog', () => {
    test('defines bounded Croatian copy for every lifecycle milestone', () => {
        assert.deepEqual(
            Object.keys(customerDeliveryNotificationCatalog).sort(),
            [...deliveryLifecycleMilestones].sort(),
        );

        for (const milestone of deliveryLifecycleMilestones) {
            const copy = customerDeliveryNotificationCatalog[milestone];
            assert.ok(copy.title.length > 0);
            assert.ok(copy.body.length > 0);
            assert.ok(copy.actionLabel.length > 0);
            assert.ok(
                copy.title.length <=
                    customerDeliveryNotificationLimits.titleCharacters,
            );
            assert.ok(
                copy.body.length <=
                    customerDeliveryNotificationLimits.bodyCharacters,
            );
            assert.ok(
                copy.actionLabel.length <=
                    customerDeliveryNotificationLimits.actionLabelCharacters,
            );
        }
    });

    test('uses the established informal singular delivery voice', () => {
        assert.deepEqual(customerDeliveryNotificationCatalog, {
            'route-started': {
                actionLabel: 'Prati dostavu',
                body: 'Tvoj je urod preuzet i uključen u dostavnu rutu. Prati status dostave u aplikaciji.',
                title: 'Urod je uključen u dostavnu rutu',
            },
            'near-arrival': {
                actionLabel: 'Prati dostavu',
                body: 'Vozač se približava odredištu tvoje dostave. Prati aktualni status dostave.',
                title: 'Vozač je blizu',
            },
            'next-stop': {
                actionLabel: 'Prati dostavu',
                body: 'Tvoja je dostava sljedeća na ruti. Pripremi se za preuzimanje uroda.',
                title: 'Tvoja dostava je sljedeća',
            },
            delayed: {
                actionLabel: 'Prati dostavu',
                body: 'Dostava kasni u odnosu na planirano vrijeme. Prati ažurirani status u aplikaciji.',
                title: 'Dostava kasni',
            },
            arrived: {
                actionLabel: 'Prikaži dostavu',
                body: 'Vozač je stigao na odredište tvoje dostave. Preuzmi svoj urod.',
                title: 'Vozač je stigao',
            },
            delivered: {
                actionLabel: 'Prikaži dostavu',
                body: 'Tvoj je urod označen kao dostavljen.',
                title: 'Urod je dostavljen',
            },
            exception: {
                actionLabel: 'Prikaži dostavu',
                body: 'Dogodila se promjena u dostavi. Otvori dostavu za trenutačni status.',
                title: 'Promjena u dostavi',
            },
            recovery: {
                actionLabel: 'Prati dostavu',
                body: 'Planiran je novi pokušaj dostave. Prati aktualni status u aplikaciji.',
                title: 'Dostava se nastavlja',
            },
        });
    });

    test('maps every milestone into channel-ready content', () => {
        for (const milestone of deliveryLifecycleMilestones) {
            const event =
                milestone === 'exception'
                    ? exceptionEvent({
                          outcome: 'deferred',
                          reason: 'customer-unavailable',
                      })
                    : milestoneEvent(milestone);
            const content = createCustomerDeliveryNotificationContent(event);
            assert.equal(content.milestone, milestone);
            assert.equal(
                content.trackerUrl,
                `${customerDeliveryTrackerOrigin}/?delivery=${requestId}`,
            );
            assert.ok(content.title.length > 0);
            assert.ok(content.body.length > 0);
            assert.ok(content.actionLabel.length > 0);
        }
    });

    test('builds one deterministic tracker link on the trusted production origin', () => {
        const opaqueId = 'request:opaque_1~revision-2';
        const first = buildCustomerDeliveryTrackerLink(opaqueId);
        const replay = buildCustomerDeliveryTrackerLink(opaqueId);
        const parsed = new URL(first);

        assert.equal(first, replay);
        assert.equal(parsed.origin, customerDeliveryTrackerOrigin);
        assert.equal(parsed.protocol, 'https:');
        assert.equal(parsed.pathname, '/');
        assert.deepEqual([...parsed.searchParams.keys()], ['delivery']);
        assert.equal(parsed.searchParams.get('delivery'), opaqueId);
        assert.equal(parsed.hash, '');

        for (const invalid of [
            '',
            ' ',
            ' leading-space',
            'request/with/path',
            'request?redirect=https://evil.example',
            'x'.repeat(
                customerDeliveryNotificationLimits.requestIdCharacters + 1,
            ),
        ]) {
            assert.throws(
                () => buildCustomerDeliveryTrackerLink(invalid),
                /bounded opaque identifier/,
            );
        }
        for (const invalid of [null, 123]) {
            assert.throws(
                () =>
                    Reflect.apply(buildCustomerDeliveryTrackerLink, undefined, [
                        invalid,
                    ]),
                /bounded opaque identifier/,
            );
        }
    });

    test('maps every bounded exception outcome and reason without raw fallback copy', () => {
        for (const outcome of exceptionOutcomes) {
            for (const reason of exceptionReasons) {
                const copy = customerDeliveryExceptionCopy({
                    outcome,
                    reason,
                });
                assert.ok(copy.title.length > 0);
                assert.ok(copy.body.length > 0);
                assert.doesNotMatch(copy.body, /customer-|address-|harvest-/);
                assert.equal(copy.actionLabel, 'Prikaži dostavu');
            }
        }

        assert.deepEqual(
            customerDeliveryExceptionCopy({
                outcome: 'deferred',
                reason: 'customer-unavailable',
            }),
            {
                actionLabel: 'Prikaži dostavu',
                body: 'Vozač te nije uspio kontaktirati. Planirat ćemo novi pokušaj i obavijestiti te.',
                title: 'Dostava je odgođena',
            },
        );
        assert.deepEqual(
            customerDeliveryExceptionCopy({
                outcome: 'cancelled',
                reason: 'cancellation',
            }),
            {
                actionLabel: 'Prikaži dostavu',
                body: 'Dostava je otkazana. Otvori dostavu za trenutačni status.',
                title: 'Dostava je otkazana',
            },
        );

        assert.throws(
            () =>
                Reflect.apply(customerDeliveryExceptionCopy, undefined, [
                    {
                        outcome: 'raw-outcome',
                        reason: 'raw-reason',
                    },
                ]),
            /bounded values/,
        );
    });

    test('does not project private event fields or unbounded metadata into copy', () => {
        const privateSentinel = 'PRIVATE_CUSTOMER_SENTINEL_8675309';
        const eventWithUntrustedMetadata = {
            ...exceptionEvent({
                outcome: 'failed',
                reason: 'operational-other',
            }),
            address: privateSentinel,
            email: privateSentinel,
            lat: privateSentinel,
            latitude: privateSentinel,
            lng: privateSentinel,
            longitude: privateSentinel,
            metadata: { value: privateSentinel },
            notes: privateSentinel,
            phone: privateSentinel,
            rawMetadata: { value: privateSentinel },
        };
        const copy = Reflect.apply(
            customerDeliveryNotificationCopy,
            undefined,
            [eventWithUntrustedMetadata],
        );
        const content = Reflect.apply(
            createCustomerDeliveryNotificationContent,
            undefined,
            [eventWithUntrustedMetadata],
        );
        const serializedCopy = JSON.stringify(copy);
        const serializedContent = JSON.stringify(content);

        assert.deepEqual(Object.keys(copy).sort(), [
            'actionLabel',
            'body',
            'title',
        ]);
        assert.deepEqual(Object.keys(content).sort(), [
            'actionLabel',
            'body',
            'milestone',
            'title',
            'trackerUrl',
        ]);
        for (const forbidden of [
            privateSentinel,
            'lat',
            'lng',
            'latitude',
            'longitude',
            'address',
            'email',
            'phone',
            'notes',
            'metadata',
            'rawMetadata',
            eventBase.accountId,
            eventBase.runId,
            eventBase.stopId,
            eventBase.source.id,
            eventBase.idempotencyKey,
        ]) {
            assert.equal(serializedCopy.includes(forbidden), false);
            assert.equal(serializedContent.includes(forbidden), false);
        }
    });
});
