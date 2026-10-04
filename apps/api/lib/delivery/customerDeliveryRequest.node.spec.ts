import assert from 'node:assert/strict';
import test from 'node:test';
import { customerDeliveryRequest } from './customerDeliveryRequest';

const createdAt = new Date('2026-07-16T08:00:00.000Z');
const startsAt = new Date('2026-07-16T10:00:00.000Z');
const endsAt = new Date('2026-07-16T12:00:00.000Z');
const fulfilledAt = new Date('2026-07-16T10:30:00.000Z');

test('customer delivery request returns an explicit delivery allowlist', () => {
    const privateSentinels = [
        'PRIVATE ACCOUNT 4135',
        'PRIVATE DRIVER NOTE 4135',
        'PRIVATE ROUTE 4135',
        'PRIVATE PHONE 4135',
        'PRIVATE TRACE TOKEN 4135',
        'PRIVATE OPERATION ATTRIBUTE 4135',
        'PRIVATE RAISED BED ACCOUNT 4135',
    ];
    const request = customerDeliveryRequest({
        id: 'delivery-request-4135',
        operationId: 4135,
        mode: 'delivery',
        state: 'fulfilled',
        createdAt,
        accountId: privateSentinels[0],
        deliveryNotes: privateSentinels[1],
        routeRevision: privateSentinels[2],
        slot: {
            id: 10,
            startAt: startsAt,
            endAt: endsAt,
            status: 'scheduled',
            closesAt: privateSentinels[2],
        },
        address: {
            id: 20,
            label: 'Dom',
            street1: 'Vrtna 1',
            street2: null,
            city: 'Zagreb',
            postalCode: '10000',
            countryCode: 'HR',
            phone: privateSentinels[3],
            contactName: 'PRIVATE CONTACT 4135',
        },
        location: {
            id: 30,
            name: 'PRIVATE PICKUP LOCATION 4135',
            street1: 'HQ 1',
            city: 'Zagreb',
            postalCode: '10000',
            countryCode: 'HR',
        },
        operation: { privateValue: 'PRIVATE OPERATION 4135' },
        operationData: {
            information: {
                label: 'Berba',
                name: 'harvest',
                description: privateSentinels[5],
            },
            image: {
                cover: {
                    url: 'https://example.com/operation.webp',
                    privateValue: privateSentinels[5],
                },
            },
            attributes: { privateValue: privateSentinels[5] },
        },
        plantSort: {
            information: {
                name: 'Cherry rajčica',
                description: 'PRIVATE PLANT DESCRIPTION 4135',
            },
            image: {
                cover: {
                    url: 'https://example.com/plant.webp',
                    privateValue: 'PRIVATE PLANT IMAGE 4135',
                },
            },
        },
        raisedBed: {
            name: 'Gredica 1',
            physicalId: 'A-1',
            accountId: privateSentinels[6],
        },
        raisedBedField: {
            positionIndex: 2,
            plantCycles: ['PRIVATE PLANT CYCLE 4135'],
        },
        requestNotes: 'Pozvoniti na ulaz.',
        cancelReason: 'Promjena plana',
        trace: {
            publicPath: '/trag/javna-putanja',
            id: 99,
            publicToken: privateSentinels[4],
        },
        customerHandoffReceipt: {
            fulfilledAt,
            verification: 'verified',
            privateRunId: privateSentinels[2],
        },
    });

    assert.deepEqual(request, {
        id: 'delivery-request-4135',
        operationId: 4135,
        state: 'fulfilled',
        createdAt,
        slot: { id: 10, startAt: startsAt, endAt: endsAt },
        operationData: {
            information: { label: 'Berba', name: 'harvest' },
            image: {
                cover: { url: 'https://example.com/operation.webp' },
            },
        },
        plantSort: {
            information: { name: 'Cherry rajčica' },
            image: { cover: { url: 'https://example.com/plant.webp' } },
        },
        raisedBed: { name: 'Gredica 1', physicalId: 'A-1' },
        raisedBedField: { positionIndex: 2 },
        trace: { publicPath: '/trag/javna-putanja' },
        requestNotes: 'Pozvoniti na ulaz.',
        cancelReason: 'Promjena plana',
        mode: 'delivery',
        address: {
            id: 20,
            label: 'Dom',
            street1: 'Vrtna 1',
            street2: null,
            city: 'Zagreb',
            postalCode: '10000',
            countryCode: 'HR',
        },
        customerHandoffReceipt: {
            fulfilledAt,
            verification: 'verified',
        },
    });
    const serialized = JSON.stringify(request);
    for (const sentinel of privateSentinels) {
        assert.equal(serialized.includes(sentinel), false, sentinel);
    }
    assert.equal('location' in request, false);
});

test('customer pickup request exposes only its public pickup destination', () => {
    const request = customerDeliveryRequest({
        id: 'pickup-request-4135',
        operationId: 4136,
        mode: 'pickup',
        state: 'ready',
        createdAt,
        slot: { id: 11, startAt: startsAt, endAt: endsAt },
        location: {
            id: 31,
            name: 'Gredice HQ',
            street1: 'Sjedište 1',
            street2: 'Ulaz iz dvorišta',
            city: 'Zagreb',
            postalCode: '10000',
            countryCode: 'HR',
            isActive: true,
            createdAt: 'PRIVATE LOCATION TIMESTAMP 4135',
        },
        address: {
            id: 21,
            label: 'PRIVATE DELIVERY ADDRESS 4135',
            street1: 'Privatna 1',
            city: 'Zagreb',
            postalCode: '10000',
            countryCode: 'HR',
        },
        operationData: null,
        plantSort: null,
        raisedBed: null,
        raisedBedField: null,
        trace: null,
        deliveryNotes: 'PRIVATE PICKUP NOTE 4135',
        customerHandoffReceipt: {
            fulfilledAt,
            verification: 'verified',
        },
    });

    assert.deepEqual(request, {
        id: 'pickup-request-4135',
        operationId: 4136,
        state: 'ready',
        createdAt,
        slot: { id: 11, startAt: startsAt, endAt: endsAt },
        operationData: null,
        plantSort: null,
        raisedBed: null,
        raisedBedField: null,
        trace: null,
        mode: 'pickup',
        location: {
            id: 31,
            name: 'Gredice HQ',
            street1: 'Sjedište 1',
            street2: 'Ulaz iz dvorišta',
            city: 'Zagreb',
            postalCode: '10000',
            countryCode: 'HR',
        },
    });
    const serialized = JSON.stringify(request);
    assert.equal(serialized.includes('PRIVATE'), false);
    assert.equal('address' in request, false);
    assert.equal('customerHandoffReceipt' in request, false);
});

test('customer delivery receipt is omitted before fulfillment', () => {
    const request = customerDeliveryRequest({
        id: 'ready-delivery-request-4135',
        operationId: 4137,
        mode: 'delivery',
        state: 'ready',
        createdAt,
        customerHandoffReceipt: {
            fulfilledAt,
            verification: 'verified',
        },
    });

    assert.ok(request);
    assert.equal('customerHandoffReceipt' in request, false);
});

test('customer delivery request rejects missing and unknown modes', () => {
    assert.equal(
        customerDeliveryRequest({
            id: 'missing-mode-4135',
            operationId: 4138,
            state: 'pending',
            createdAt,
        }),
        null,
    );
    assert.equal(
        customerDeliveryRequest({
            id: 'unknown-mode-4135',
            operationId: 4139,
            mode: 'courier',
            state: 'pending',
            createdAt,
        }),
        null,
    );
});
