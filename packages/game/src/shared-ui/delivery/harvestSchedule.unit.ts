import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createHarvestScheduleDateSelections,
    getSuggestedHarvestDate,
    type HarvestScheduleItem,
    harvestCalendarDateKey,
    isHarvestDateWithinRange,
} from './harvestSchedule';

const flexibleItem = {
    cartItemId: 1,
    operationLabel: 'Berba mrkve',
    plants: [
        {
            label: 'Mrkva',
            maxHarvestDaysBeforeDelivery: 3,
        },
    ],
    scheduledDate: '2026-07-22T00:00:00.000Z',
    allowedFrom: '2026-07-21',
    allowedTo: '2026-07-24',
    valid: true,
} satisfies HarvestScheduleItem;

test('extracts and validates calendar date keys without timezone shifts', () => {
    assert.equal(
        harvestCalendarDateKey('2026-07-24T23:00:00.000Z'),
        '2026-07-24',
    );
    assert.equal(harvestCalendarDateKey('2026-02-29'), null);
    assert.equal(harvestCalendarDateKey('not-a-date'), null);
});

test('accepts both inclusive harvest range boundaries', () => {
    assert.equal(
        isHarvestDateWithinRange(flexibleItem.allowedFrom, flexibleItem),
        true,
    );
    assert.equal(
        isHarvestDateWithinRange(flexibleItem.allowedTo, flexibleItem),
        true,
    );
    assert.equal(isHarvestDateWithinRange('2026-07-20', flexibleItem), false);
    assert.equal(isHarvestDateWithinRange('2026-07-25', flexibleItem), false);
});

test('suggests the nearest allowed date without changing valid selections', () => {
    assert.equal(
        getSuggestedHarvestDate('2026-07-20', flexibleItem),
        flexibleItem.allowedFrom,
    );
    assert.equal(
        getSuggestedHarvestDate('2026-07-25', flexibleItem),
        flexibleItem.allowedTo,
    );
    assert.equal(
        getSuggestedHarvestDate('2026-07-22', flexibleItem),
        '2026-07-22',
    );
    assert.equal(
        getSuggestedHarvestDate(null, flexibleItem),
        flexibleItem.allowedTo,
    );
    assert.equal(
        getSuggestedHarvestDate('not-a-date', flexibleItem),
        flexibleItem.allowedTo,
    );
    assert.equal(
        getSuggestedHarvestDate('2026-07-22', {
            allowedFrom: '2026-07-24',
            allowedTo: '2026-07-21',
        }),
        null,
    );
});

test('keeps valid dates, preserves flexible corrections, and fixes same-day crops', () => {
    assert.deepEqual(
        createHarvestScheduleDateSelections([
            flexibleItem,
            {
                ...flexibleItem,
                cartItemId: 2,
                scheduledDate: '2026-07-20T00:00:00.000Z',
                valid: false,
            },
            {
                ...flexibleItem,
                cartItemId: 3,
                operationLabel: 'Berba salate',
                scheduledDate: '2026-07-23T00:00:00.000Z',
                allowedFrom: '2026-07-24',
                allowedTo: '2026-07-24',
                valid: false,
            },
        ]),
        [
            {
                cartItemId: 1,
                scheduledDate: '2026-07-22',
            },
            {
                cartItemId: 2,
                scheduledDate: '2026-07-20',
            },
            {
                cartItemId: 3,
                scheduledDate: '2026-07-24',
            },
        ],
    );
});
