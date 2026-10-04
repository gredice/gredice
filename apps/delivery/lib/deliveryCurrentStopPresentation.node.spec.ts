import assert from 'node:assert/strict';
import test from 'node:test';
import {
    currentDeliveryRouteStep,
    deliveryCurrentStopCommandDeliveries,
    deliveryCurrentStopContacts,
    deliveryCurrentStopCriticalNotes,
} from './deliveryCurrentStopPresentation';
import type { DeliveryStopSummary } from './deliveryDashboardTypes';

const deliveries: DeliveryStopSummary['deliveries'] = [
    {
        stopId: 11,
        stopState: 'pending',
        requestId: 'request-1',
        requestState: 'in_delivery',
        contactName: 'Ana Anic',
        phone: '+385 91 111 1111',
        addressLabel: 'Ulaz iz dvorista',
        requestNotes: 'Pozvoniti dva puta',
        deliveryNotes: null,
        harvest: {
            plantName: 'Rajcica',
            operationName: null,
            raisedBedName: null,
            fieldName: null,
            tracePath: null,
        },
        exception: null,
    },
    {
        stopId: 12,
        stopState: 'pending',
        requestId: 'request-2',
        requestState: 'in_delivery',
        contactName: 'Borna Babic',
        phone: '+385 91 111 1111',
        addressLabel: 'Treci kat bez lifta',
        requestNotes: 'Pozvoniti dva puta',
        deliveryNotes: null,
        harvest: {
            plantName: 'Bosiljak',
            operationName: null,
            raisedBedName: null,
            fieldName: null,
            tracePath: null,
        },
        exception: null,
    },
];

test('selects only the route step derived as current', () => {
    const steps = [
        {
            kind: 'pickup',
            itinerarySequence: 1,
            actionState: 'completed' as const,
        },
        {
            kind: 'delivery',
            itinerarySequence: 2,
            actionState: 'current' as const,
        },
    ];

    assert.equal(currentDeliveryRouteStep(steps), steps[1]);
    assert.equal(
        currentDeliveryRouteStep(
            steps.map((step) => ({
                ...step,
                actionState: 'completed' as const,
            })),
        ),
        null,
    );
});

test('deduplicates shared phone numbers while preserving every contact name', () => {
    assert.deepEqual(
        deliveryCurrentStopContacts({
            contactName: 'Ana Anic',
            phone: '+385 91 111 1111',
            deliveries,
        }),
        [
            {
                phone: '+385 91 111 1111',
                label: 'Ana Anic, Borna Babic',
            },
        ],
    );
});

test('keeps every actionable address instruction and recipient request note', () => {
    assert.deepEqual(
        deliveryCurrentStopCriticalNotes({
            addressLabel: null,
            requestNotes: null,
            deliveries,
        }).map(({ label, context, text }) => ({ label, context, text })),
        [
            {
                label: 'Uputa za adresu',
                context: 'Ana Anic · Rajcica',
                text: 'Ulaz iz dvorista',
            },
            {
                label: 'Napomena korisnika',
                context: 'Ana Anic · Rajcica',
                text: 'Pozvoniti dva puta',
            },
            {
                label: 'Uputa za adresu',
                context: 'Borna Babic · Bosiljak',
                text: 'Treci kat bez lifta',
            },
            {
                label: 'Napomena korisnika',
                context: 'Borna Babic · Bosiljak',
                text: 'Pozvoniti dva puta',
            },
        ],
    );
});

test('limits current commands to actionable or deferred work', () => {
    const mixedDeliveries: DeliveryStopSummary['deliveries'] = [
        deliveries[0],
        {
            ...deliveries[1],
            stopState: 'failed',
            contactName: 'Terminalni kontakt',
            phone: '+385 99 999 9999',
            requestNotes: 'Ne prikazuj ovu napomenu',
        },
    ];
    assert.deepEqual(
        deliveryCurrentStopCommandDeliveries({
            stopState: 'arrived',
            deliveries: mixedDeliveries,
        }).map((delivery) => delivery.requestId),
        ['request-1'],
    );
    assert.equal(
        deliveryCurrentStopCommandDeliveries({
            stopState: 'deferred',
            deliveries: mixedDeliveries.map((delivery) => ({
                ...delivery,
                stopState: 'deferred',
            })),
        }).length,
        2,
    );
});
