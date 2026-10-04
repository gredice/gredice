import assert from 'node:assert/strict';
import test from 'node:test';
import { groupDeliveryRequests } from './DeliveryRequestGroups.ts';

type BaseGroupableRequest = Parameters<typeof groupDeliveryRequests>[0][number];
type GroupableRequest = BaseGroupableRequest & {
    mode: 'delivery' | 'pickup';
    state: string;
    address: {
        id: number;
        contactName: string;
        phone: string;
        street1: string;
        street2: string | null;
        postalCode: string;
        city: string;
        countryCode: string;
    } | null;
    location: null;
    requestNotes: string | null;
    deliveryNotes: string | null;
    cancelReason: string | null;
};

const slot = {
    id: 10,
    startAt: new Date('2026-06-29T15:00:00.000Z'),
    endAt: new Date('2026-06-29T17:00:00.000Z'),
};

function buildRequest(
    overrides: Partial<GroupableRequest> = {},
): GroupableRequest {
    return {
        id: 'request-1',
        accountId: 'account-1',
        mode: 'delivery',
        state: 'confirmed',
        slot,
        address: {
            id: 20,
            contactName: 'Kontakt',
            phone: '+385000000000',
            street1: 'Ulica 1',
            street2: null,
            postalCode: '10000',
            city: 'Zagreb',
            countryCode: 'HR',
        },
        location: null,
        requestNotes: null,
        deliveryNotes: null,
        cancelReason: null,
        createdAt: new Date('2026-06-28T08:00:00.000Z'),
        raisedBed: {
            id: 30,
            physicalId: '12',
        },
        raisedBedField: {
            positionIndex: 2,
        },
        plantSort: {
            information: {
                name: 'Rajcica',
            },
        },
        ...overrides,
    };
}

test('groups requests for the same account and slot in raised bed order', () => {
    const groups = groupDeliveryRequests([
        buildRequest({ id: 'field-3' }),
        buildRequest({
            id: 'field-1',
            raisedBedField: { positionIndex: 0 },
        }),
    ]);

    assert.equal(groups.length, 1);
    assert.deepEqual(
        groups[0]?.requests.map((request) => request.id),
        ['field-1', 'field-3'],
    );
});

test('groups requests for the same account and slot regardless of state', () => {
    const groups = groupDeliveryRequests([
        buildRequest({ id: 'confirmed' }),
        buildRequest({
            id: 'ready',
            state: 'ready',
            requestNotes: 'Napomena kupca',
        }),
        buildRequest({
            id: 'cancelled',
            state: 'cancelled',
            cancelReason: 'Vec ubrano.',
            address: {
                id: 21,
                contactName: 'Drugi kontakt',
                phone: '+385000000001',
                street1: 'Ulica 2',
                street2: null,
                postalCode: '10000',
                city: 'Zagreb',
                countryCode: 'HR',
            },
        }),
    ]);

    assert.equal(groups.length, 1);
    assert.deepEqual(
        groups[0]?.requests.map((request) => request.id).toSorted(),
        ['cancelled', 'confirmed', 'ready'],
    );
});

test('splits requests when account or slot differs', () => {
    const groups = groupDeliveryRequests([
        buildRequest({ id: 'same-account-and-slot' }),
        buildRequest({ id: 'other-account', accountId: 'account-2' }),
        buildRequest({
            id: 'other-slot',
            slot: {
                id: 11,
                startAt: new Date('2026-06-30T15:00:00.000Z'),
                endAt: new Date('2026-06-30T17:00:00.000Z'),
            },
        }),
    ]);

    assert.equal(groups.length, 3);
});

test('uses the operation account when the event projection has no account', () => {
    const groups = groupDeliveryRequests([
        buildRequest({
            id: 'first',
            accountId: null,
            operation: { accountId: 'operation-account' },
        }),
        buildRequest({
            id: 'second',
            accountId: null,
            operation: { accountId: 'operation-account' },
        }),
    ]);

    assert.equal(groups.length, 1);
});
