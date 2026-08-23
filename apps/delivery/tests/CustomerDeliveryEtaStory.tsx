import { CustomerDeliveryCard } from '../components/CustomerDeliveryCard';
import type { CustomerDeliveryRequestSummary } from '../lib/deliveryDashboardTypes';

const baseDelivery: CustomerDeliveryRequestSummary = {
    mode: 'delivery',
    lifecycle: 'active',
    requestId: 'customer-eta-4136',
    status: 'ready',
    statusLabel: 'U dostavi',
    requestNotes: 'Pozvoni na portafon.',
    slotStartAt: '2026-07-16T08:00:00.000Z',
    slotEndAt: '2026-07-16T10:00:00.000Z',
    eta: {
        source: 'traffic-route',
        calculatedAt: '2026-07-16T08:45:00.000Z',
        freshness: 'fresh',
        confidence: 'high',
        rangeStartAt: '2026-07-16T08:55:00.000Z',
        rangeEndAt: '2026-07-16T09:05:00.000Z',
        remainingMinSeconds: 600,
        remainingMaxSeconds: 1_200,
    },
    progress: {
        phase: 'next',
        stopsAhead: 0,
        delayed: false,
    },
    deliveredAt: null,
    harvest: {
        plantName: 'Rajčica ETA 4136',
        operationName: 'Berba',
        raisedBedName: 'Gredica 4',
        fieldName: 'Polje 2',
        tracePath: '/trag/customer-eta-4136',
    },
    destination: {
        recipientName: 'Korisnik Korina',
        address: 'Ilica 1, 10000 Zagreb, HR',
        addressLabel: 'Dom',
    },
    receipt: null,
    recovery: null,
    tracking: null,
    mapPath: null,
};

export function FreshCustomerEtaStory() {
    return <CustomerDeliveryCard delivery={baseDelivery} />;
}

export function FallbackCustomerEtaStory() {
    return (
        <CustomerDeliveryCard
            delivery={{
                ...baseDelivery,
                requestId: 'customer-fallback-4136',
                eta: {
                    source: 'promised-window',
                    calculatedAt: null,
                    freshness: 'fallback',
                    confidence: 'approximate',
                    rangeStartAt: baseDelivery.slotStartAt,
                    rangeEndAt: baseDelivery.slotEndAt,
                    remainingMinSeconds: 3_600,
                    remainingMaxSeconds: 10_800,
                },
                progress: {
                    phase: 'on-route',
                    stopsAhead: 3,
                    delayed: false,
                },
            }}
        />
    );
}

export function StaleCustomerEtaStory() {
    return (
        <CustomerDeliveryCard
            delivery={{
                ...baseDelivery,
                requestId: 'customer-stale-4136',
                eta: {
                    source: 'promised-window',
                    calculatedAt: '2026-07-16T09:57:00.000Z',
                    freshness: 'stale',
                    confidence: 'approximate',
                    rangeStartAt: baseDelivery.slotStartAt,
                    rangeEndAt: baseDelivery.slotEndAt,
                    remainingMinSeconds: 0,
                    remainingMaxSeconds: 1_800,
                },
                progress: {
                    phase: 'on-route',
                    stopsAhead: 2,
                    delayed: false,
                },
            }}
        />
    );
}

export function DelayedCustomerEtaStory() {
    return (
        <CustomerDeliveryCard
            delivery={{
                ...baseDelivery,
                requestId: 'customer-delayed-4136',
                eta: {
                    source: 'traffic-route',
                    calculatedAt: '2026-07-16T09:55:00.000Z',
                    freshness: 'fresh',
                    confidence: 'high',
                    rangeStartAt: '2026-07-16T10:10:00.000Z',
                    rangeEndAt: '2026-07-16T10:25:00.000Z',
                    remainingMinSeconds: 900,
                    remainingMaxSeconds: 1_800,
                },
                progress: {
                    phase: 'on-route',
                    stopsAhead: 1,
                    delayed: true,
                },
            }}
        />
    );
}

export function UnavailableCustomerEtaStory() {
    return (
        <CustomerDeliveryCard
            delivery={{
                ...baseDelivery,
                requestId: 'customer-unavailable-4136',
                slotStartAt: null,
                slotEndAt: null,
                eta: {
                    source: 'promised-window',
                    calculatedAt: null,
                    freshness: 'unavailable',
                    confidence: 'none',
                    rangeStartAt: null,
                    rangeEndAt: null,
                    remainingMinSeconds: null,
                    remainingMaxSeconds: null,
                },
                progress: {
                    phase: 'unavailable',
                    stopsAhead: null,
                    delayed: false,
                },
            }}
        />
    );
}

