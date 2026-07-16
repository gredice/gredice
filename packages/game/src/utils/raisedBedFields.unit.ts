import assert from 'node:assert/strict';
import test from 'node:test';
import { getRaisedBedFieldActivePlantIdentity } from './raisedBedFields';

test('active plant identity prefers the current cycle over stale field values', () => {
    assert.deepEqual(
        getRaisedBedFieldActivePlantIdentity({
            plantCycles: [
                {
                    active: false,
                    endedEventId: 11,
                    plantPlaceEventId: 10,
                    plantSortId: 100,
                },
                {
                    active: true,
                    endedEventId: 21,
                    plantPlaceEventId: 20,
                    plantSortId: 200,
                },
            ],
            plantPlaceEventId: 10,
            plantSortId: 100,
            positionIndex: 0,
        }),
        {
            plantCycleVersionEventId: 21,
            plantPlaceEventId: 20,
            plantSortId: 200,
        },
    );
});

test('active plant identity fails closed without an exact cycle version', () => {
    assert.equal(
        getRaisedBedFieldActivePlantIdentity({
            plantCycles: [],
            plantPlaceEventId: 30,
            plantSortId: 300,
            positionIndex: 0,
        }),
        null,
    );
});

test('active plant identity fails closed when either identity value is missing', () => {
    assert.equal(
        getRaisedBedFieldActivePlantIdentity({
            plantPlaceEventId: 40,
            plantSortId: null,
            positionIndex: 0,
        }),
        null,
    );
});
