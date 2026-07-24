import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getHarvestDateRange,
    getStrictestHarvestLeadDays,
    type HarvestSchedule,
    HarvestScheduleConflictError,
    normalizeMaxHarvestDaysBeforeDelivery,
    validateHarvestDateSelections,
} from '../src/repositories/harvestScheduleRepo';

function scheduleWithRanges(
    ranges: Array<{
        allowedFrom: string;
        allowedTo: string;
        cartItemId: number;
    }>,
): HarvestSchedule {
    const items = ranges.map(({ allowedFrom, allowedTo, cartItemId }) => ({
        allowedFrom,
        allowedTo,
        cartItemId,
        maxHarvestDaysBeforeDelivery: 0,
        operationId: 10,
        operationLabel: 'Berba',
        operationName: 'harvest',
        plants: [],
        positionIndex: null,
        raisedBedId: 20,
        raisedBedLabel: 'Gredica 1',
        raisedBedName: 'Gredica 1',
        scheduledDate: allowedTo,
        targetPositionIndexes: [],
        valid: true,
        validationReason: null,
    }));

    return {
        allValid: true,
        deliveryDate: '2026-08-10',
        deliverySlotId: 30,
        items,
        requiresAdjustment: false,
    };
}

test('same-day harvest produces a one-day inclusive range', () => {
    assert.deepEqual(
        getHarvestDateRange({
            deliveryDate: '2026-08-10',
            maxHarvestDaysBeforeDelivery: 0,
            now: new Date('2026-08-01T12:00:00.000Z'),
        }),
        {
            allowedFrom: '2026-08-10',
            allowedTo: '2026-08-10',
        },
    );
});

test('harvest range uses Zagreb calendar days and never starts before today', () => {
    assert.deepEqual(
        getHarvestDateRange({
            deliveryDate: '2026-03-30',
            maxHarvestDaysBeforeDelivery: 2,
            now: new Date('2026-03-28T23:30:00.000Z'),
        }),
        {
            allowedFrom: '2026-03-29',
            allowedTo: '2026-03-30',
        },
    );
    assert.deepEqual(
        getHarvestDateRange({
            deliveryDate: '2027-01-02',
            maxHarvestDaysBeforeDelivery: 3,
            now: new Date('2026-12-20T12:00:00.000Z'),
        }),
        {
            allowedFrom: '2026-12-30',
            allowedTo: '2027-01-02',
        },
    );
});

test('invalid lead values default conservatively and mixed plants use the strictest value', () => {
    assert.equal(normalizeMaxHarvestDaysBeforeDelivery(undefined), 0);
    assert.equal(normalizeMaxHarvestDaysBeforeDelivery(-2), 0);
    assert.equal(normalizeMaxHarvestDaysBeforeDelivery(2.9), 2);
    assert.equal(normalizeMaxHarvestDaysBeforeDelivery('4'), 4);
    assert.equal(getStrictestHarvestLeadDays([5, 2, 0, 3]), 0);
    assert.equal(getStrictestHarvestLeadDays([5, 2, 3]), 2);
    assert.equal(getStrictestHarvestLeadDays([]), 0);
});

test('validates an exact selection set and returns canonical UTC calendar dates', () => {
    const schedule = scheduleWithRanges([
        {
            cartItemId: 1,
            allowedFrom: '2026-08-08',
            allowedTo: '2026-08-10',
        },
        {
            cartItemId: 2,
            allowedFrom: '2026-08-10',
            allowedTo: '2026-08-10',
        },
    ]);

    assert.deepEqual(
        validateHarvestDateSelections(schedule, [
            { cartItemId: 2, scheduledDate: '2026-08-10' },
            {
                cartItemId: 1,
                scheduledDate: '2026-08-08T00:00:00.000Z',
            },
        ]),
        [
            {
                cartItemId: 1,
                scheduledDate: '2026-08-08T00:00:00.000Z',
            },
            {
                cartItemId: 2,
                scheduledDate: '2026-08-10T00:00:00.000Z',
            },
        ],
    );
});

test('rejects missing, duplicate, stale, and out-of-range selections', () => {
    const schedule = scheduleWithRanges([
        {
            cartItemId: 1,
            allowedFrom: '2026-08-08',
            allowedTo: '2026-08-10',
        },
        {
            cartItemId: 2,
            allowedFrom: '2026-08-10',
            allowedTo: '2026-08-10',
        },
    ]);

    assert.throws(
        () =>
            validateHarvestDateSelections(schedule, [
                { cartItemId: 1, scheduledDate: '2026-08-08' },
                { cartItemId: 1, scheduledDate: '2026-08-09' },
                { cartItemId: 999, scheduledDate: '2026-08-10' },
            ]),
        (error) => {
            assert.ok(error instanceof HarvestScheduleConflictError);
            assert.equal(error.statusCode, 409);
            assert.equal(error.code, 'harvest_date_selection_invalid');
            assert.deepEqual(error.details, {
                duplicateCartItemIds: [1],
                missingCartItemIds: [2],
                unexpectedCartItemIds: [999],
            });
            return true;
        },
    );

    assert.throws(
        () =>
            validateHarvestDateSelections(schedule, [
                { cartItemId: 1, scheduledDate: '2026-08-07' },
                { cartItemId: 2, scheduledDate: '2026-08-10' },
            ]),
        (error) => {
            assert.ok(error instanceof HarvestScheduleConflictError);
            assert.equal(error.details?.reason, 'before_allowed_range');
            assert.equal(error.details?.cartItemId, 1);
            return true;
        },
    );
});
