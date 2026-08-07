import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldRenderRaisedBedPlant } from './raisedBedPlantVisualStatus';

const sowDate = '2026-05-23T19:19:50.074Z';

test('raised-bed plants stay visible throughout above-ground lifecycle stages', () => {
    for (const plantStatus of [
        'sprouted',
        'firstFlowers',
        'firstFruitSet',
        'ready',
        'harvested',
    ]) {
        assert.equal(
            shouldRenderRaisedBedPlant({ plantSowDate: sowDate, plantStatus }),
            true,
            plantStatus,
        );
    }
});

test('raised-bed plants stay as seed visuals before sprouting or after failure', () => {
    for (const plantStatus of [
        undefined,
        'new',
        'planned',
        'pendingVerification',
        'sowed',
        'notSprouted',
        'died',
        'removed',
    ]) {
        assert.equal(
            shouldRenderRaisedBedPlant({ plantSowDate: sowDate, plantStatus }),
            false,
            plantStatus,
        );
    }
});

test('raised-bed plants require a sow date before rendering', () => {
    assert.equal(
        shouldRenderRaisedBedPlant({ plantStatus: 'firstFlowers' }),
        false,
    );
});
