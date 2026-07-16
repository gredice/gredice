'use client';

import { useState } from 'react';
import { CustomerDashboard } from '../components/CustomerDashboard';
import type {
    CustomerDeliveryDashboard,
    CustomerDeliveryDashboardRequest,
    CustomerDeliveryRequestSummary,
    CustomerPickupRequestSummary,
} from '../lib/deliveryDashboardTypes';

const harvestBase = {
    operationName: 'Berba',
    raisedBedName: 'Gredica 4',
    fieldName: 'Polje 2',
};

function delivery({
    requestId,
    plantName,
    lifecycle,
    status = lifecycle === 'history' ? 'fulfilled' : 'ready',
    slotStartAt,
    deliveredAt = null,
    phase = lifecycle === 'active' ? 'next' : 'scheduled',
    stopsAhead = lifecycle === 'active' ? 0 : null,
    requestNotes = null,
    recovery = null,
    map = false,
}: {
    requestId: string;
    plantName: string;
    lifecycle: CustomerDeliveryRequestSummary['lifecycle'];
    status?: string;
    slotStartAt: string;
    deliveredAt?: string | null;
    phase?: CustomerDeliveryRequestSummary['progress']['phase'];
    stopsAhead?: number | null;
    requestNotes?: string | null;
    recovery?: CustomerDeliveryRequestSummary['recovery'];
    map?: boolean;
}): CustomerDeliveryRequestSummary {
    const harvest = {
        ...harvestBase,
        plantName,
        tracePath: `/trag/${requestId}`,
    };
    const fulfilled = status === 'fulfilled' && deliveredAt !== null;
    return {
        mode: 'delivery',
        lifecycle,
        requestId,
        status,
        statusLabel:
            lifecycle === 'active'
                ? phase === 'arrived'
                    ? 'Vozač je stigao'
                    : 'Vozač stiže'
                : fulfilled
                  ? 'Dostavljeno'
                  : status === 'failed'
                    ? 'Dostava nije uspjela'
                    : 'Dostava potvrđena',
        requestNotes,
        slotStartAt,
        slotEndAt: new Date(
            Date.parse(slotStartAt) + 2 * 60 * 60 * 1_000,
        ).toISOString(),
        eta: {
            source:
                lifecycle === 'active' ? 'traffic-route' : 'promised-window',
            calculatedAt:
                lifecycle === 'active' ? '2026-07-16T08:45:00.000Z' : null,
            freshness: lifecycle === 'active' ? 'fresh' : 'fallback',
            confidence: lifecycle === 'active' ? 'high' : 'approximate',
            rangeStartAt: slotStartAt,
            rangeEndAt: new Date(
                Date.parse(slotStartAt) + 2 * 60 * 60 * 1_000,
            ).toISOString(),
            remainingMinSeconds: lifecycle === 'active' ? 600 : null,
            remainingMaxSeconds: lifecycle === 'active' ? 1_200 : null,
        },
        progress: {
            phase: fulfilled || status === 'failed' ? 'unavailable' : phase,
            stopsAhead: fulfilled || status === 'failed' ? null : stopsAhead,
            delayed: false,
        },
        deliveredAt,
        harvest,
        destination: {
            recipientName: `Primatelj ${plantName}`,
            address: 'Ilica 1, 10000 Zagreb, HR',
            addressLabel: 'Dom',
        },
        receipt: fulfilled
            ? {
                  requestReference: requestId,
                  deliveredAt,
                  verification: 'verified',
                  harvest,
              }
            : null,
        recovery,
        tracking: map
            ? {
                  status: 'live',
                  lastAcceptedAt: '2026-07-16T08:45:00.000Z',
                  mapAvailable: true,
                  exactLocationExpiresInMs: 110_000,
              }
            : null,
        mapPath: map ? `/api/map/${requestId}` : null,
    };
}

function pickup({
    requestId,
    plantName,
    lifecycle,
    slotStartAt,
    pickedUpAt = null,
}: {
    requestId: string;
    plantName: string;
    lifecycle: CustomerPickupRequestSummary['lifecycle'];
    slotStartAt: string;
    pickedUpAt?: string | null;
}): CustomerPickupRequestSummary {
    return {
        mode: 'pickup',
        lifecycle,
        requestId,
        status: lifecycle === 'history' ? 'fulfilled' : 'ready',
        statusLabel:
            lifecycle === 'history' ? 'Preuzeto' : 'Spremno za preuzimanje',
        requestNotes: null,
        slotStartAt,
        slotEndAt: new Date(
            Date.parse(slotStartAt) + 2 * 60 * 60 * 1_000,
        ).toISOString(),
        harvest: {
            ...harvestBase,
            plantName,
            tracePath: `/trag/${requestId}`,
        },
        location: {
            name: 'Gredice HQ',
            address: 'Vrtna 1, 10000 Zagreb, HR',
            instructions: 'Preuzmi urod tijekom odabranog termina.',
        },
        pickedUpAt,
    };
}

function dashboard(
    deliveries: CustomerDeliveryDashboardRequest[],
): CustomerDeliveryDashboard {
    return {
        kind: 'customer',
        user: {
            id: 'customer-history-4137',
            displayName: 'Kupac Korina',
            role: 'user',
        },
        deliveries,
        refreshedAt: '2026-07-16T08:45:00.000Z',
    };
}

