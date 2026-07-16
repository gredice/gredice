'use client';

import { Button } from '@gredice/ui/Button';
import { useState } from 'react';
import { CustomerDashboard } from '../components/CustomerDashboard';
import { DeliveryStopCard } from '../components/DeliveryStopCard';
import type {
    CustomerDeliveryDashboard,
    CustomerHandoffVerification,
    DeliveryStopSummary,
} from '../lib/deliveryDashboardTypes';

const privateDriverNote = 'PRIVATE DRIVER NOTE 4144';
const foreignBulkRecipient = 'FOREIGN BULK RECIPIENT 4144';

function customerStop({
    verification,
    index,
    trace = true,
    longName = false,
}: {
    verification: CustomerHandoffVerification;
    index: number;
    trace?: boolean;
    longName?: boolean;
}): DeliveryStopSummary {
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
        id: 700 + index,
        requestId: requestReference,
        sequence: null,
        stopState: 'delivered',
        requestState: 'fulfilled',
        statusLabel: 'Dostavljeno',
        isCurrent: false,
        contactName: 'Kupac',
        phone: null,
        address: 'Adresa kupca',
        addressLabel: null,
        requestNotes: null,
        deliveryNotes: privateDriverNote,
        slotStartAt: '2026-07-16T08:00:00.000Z',
        slotEndAt: '2026-07-16T10:00:00.000Z',
        estimatedArrivalAt: null,
        estimatedTravelSeconds: null,
        estimatedDistanceMeters: null,
        reroutePending: false,
        arrivedAt: '2026-07-16T09:25:00.000Z',
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
        runId: null,
        deliveryCount: 1,
        recipientCount: 1,
        deliveries: [
            {
                stopId: 700 + index,
                stopState: 'delivered',
                requestId: requestReference,
                requestState: 'fulfilled',
                contactName: 'Kupac',
                phone: null,
                addressLabel: null,
                requestNotes: null,
                deliveryNotes: privateDriverNote,
                harvest,
                exception: null,
            },
            {
                stopId: 9_999,
                stopState: 'delivered',
                requestId: 'foreign-bulk-request-4144',
                requestState: 'fulfilled',
                contactName: foreignBulkRecipient,
                phone: '+385 91 999 9999',
                addressLabel: 'FOREIGN ADDRESS 4144',
                requestNotes: 'FOREIGN REQUEST NOTE 4144',
                deliveryNotes: 'FOREIGN DRIVER NOTE 4144',
                harvest: {
                    plantName: 'FOREIGN HARVEST 4144',
                    operationName: null,
                    raisedBedName: null,
                    fieldName: null,
                    tracePath: '/trag/foreign-trace-4144',
                },
                exception: null,
            },
        ],
        actionState: 'completed',
        lockedReason: null,
    };
}

const activeBase = customerStop({ verification: 'not-recorded', index: 9 });
const activePrimaryDelivery = activeBase.deliveries[0];
if (!activePrimaryDelivery) {
    throw new Error('The active customer receipt fixture needs one delivery.');
}

const activeStop: DeliveryStopSummary = {
    ...activeBase,
    id: 709,
    requestId: 'customer-owned-request-journey-4144',
    stopState: 'pending',
    requestState: 'ready',
    statusLabel: 'Vozač stiže',
    isCurrent: true,
    estimatedArrivalAt: '2026-07-16T09:30:00.000Z',
    estimatedTravelSeconds: 600,
    estimatedDistanceMeters: 3_200,
    arrivedAt: null,
    deliveredAt: null,
    receipt: null,
    tracking: {
        status: 'live',
        lastAcceptedAt: '2026-07-16T09:20:00.000Z',
        mapAvailable: false,
    },
    runId: 'customer-run-journey-4144',
    actionState: 'current',
    deliveries: [
        {
            ...activePrimaryDelivery,
            requestId: 'customer-owned-request-journey-4144',
            stopState: 'pending',
            requestState: 'ready',
        },
    ],
};

const deliveredJourneyBase = customerStop({
    verification: 'verified',
    index: 9,
});
if (!deliveredJourneyBase.receipt) {
    throw new Error('The delivered customer fixture needs a receipt.');
}
const deliveredJourneyStop: DeliveryStopSummary = {
    ...deliveredJourneyBase,
    requestId: 'customer-owned-request-journey-4144',
    receipt: {
        ...deliveredJourneyBase.receipt,
        requestReference: 'customer-owned-request-journey-4144',
    },
    deliveries: deliveredJourneyBase.deliveries.map((delivery, index) =>
        index === 0
            ? {
                  ...delivery,
                  requestId: 'customer-owned-request-journey-4144',
              }
            : delivery,
    ),
};

function dashboard(
    deliveries: DeliveryStopSummary[],
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
            <DeliveryStopCard
                stop={customerStop({
                    verification: 'verified',
                    index: 1,
                    longName: true,
                })}
                mode="customer"
            />
            <DeliveryStopCard
                stop={customerStop({ verification: 'no-label', index: 2 })}
                mode="customer"
            />
            <DeliveryStopCard
                stop={customerStop({ verification: 'skipped', index: 3 })}
                mode="customer"
            />
            <DeliveryStopCard
                stop={customerStop({
                    verification: 'not-recorded',
                    index: 4,
                    trace: false,
                })}
                mode="customer"
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
                    delivered ? deliveredJourneyStop : activeStop,
                ])}
            />
        </div>
    );
}