export function ExpiredCustomerEtaStory() {
    return (
        <CustomerDeliveryCard
            delivery={{
                ...baseDelivery,
                requestId: 'customer-expired-4136',
                eta: {
                    source: 'promised-window',
                    calculatedAt: null,
                    freshness: 'unavailable',
                    confidence: 'none',
                    rangeStartAt: null,
                    rangeEndAt: null,
                    remainingMinSeconds: null,
                    remainingMaxSeconds: null,
                },
                progress: {
                    phase: 'on-route',
                    stopsAhead: 1,
                    delayed: true,
                },
            }}
        />
    );
}

export function CrossMidnightCustomerEtaStory() {
    return (
        <CustomerDeliveryCard
            delivery={{
                ...baseDelivery,
                requestId: 'customer-cross-midnight-4136',
                slotStartAt: '2026-07-16T21:00:00.000Z',
                slotEndAt: '2026-07-16T23:00:00.000Z',
                eta: {
                    source: 'traffic-route',
                    calculatedAt: '2026-07-17T21:50:00.000Z',
                    freshness: 'fresh',
                    confidence: 'high',
                    rangeStartAt: '2026-07-17T21:55:00.000Z',
                    rangeEndAt: '2026-07-17T22:10:00.000Z',
                    remainingMinSeconds: 300,
                    remainingMaxSeconds: 1_200,
                },
                progress: {
                    phase: 'on-route',
                    stopsAhead: 1,
                    delayed: true,
                },
            }}
        />
    );
}

export function InvalidCustomerWindowStory({
    reversed = false,
}: {
    reversed?: boolean;
}) {
    return (
        <CustomerDeliveryCard
            delivery={{
                ...baseDelivery,
                requestId: 'customer-invalid-window-4136',
                slotStartAt: reversed
                    ? '2026-07-16T10:00:00.000Z'
                    : 'not-a-date',
                slotEndAt: '2026-07-16T08:00:00.000Z',
                eta: {
                    source: 'promised-window',
                    calculatedAt: null,
                    freshness: 'unavailable',
                    confidence: 'none',
                    rangeStartAt: null,
                    rangeEndAt: null,
                    remainingMinSeconds: null,
                    remainingMaxSeconds: null,
                },
                progress: {
                    phase: 'unavailable',
                    stopsAhead: null,
                    delayed: false,
                },
            }}
        />
    );
}

export function UpdatingCustomerEtaStory({
    arrived = false,
    delayed = false,
    rangeStartAt = baseDelivery.slotStartAt,
    rangeEndAt = baseDelivery.slotEndAt,
    remainingMinSeconds = 3_600,
    remainingMaxSeconds = 10_800,
}: {
    arrived?: boolean;
    delayed?: boolean;
    rangeStartAt?: string | null;
    rangeEndAt?: string | null;
    remainingMinSeconds?: number;
    remainingMaxSeconds?: number;
}) {
    return (
        <CustomerDeliveryCard
            delivery={{
                ...baseDelivery,
                requestId: 'customer-updating-4136',
                eta: delayed
                    ? {
                          source: 'traffic-route',
                          calculatedAt: '2026-07-16T09:55:00.000Z',
                          freshness: 'fresh',
                          confidence: 'high',
                          rangeStartAt: '2026-07-16T10:10:00.000Z',
                          rangeEndAt: '2026-07-16T10:25:00.000Z',
                          remainingMinSeconds: 900,
                          remainingMaxSeconds: 1_800,
                      }
                    : {
                          source: 'promised-window',
                          calculatedAt: null,
                          freshness: 'fallback',
                          confidence: 'approximate',
                          rangeStartAt,
                          rangeEndAt,
                          remainingMinSeconds,
                          remainingMaxSeconds,
                      },
                progress: arrived
                    ? {
                          phase: 'arrived',
                          stopsAhead: 0,
                          delayed: false,
                      }
                    : delayed
                      ? {
                            phase: 'on-route',
                            stopsAhead: 1,
                            delayed: true,
                        }
                      : {
                            phase: 'on-route',
                            stopsAhead: 3,
                            delayed: false,
                        },
            }}
        />
    );
}
