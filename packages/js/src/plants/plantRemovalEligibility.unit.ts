import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    canRemovePlantWithoutOperation,
    getActivePlantCycleStatusChanges,
    isCleanHarvestAttribute,
    plantCycleHasSprouted,
} from './plantRemovalEligibility';

test('never-sprouted fields can be removed without a paid operation', () => {
    assert.equal(
        canRemovePlantWithoutOperation({
            plantStatus: 'notSprouted',
            statusChanges: [{ status: 'sowed' }, { status: 'notSprouted' }],
        }),
        true,
    );
});

test('changing a sprouted plant to notSprouted does not skip paid removal', () => {
    assert.equal(
        canRemovePlantWithoutOperation({
            plantStatus: 'notSprouted',
            statusChanges: [
                { status: 'sowed' },
                { status: 'sprouted' },
                { status: 'notSprouted' },
            ],
        }),
        false,
    );
});

test('harvested clean-harvest plants can be removed without a paid operation', () => {
    assert.equal(
        canRemovePlantWithoutOperation({
            plantStatus: 'harvested',
            cleanHarvest: true,
        }),
        true,
    );
});

test('harvested plants without clean harvest require the removal operation', () => {
    assert.equal(
        canRemovePlantWithoutOperation({
            plantStatus: 'harvested',
            cleanHarvest: false,
        }),
        false,
    );
    assert.equal(
        canRemovePlantWithoutOperation({
            plantStatus: 'harvested',
        }),
        false,
    );
});

test('dead or still-growing plants cannot be removed without a paid operation', () => {
    for (const plantStatus of [
        'sowed',
        'sprouted',
        'firstFlowers',
        'firstFruitSet',
        'ready',
        'died',
        'removed',
    ]) {
        assert.equal(
            canRemovePlantWithoutOperation({
                plantStatus,
                cleanHarvest: true,
                statusChanges: [{ status: plantStatus }],
            }),
            false,
            plantStatus,
        );
    }
});

test('plant cycle sprout history follows growth statuses, not current notSprouted', () => {
    assert.equal(
        plantCycleHasSprouted({
            plantStatus: 'notSprouted',
            statusChanges: [{ status: 'sowed' }, { status: 'notSprouted' }],
        }),
        false,
    );
    assert.equal(
        plantCycleHasSprouted({
            plantStatus: 'notSprouted',
            statusChanges: [{ status: 'sprouted' }, { status: 'notSprouted' }],
        }),
        true,
    );
    assert.equal(
        plantCycleHasSprouted({
            plantStatus: 'ready',
        }),
        true,
    );
});

test('clean harvest is only true for an explicit boolean true', () => {
    assert.equal(isCleanHarvestAttribute(true), true);
    assert.equal(isCleanHarvestAttribute(false), false);
    assert.equal(isCleanHarvestAttribute('true'), false);
    assert.equal(isCleanHarvestAttribute(undefined), false);
});

test('active plant cycle status changes come from the live cycle', () => {
    assert.deepEqual(
        getActivePlantCycleStatusChanges([
            {
                active: false,
                statusChanges: [{ status: 'harvested' }],
            },
            {
                active: true,
                statusChanges: [{ status: 'sowed' }, { status: 'notSprouted' }],
            },
        ]),
        [{ status: 'sowed' }, { status: 'notSprouted' }],
    );
});
