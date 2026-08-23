'use client';

import { useEffect, useState } from 'react';
import { CustomerDashboard } from '../components/CustomerDashboard';
import type { CustomerDashboardFreshnessFailure } from '../components/CustomerDashboardFreshness';
import { DeliveryDashboardInitialError } from '../components/DeliveryDashboardInitialError';
import type { CustomerDeliveryDashboard } from '../lib/deliveryDashboardTypes';

const dashboard: CustomerDeliveryDashboard = {
    kind: 'customer',
    user: {
        id: 'customer-resilience-4138',
        displayName: 'Korisnik Resilient',
        role: 'user',
    },
    deliveries: [
        {
            mode: 'delivery',
            lifecycle: 'active',
            requestId: 'delivery-resilience-4138',
            status: 'ready',
            statusLabel: 'U dostavi',
            requestNotes: 'Pozvoni na portafon.',
            slotStartAt: '2026-07-16T08:00:00.000Z',
            slotEndAt: '2026-07-16T10:00:00.000Z',
            eta: {
                source: 'promised-window',
                calculatedAt: null,
                freshness: 'fallback',
                confidence: 'approximate',
                rangeStartAt: '2026-07-16T08:00:00.000Z',
                rangeEndAt: '2026-07-16T10:00:00.000Z',
                remainingMinSeconds: 900,
                remainingMaxSeconds: 1_800,
            },
            progress: {
                phase: 'on-route',
                stopsAhead: 2,
                delayed: false,
            },
            deliveredAt: null,
            harvest: {
                plantName: 'Rajčica iz spremljenog prikaza',
                operationName: 'Berba',
                raisedBedName: 'Gredica 4',
                fieldName: 'Polje 2',
                tracePath: '/trag/delivery-resilience-4138',
            },
            destination: {
                recipientName: 'Korisnik Resilient',
                address: 'Ilica 1, 10000 Zagreb, HR',
                addressLabel: 'Dom',
            },
            receipt: null,
            recovery: null,
            tracking: null,
            mapPath: null,
        },
    ],
    refreshedAt: '2026-07-16T09:15:00.000Z',
};

function wait(milliseconds: number) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function CustomerDashboardResilienceStory({
    failure = 'refresh',
    retrySucceeds = true,
    retryDelayMs = 500,
}: {
    failure?: CustomerDashboardFreshnessFailure;
    retrySucceeds?: boolean;
    retryDelayMs?: number;
}) {
    const [currentFailure, setCurrentFailure] =
        useState<CustomerDashboardFreshnessFailure>(failure);

    useEffect(() => setCurrentFailure(failure), [failure]);

    return (
        <CustomerDashboard
            dashboard={dashboard}
            requestTiming={null}
            freshness={{
                failure: currentFailure,
                onRetry: async () => {
                    await wait(retryDelayMs);
                    if (retrySucceeds) setCurrentFailure(null);
                    return retrySucceeds;
                },
            }}
        />
    );
}

export function InitialDashboardErrorStory({ retryDelayMs = 500 }) {
    const [retrying, setRetrying] = useState(false);
    const [attempts, setAttempts] = useState(0);

    return (
        <>
            <DeliveryDashboardInitialError
                message="Podatke o dostavama trenutačno nije moguće učitati."
                retrying={retrying}
                onRetry={async () => {
                    setRetrying(true);
                    await wait(retryDelayMs);
                    setAttempts((current) => current + 1);
                    setRetrying(false);
                }}
            />
            <output data-testid="initial-retry-attempts">{attempts}</output>
        </>
    );
}

export function InitialDashboardErrorStateStory({
    retrying = false,
    retryUnavailableMessage = null,
}: {
    retrying?: boolean;
    retryUnavailableMessage?: string | null;
}) {
    return (
        <DeliveryDashboardInitialError
            message="Podatke o dostavama trenutačno nije moguće učitati."
            retrying={retrying}
            retryUnavailableMessage={retryUnavailableMessage}
            onRetry={() => undefined}
        />
    );
}
