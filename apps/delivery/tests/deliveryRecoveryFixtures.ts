import type {
    DeliveryStopDeliverySummary,
    DeliveryStopSummary,
    DriverDeliveryExceptionSummary,
} from '../lib/deliveryDashboardTypes';

function delivery({
    requestId,
    stopId,
    stopState,
    contactName,
    plantName,
    raisedBedName,
    tracePath,
    exception = null,
}: {
    requestId: string;
    stopId: number;
    stopState: string;
    contactName: string;
    plantName: string;
    raisedBedName: string;
    tracePath: string;
    exception?: DriverDeliveryExceptionSummary | null;
}): DeliveryStopDeliverySummary {
    return {
        stopId,
        stopState,
        requestId,
        requestState: 'in_delivery',
        contactName,
        phone: '+385 91 555 0101',
        addressLabel: null,
        requestNotes: null,
        deliveryNotes: null,
        harvest: {
            plantName,
            operationName: 'Berba',
            raisedBedName,
            fieldName: null,
            tracePath,
        },
        exception,
    };
}

function stop(
    deliveries: DeliveryStopDeliverySummary[],
    overrides: Partial<DeliveryStopSummary> = {},
): DeliveryStopSummary {
    const primaryDelivery = deliveries[0];
    if (!primaryDelivery) {
        throw new Error('A delivery recovery fixture needs at least one item.');
    }

    return {
        id: 41,
        requestId: primaryDelivery.requestId,
        sequence: 2,
        stopState: 'arrived',
        requestState: 'in_delivery',
        statusLabel: 'Vozač je stigao',
        isCurrent: true,
        contactName: primaryDelivery.contactName,
        phone: primaryDelivery.phone,
        address: 'Ilica 42, Zagreb',
        addressLabel: 'Ulaz iz dvorišta',
        requestNotes: null,
        deliveryNotes: null,
        slotStartAt: '2026-07-15T08:00:00.000Z',
        slotEndAt: '2026-07-15T10:00:00.000Z',
        estimatedArrivalAt: '2026-07-15T08:30:00.000Z',
        estimatedTravelSeconds: 720,
        estimatedDistanceMeters: 4_200,
        reroutePending: false,
        arrivedAt: '2026-07-15T08:29:00.000Z',
        deliveredAt: null,
        harvest: primaryDelivery.harvest,
        recovery: null,
        tracking: null,
        runId: 'run-component-4127',
        deliveryCount: deliveries.length,
        deliveries,
        actionState: 'current',
        lockedReason: null,
        ...overrides,
    };
}

export const bulkExceptionStop = stop([
    delivery({
        requestId: 'request-tomato',
        stopId: 101,
        stopState: 'arrived',
        contactName: 'Ana Anić',
        plantName: 'Rajčica Roma',
        raisedBedName: 'Gredica A',
        tracePath: '/trag/tomato-trace-0001',
    }),
    delivery({
        requestId: 'request-basil',
        stopId: 102,
        stopState: 'pending',
        contactName: 'Borna Babić',
        plantName: 'Bosiljak Genovese',
        raisedBedName: 'Gredica B',
        tracePath: '/trag/basil-trace-000002',
    }),
    delivery({
        requestId: 'request-lettuce',
        stopId: 103,
        stopState: 'pending',
        contactName: 'Cvita Cvetko',
        plantName: 'Salata puterica',
        raisedBedName: 'Gredica C',
        tracePath: '/trag/lettuce-trace-0003',
    }),
]);

export const duplicateIdentityStop = stop([
    delivery({
        requestId: 'request-duplicate-one',
        stopId: 601,
        stopState: 'arrived',
        contactName: 'Iva Ista',
        plantName: 'Rajčica duplikat',
        raisedBedName: 'Gredica Z',
        tracePath: '/trag/duplicate-harvest-one-0001',
    }),
    delivery({
        requestId: 'request-duplicate-two',
        stopId: 602,
        stopState: 'arrived',
        contactName: 'Iva Ista',
        plantName: 'Rajčica duplikat',
        raisedBedName: 'Gredica Z',
        tracePath: '/trag/duplicate-harvest-two-0001',
    }),
]);

export const mixedStatusStop = stop([
    delivery({
        requestId: 'request-active-tomato',
        stopId: 201,
        stopState: 'arrived',
        contactName: 'Dora Dostavić',
        plantName: 'Rajčica za predaju',
        raisedBedName: 'Gredica D',
        tracePath: '/trag/active-tomato-trace-0001',
    }),
    delivery({
        requestId: 'request-failed-chard',
        stopId: 202,
        stopState: 'failed',
        contactName: 'Dora Dostavić',
        plantName: 'Blitva s iznimkom',
        raisedBedName: 'Gredica E',
        tracePath: '/trag/failed-chard-trace-0001',
        exception: {
            outcome: 'failed',
            reason: 'harvest-missing',
            note: 'Sanduk nije pronađen u vozilu.',
            occurredAt: '2026-07-15T08:25:00.000Z',
        },
    }),
]);

export const deferredRetryStop = stop(
    [
        delivery({
            requestId: 'request-deferred-tomato',
            stopId: 301,
            stopState: 'deferred',
            contactName: 'Ena Ekološka',
            plantName: 'Rajčica za ponovni pokušaj',
            raisedBedName: 'Gredica F',
            tracePath: '/trag/deferred-tomato-trace-0001',
        }),
        delivery({
            requestId: 'request-deferred-pepper',
            stopId: 302,
            stopState: 'deferred',
            contactName: 'Ena Ekološka',
            plantName: 'Paprika za ponovni pokušaj',
            raisedBedName: 'Gredica G',
            tracePath: '/trag/deferred-pepper-trace-0001',
        }),
    ],
    {
        id: 301,
        stopState: 'deferred',
        statusLabel: 'Dostava je odgođena',
        arrivedAt: null,
    },
);

export const customerFailedStop = stop(
    [
        delivery({
            requestId: 'request-customer-failed',
            stopId: 401,
            stopState: 'failed',
            contactName: 'Korisnik Kupac',
            plantName: 'Mrkva za preuzimanje',
            raisedBedName: 'Gredica H',
            tracePath: '/trag/customer-carrot-trace-0001',
        }),
    ],
    {
        id: 401,
        stopState: 'failed',
        requestState: 'failed',
        statusLabel: 'Dostava nije uspjela',
        isCurrent: false,
        actionState: 'completed',
        estimatedArrivalAt: '2026-07-15T10:30:00.000Z',
        recovery: {
            kind: 'hq-pickup',
            pickupAddress: 'Konfigurirani HQ, Testna 42, Zagreb',
            pickupDeadlineAt: '2026-07-18T08:30:00.000Z',
            pickupWindowHours: 72,
        },
    },
);

export const driverFailedStop = stop(
    [
        delivery({
            requestId: 'request-driver-failed',
            stopId: 501,
            stopState: 'failed',
            contactName: 'Franjo Finalni',
            plantName: 'Tikvica iz završene dostave',
            raisedBedName: 'Gredica I',
            tracePath: '/trag/driver-zucchini-trace-0001',
            exception: {
                outcome: 'failed',
                reason: 'address-inaccessible',
                note: 'Prilaz je zatvoren.',
                occurredAt: '2026-07-15T10:20:00.000Z',
            },
        }),
    ],
    {
        id: 501,
        stopState: 'failed',
        requestState: 'failed',
        statusLabel: 'Dostava nije uspjela',
        isCurrent: false,
        actionState: 'completed',
        estimatedArrivalAt: '2026-07-15T10:30:00.000Z',
    },
);
