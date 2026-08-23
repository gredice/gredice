import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDeliveryRequestStatistics } from './deliveryRequestStatistics';

function slot(id: number, startAt: string, endAt: string) {
    return {
        id,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
    };
}

test('aggregates requests into deliveries by account and slot', () => {
    const mondayMorning = slot(
        11,
        '2026-07-06T06:00:00.000Z',
        '2026-07-06T08:00:00.000Z',
    );
    const tuesdayMorning = slot(
        12,
        '2026-07-07T08:00:00.000Z',
        '2026-07-07T10:00:00.000Z',
    );

    const statistics = buildDeliveryRequestStatistics([
        {
            id: 'request-1',
            accountId: 'account-1',
            state: 'fulfilled',
            mode: 'delivery',
            createdAt: new Date('2026-06-20T10:00:00.000Z'),
            slot: mondayMorning,
        },
        {
            id: 'request-2',
            accountId: 'account-1',
            state: 'fulfilled',
            mode: 'delivery',
            createdAt: new Date('2026-07-01T10:00:00.000Z'),
            slot: mondayMorning,
        },
        {
            id: 'request-3',
            accountId: 'account-2',
            state: 'cancelled',
            mode: 'pickup',
            createdAt: new Date('2026-07-02T10:00:00.000Z'),
            slot: tuesdayMorning,
        },
        {
            id: 'request-4',
            accountId: 'account-3',
            state: 'pending',
            mode: 'delivery',
            createdAt: new Date('2026-07-03T10:00:00.000Z'),
            slot: mondayMorning,
        },
        {
            id: 'request-5',
            accountId: 'account-4',
            state: 'ready',
            createdAt: new Date('2026-07-04T10:00:00.000Z'),
        },
    ]);

    assert.deepEqual(statistics.summary, {
        totalRequests: 5,
        assignedRequests: 4,
        totalDeliveries: 3,
        uniqueSlots: 2,
        averageRequestsPerDelivery: 1.3,
        multiRequestDeliveries: 1,
        multiRequestDeliveryRate: 33,
        largestDeliverySize: 2,
        fulfilledRequests: 2,
        cancelledRequests: 1,
        completionRate: 40,
        cancellationRate: 20,
    });
    assert.equal(
        statistics.deliveryWeekdays.find((item) => item.label === 'Pon')?.count,
        2,
    );
    assert.equal(
        statistics.deliveryWeekdays.find((item) => item.label === 'Uto')?.count,
        1,
    );
    assert.deepEqual(statistics.deliveryTimeWindows, [
        { label: '08:00–10:00', count: 2 },
        { label: '10:00–12:00', count: 1 },
    ]);
    assert.deepEqual(statistics.deliverySizes, [
        { requestCount: 1, label: '1', count: 2 },
        { requestCount: 2, label: '2', count: 1 },
    ]);
    assert.deepEqual(statistics.modes, [
        { label: 'Dostava', count: 3 },
        { label: 'Preuzimanje', count: 1 },
        { label: 'Nije određeno', count: 1 },
    ]);
    assert.deepEqual(
        statistics.trend.map(({ month, count }) => ({ month, count })),
        [
            { month: '2026-06', count: 1 },
            { month: '2026-07', count: 4 },
        ],
    );
});

test('fills zero-demand months between the first and last request', () => {
    const statistics = buildDeliveryRequestStatistics([
        {
            id: 'request-january',
            state: 'fulfilled',
            createdAt: new Date('2026-01-15T10:00:00.000Z'),
        },
        {
            id: 'request-april',
            state: 'fulfilled',
            createdAt: new Date('2026-04-15T10:00:00.000Z'),
        },
    ]);

    assert.deepEqual(
        statistics.trend.map(({ month, count }) => ({ month, count })),
        [
            { month: '2026-01', count: 1 },
            { month: '2026-02', count: 0 },
            { month: '2026-03', count: 0 },
            { month: '2026-04', count: 1 },
        ],
    );
});

test('returns stable empty chart series when there are no requests', () => {
    const statistics = buildDeliveryRequestStatistics([]);

    assert.equal(statistics.summary.totalRequests, 0);
    assert.equal(statistics.summary.totalDeliveries, 0);
    assert.equal(statistics.summary.averageRequestsPerDelivery, 0);
    assert.equal(statistics.summary.multiRequestDeliveryRate, 0);
    assert.equal(statistics.summary.completionRate, 0);
    assert.equal(statistics.summary.cancellationRate, 0);
    assert.deepEqual(
        statistics.deliveryWeekdays.map((item) => item.count),
        [0, 0, 0, 0, 0, 0, 0],
    );
    assert.deepEqual(statistics.deliverySizes, []);
    assert.deepEqual(statistics.states, []);
    assert.deepEqual(statistics.trend, []);
});
