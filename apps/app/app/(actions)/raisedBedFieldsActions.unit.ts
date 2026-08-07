import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCurrentRaisedBedFieldPlantUpdateVersion } from './raisedBedFieldPlantUpdateVersion.ts';

const expectedField = {
    id: 1,
    plantStatus: 'firstFlowers',
    plantStatusEventId: 30,
    plantSortId: 101,
    plantCycles: [
        {
            active: true,
            plantPlaceEventId: 10,
            endedEventId: 30,
        },
    ],
};

test('status-only plant update can use status-event version after non-status cycle drift', () => {
    assert.equal(
        hasCurrentRaisedBedFieldPlantUpdateVersion({
            existingField: {
                ...expectedField,
                plantCycles: [
                    {
                        active: true,
                        plantPlaceEventId: 10,
                        endedEventId: 40,
                    },
                ],
            },
            expectedField,
            expectedPlantCycleEventId: 10,
            expectedPlantCycleVersionEventId: 30,
            expectedPlantSortId: 101,
            expectedPlantStatus: 'firstFlowers',
            expectedPlantStatusEventId: 30,
            nextStatus: 'sowed',
        }),
        true,
    );
});

test('status-only plant update rejects stale status events', () => {
    assert.equal(
        hasCurrentRaisedBedFieldPlantUpdateVersion({
            existingField: {
                ...expectedField,
                plantStatus: 'ready',
                plantStatusEventId: 41,
                plantCycles: [
                    {
                        active: true,
                        plantPlaceEventId: 10,
                        endedEventId: 41,
                    },
                ],
            },
            expectedField,
            expectedPlantCycleEventId: 10,
            expectedPlantCycleVersionEventId: 30,
            expectedPlantSortId: 101,
            expectedPlantStatus: 'firstFlowers',
            expectedPlantStatusEventId: 30,
            nextStatus: 'sowed',
        }),
        false,
    );
});

test('plant sort updates still require the full cycle version', () => {
    assert.equal(
        hasCurrentRaisedBedFieldPlantUpdateVersion({
            existingField: {
                ...expectedField,
                plantCycles: [
                    {
                        active: true,
                        plantPlaceEventId: 10,
                        endedEventId: 40,
                    },
                ],
            },
            expectedField,
            expectedPlantCycleEventId: 10,
            expectedPlantCycleVersionEventId: 30,
            expectedPlantSortId: 101,
            expectedPlantStatus: 'firstFlowers',
            expectedPlantStatusEventId: 30,
            nextPlantSortId: 202,
            nextStatus: 'firstFlowers',
        }),
        false,
    );
});

test('status-scoped version check requires a rendered status expectation', () => {
    assert.equal(
        hasCurrentRaisedBedFieldPlantUpdateVersion({
            existingField: {
                ...expectedField,
                plantCycles: [
                    {
                        active: true,
                        plantPlaceEventId: 10,
                        endedEventId: 40,
                    },
                ],
            },
            expectedField,
            expectedPlantCycleEventId: 10,
            expectedPlantCycleVersionEventId: 30,
            expectedPlantSortId: 101,
            nextStatus: 'sowed',
        }),
        false,
    );
});
