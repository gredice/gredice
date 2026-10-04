import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeTimeSlotsQueryParams } from './timeSlotsQueryParams';

test('requests closed and archived slots for historical week context', () => {
    assert.deepEqual(
        serializeTimeSlotsQueryParams({
            from: '2026-07-13T00:00:00.000Z',
            includeArchived: true,
            includeClosed: true,
            locationId: 4,
            to: '2026-08-17T00:00:00.000Z',
        }),
        {
            from: '2026-07-13T00:00:00.000Z',
            includeArchived: 'true',
            includeClosed: 'true',
            locationId: '4',
            to: '2026-08-17T00:00:00.000Z',
            type: undefined,
        },
    );
});
