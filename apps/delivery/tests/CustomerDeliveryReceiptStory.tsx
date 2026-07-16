'use client';

import { Button } from '@gredice/ui/Button';
import { useState } from 'react';
import { CustomerDashboard } from '../components/CustomerDashboard';
import { CustomerDeliveryCard } from '../components/CustomerDeliveryCard';
import type {
    CustomerDeliveryDashboard,
    CustomerDeliveryRequestSummary,
    CustomerHandoffVerification,
} from '../lib/deliveryDashboardTypes';

function customerDelivery({
    verification,
    index,
    trace = true,
    longName = false,
}: {
    verification: CustomerHandoffVerification;
    index: number;
    trace?: boolean;
    longName?: boolean;
}): CustomerDeliveryRequestSummary {
    const requestReference = `customer-owned-request-${index}-4144`;
    const plantName = longName
        ? 'Vrlo dugačka sorta ekološke rajčice za provjeru prijeloma teksta na malom zaslonu'
        : `Rajčica kupca ${index}`;
    const tracePath = trace ? `/trag/customer-owned-trace-${index}-4144` : null;
    const harvest = {
        plantName,
        operationName: 'Berba',
        raisedBedName: `Gredica ${index}`,
        fieldName: `Polje ${index}`,
        tracePath,
    };

    return {
        mode: 'delivery',
        requestId: requestReference,
        status: 'fulfilled',
        statusLabel: 'Dostavljeno',
        requestNotes: null,
        slotStartAt: '2026-07-16T08:00:00.000Z',
        slotEndAt: '2026-07-16T10:00:00.000Z',
        estimatedArrivalAt: null,
        estimatedTravelSeconds: null,
        estimatedDistanceMeters: null,
        reroutePending: false,
        deliveredAt: '2026-07-16T09:30:00.000Z',
        harvest,
        receipt: {
            requestReference,
            deliveredAt: '2026-07-16T09:30:00.000Z',
            verification,
            harvest,
        },
        recovery: null,
        tracking: null,
        mapPath: null,
    };
}

const activeBase = customerDelivery({
    verification: 'not-recorded',
    index: 9,
});
const activeDelivery: CustomerDeliveryRequestSummary = {
    ...activeBase,
    requestId: 'customer-owned-request-journey-4144',
    status: 'ready',
    statusLabel: 'Vozač stiže',
    estimatedArrivalAt: '2026-07-16T09:30:00.000Z',
    estimatedTravelSeconds: 600,
    estimatedDistanceMeters: 3_200,
    deliveredAt: null,
    receipt: null,
    tracking: {
        status: 'live',
        lastAcceptedAt: '2026-07-16T09:20:00.000Z',
        mapAvailable: false,
    },
    mapPath: '/api/map/customer-run-journey-4144',
};

const deliveredJourneyBase = customerDelivery({
    verification: 'verified',
    index: 9,
});
if (!deliveredJourneyBase.receipt) {
    throw new Error('The delivered customer fixture needs a receipt.');
}
const deliveredJourneyDelivery: CustomerDeliveryRequestSummary = {
    ...deliveredJourneyBase,
    requestId: 'customer-owned-request-journey-4144',
    receipt: {
        ...deliveredJourneyBase.receipt,
        requestReference: 'customer-owned-request-journey-4144',
    },
};

function dashboard(
    deliveries: CustomerDeliveryRequestSummary[],
): CustomerDeliveryDashboard {
    return {
        kind: 'customer',
        user: {
            id: 'customer-user-4144',
            displayName: 'Kupac Primatelj',
            role: 'user',
        },
        deliveries,
        refreshedAt: '2026-07-16T09:30:00.000Z',
    };
}

export function CustomerDeliveryReceiptStatesStory() {
    return (
        <div className="max-w-2xl space-y-4 p-4">
            <CustomerDeliveryCard
                delivery={customerDelivery({
                    verification: 'verified',
                    index: 1,
                    longName: true,
                })}
            />
            <CustomerDeliveryCard
                delivery={customerDelivery({
                    verification: 'no-label',
                    index: 2,
                })}
            />
            <CustomerDeliveryCard
                delivery={customerDelivery({
                    verification: 'skipped',
                    index: 3,
                })}
            />
            <CustomerDeliveryCard
                delivery={customerDelivery({
                    verification: 'not-recorded',
                    index: 4,
                    trace: false,
                })}
            />
        </div>
    );
}

export function CustomerDeliveryReceiptJourneyStory() {
    const [delivered, setDelivered] = useState(false);
    return (
        <div>
            <div className="p-4">
                <Button onClick={() => setDelivered(true)}>
                    Simuliraj potvrdu dostave
                </Button>
            </div>
            <CustomerDashboard
                dashboard={dashboard([
                    delivered ? deliveredJourneyDelivery : activeDelivery,
                ])}
            />
        </div>
    );
}
