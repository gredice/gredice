import assert from 'node:assert/strict';
import test from 'node:test';
import { groupDeliveryRequests } from './DeliveryRequestGroups.ts';

type GroupableRequest = Parameters<typeof groupDeliveryRequests>[0][number];

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

test('groups requests for the same destination and slot', () => {
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

test('splits requests when delivery facts differ', () => {
    const groups = groupDeliveryRequests([
        buildRequest({ id: 'confirmed' }),
        buildRequest({ id: 'ready', state: 'ready' }),
        buildRequest({
            id: 'other-slot',
            slot: {
                id: 11,
                startAt: new Date('2026-06-30T15:00:00.000Z'),
                endAt: new Date('2026-06-30T17:00:00.000Z'),
            },
        }),
        buildRequest({
            id: 'other-address',
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

    assert.equal(groups.length, 4);
});
