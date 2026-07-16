import assert from 'node:assert/strict';
import test from 'node:test';
import {
    deliveryPromiseWindow,
    formatDeliveryDateTimeRange,
    formatDeliveryDurationRange,
} from './deliveryFormatting';

test('accepts only complete, ordered ISO delivery promise windows', () => {
    assert.deepEqual(
        deliveryPromiseWindow(
            '2026-07-16T08:00:00.000Z',
            '2026-07-16T10:00:00.000Z',
        ),
        {
            startAt: '2026-07-16T08:00:00.000Z',
            endAt: '2026-07-16T10:00:00.000Z',
        },
    );
    assert.equal(deliveryPromiseWindow(null, null), null);
    assert.equal(
        deliveryPromiseWindow('not-a-date', '2026-07-16T10:00:00.000Z'),
        null,
    );
    assert.equal(
        deliveryPromiseWindow(
            '2026-07-16T10:00:00.000Z',
            '2026-07-16T08:00:00.000Z',
        ),
        null,
    );
    assert.equal(
        deliveryPromiseWindow(
            '2026-07-16T10:00:00.000Z',
            '2026-07-16T10:00:00.000Z',
        ),
        null,
    );
});

test('includes dates whenever a customer time range crosses a local day', () => {
    const overnightPromise = formatDeliveryDateTimeRange(
        '2026-07-16T21:00:00.000Z',
        '2026-07-16T23:00:00.000Z',
    );
    assert.ok(overnightPromise);
    assert.match(overnightPromise.startLabel, /16\. srp.*23:00/);
    assert.match(overnightPromise.endLabel, /17\. srp.*01:00/);

    const nextDayEta = formatDeliveryDateTimeRange(
        '2026-07-17T08:00:00.000Z',
        '2026-07-17T08:15:00.000Z',
        '2026-07-16T08:00:00.000Z',
    );
    assert.ok(nextDayEta);
    assert.match(nextDayEta.startLabel, /17\. srp.*10:00/);
    assert.equal(nextDayEta.endLabel, '10:15');
});

test('formats customer remaining-time ranges without implying false precision', () => {
    assert.equal(formatDeliveryDurationRange(null, 600), null);
    assert.equal(formatDeliveryDurationRange(0, 0), 'uskoro');
    assert.equal(formatDeliveryDurationRange(0, 300), 'do 5 min');
    assert.equal(formatDeliveryDurationRange(300, 600), '5 min – 10 min');
    assert.equal(formatDeliveryDurationRange(5_400, 5_400), 'oko 1 h 30 min');
});