function StoryDashboard({
    deliveries,
}: {
    deliveries: CustomerDeliveryDashboardRequest[];
}) {
    const [requestTiming] = useState(() => ({
        monotonicMs: performance.now(),
        wallMs: Date.now(),
    }));
    return (
        <CustomerDashboard
            dashboard={dashboard(deliveries)}
            requestTiming={requestTiming}
        />
    );
}

const activeArrived = delivery({
    requestId: 'active-arrived-4137',
    plantName: 'Aktivna rajčica',
    lifecycle: 'active',
    slotStartAt: '2026-07-16T09:00:00.000Z',
    phase: 'arrived',
    requestNotes: 'Pozvoni na portafon i ostavi košaru kod vrata.',
    map: true,
});

const activeBulkSibling = delivery({
    requestId: 'active-bulk-sibling-4137',
    plantName: 'Aktivni bosiljak',
    lifecycle: 'active',
    slotStartAt: '2026-07-16T09:00:00.000Z',
    phase: 'next',
});

const history = [
    delivery({
        requestId: 'history-recovery-4137',
        plantName: 'Urod s oporavkom',
        lifecycle: 'history',
        status: 'failed',
        slotStartAt: '2026-06-01T08:00:00.000Z',
        recovery: { kind: 'support' },
    }),
    delivery({
        requestId: 'history-delivery-1-4137',
        plantName: 'Dostavljena paprika',
        lifecycle: 'history',
        slotStartAt: '2026-07-15T12:00:00.000Z',
        deliveredAt: '2026-07-15T14:00:00.000Z',
    }),
    pickup({
        requestId: 'history-pickup-1-4137',
        plantName: 'Preuzeta mrkva',
        lifecycle: 'history',
        slotStartAt: '2026-07-15T11:00:00.000Z',
        pickedUpAt: '2026-07-15T13:00:00.000Z',
    }),
    delivery({
        requestId: 'history-delivery-2-4137',
        plantName: 'Dostavljena salata',
        lifecycle: 'history',
        slotStartAt: '2026-07-15T10:00:00.000Z',
        deliveredAt: '2026-07-15T12:00:00.000Z',
    }),
    pickup({
        requestId: 'history-pickup-2-4137',
        plantName: 'Preuzeti krastavac',
        lifecycle: 'history',
        slotStartAt: '2026-07-15T09:00:00.000Z',
        pickedUpAt: '2026-07-15T11:00:00.000Z',
    }),
    delivery({
        requestId: 'history-delivery-3-4137',
        plantName: 'Dostavljena tikvica',
        lifecycle: 'history',
        slotStartAt: '2026-07-15T08:00:00.000Z',
        deliveredAt: '2026-07-15T10:00:00.000Z',
    }),
    pickup({
        requestId: 'history-pickup-hidden-4137',
        plantName: 'Skriveni preuzeti grašak',
        lifecycle: 'history',
        slotStartAt: '2026-07-15T07:00:00.000Z',
        pickedUpAt: '2026-07-15T09:00:00.000Z',
    }),
    delivery({
        requestId: 'history-delivery-hidden-4137',
        plantName: 'Skriveni dostavljeni kelj',
        lifecycle: 'history',
        slotStartAt: '2026-07-15T06:00:00.000Z',
        deliveredAt: '2026-07-15T08:00:00.000Z',
    }),
];

const longHistory = Array.from({ length: 14 }, (_, index) => {
    const day = String(14 - index).padStart(2, '0');
    return delivery({
        requestId: `long-history-${index + 1}-4137`,
        plantName: `Povijesni urod ${index + 1}`,
        lifecycle: 'history',
        slotStartAt: `2026-07-${day}T08:00:00.000Z`,
        deliveredAt: `2026-07-${day}T09:00:00.000Z`,
    });
});

export function CustomerDeliverySectionsStory() {
    return (
        <StoryDashboard
            deliveries={[
                delivery({
                    requestId: 'upcoming-delivery-4137',
                    plantName: 'Nadolazeći peršin',
                    lifecycle: 'upcoming',
                    slotStartAt: '2026-07-17T11:00:00.000Z',
                }),
                activeBulkSibling,
                pickup({
                    requestId: 'upcoming-pickup-4137',
                    plantName: 'Nadolazeća blitva',
                    lifecycle: 'upcoming',
                    slotStartAt: '2026-07-17T09:00:00.000Z',
                }),
                activeArrived,
                ...history,
            ]}
        />
    );
}

export function CustomerDeliveryActiveAndHistoryEmptyStory() {
    return (
        <StoryDashboard
            deliveries={[
                delivery({
                    requestId: 'upcoming-only-4137',
                    plantName: 'Samo nadolazeća rotkvica',
                    lifecycle: 'upcoming',
                    slotStartAt: '2026-07-17T10:00:00.000Z',
                }),
            ]}
        />
    );
}

export function CustomerDeliveryUpcomingEmptyStory() {
    return (
        <StoryDashboard
            deliveries={[
                activeArrived,
                delivery({
                    requestId: 'history-only-4137',
                    plantName: 'Dostavljena rikola',
                    lifecycle: 'history',
                    slotStartAt: '2026-07-15T12:00:00.000Z',
                    deliveredAt: '2026-07-15T14:00:00.000Z',
                }),
            ]}
        />
    );
}

export function CustomerDeliveryLongHistoryStory() {
    return <StoryDashboard deliveries={longHistory} />;
}
