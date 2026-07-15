import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getPreviousPlantStatusChangedAtForUpdate,
    isPlantStatusEffectiveDateAllowed,
} from '@gredice/storage';

const plantCycleStartedAt = new Date('2026-07-01T08:00:00.000Z');
const currentDate = new Date('2026-07-15T08:00:00.000Z');

function isAllowed(
    effectiveDate: string,
    previousStatusChangedAt: string | null,
) {
    return isPlantStatusEffectiveDateAllowed({
        currentDate,
        effectiveDate: new Date(effectiveDate),
        plantCycleStartedAt,
        previousStatusChangedAt: previousStatusChangedAt
            ? new Date(previousStatusChangedAt)
            : null,
    });
}

describe('plant status effective-date chronology', () => {
    it('uses the cycle start before the first status change', () => {
        assert.equal(isAllowed('2026-07-07T08:00:00.000Z', null), true);
        assert.equal(isAllowed('2026-06-30T08:00:00.000Z', null), false);
    });

    it('allows consecutive backdated statuses in effective-date order', () => {
        assert.equal(
            isAllowed('2026-07-14T08:00:00.000Z', '2026-07-07T08:00:00.000Z'),
            true,
        );
    });

    it('rejects reverse chronology and allows the same effective date', () => {
        assert.equal(
            isAllowed('2026-07-07T08:00:00.000Z', '2026-07-14T08:00:00.000Z'),
            false,
        );
        assert.equal(
            isAllowed('2026-07-14T08:00:00.000Z', '2026-07-14T08:00:00.000Z'),
            true,
        );
    });

    it('treats lifecycle values as Zagreb calendar dates', () => {
        assert.equal(
            isPlantStatusEffectiveDateAllowed({
                currentDate: new Date('2026-07-15T08:00:00.000Z'),
                effectiveDate: new Date('2026-07-15T10:00:00.000Z'),
                plantCycleStartedAt,
                previousStatusChangedAt: new Date('2026-07-15T10:00:00.000Z'),
            }),
            true,
        );
        assert.equal(
            isPlantStatusEffectiveDateAllowed({
                currentDate: new Date('2026-07-15T08:00:00.000Z'),
                effectiveDate: new Date('2026-07-15T08:00:00.000Z'),
                plantCycleStartedAt,
                previousStatusChangedAt: new Date('2026-07-15T10:00:00.000Z'),
            }),
            true,
        );
    });

    it('rejects a future Zagreb calendar day', () => {
        assert.equal(isAllowed('2026-07-16T10:00:00.000Z', null), false);
    });

    it('uses the latest state for transitions and the prior state for date corrections', () => {
        const plannedAt = new Date('2026-07-07T10:00:00.000Z');
        const sowedAt = new Date('2026-07-14T10:00:00.000Z');
        const statusChanges = [
            { occurredAt: plannedAt, status: 'planned' },
            { occurredAt: sowedAt, status: 'sowed' },
        ];

        assert.equal(
            getPreviousPlantStatusChangedAtForUpdate({
                currentStatus: 'sowed',
                latestStatusChangedAt: sowedAt,
                nextStatus: 'sprouted',
                statusChanges,
            }),
            sowedAt,
        );
        assert.equal(
            getPreviousPlantStatusChangedAtForUpdate({
                currentStatus: 'sowed',
                latestStatusChangedAt: sowedAt,
                nextStatus: 'sowed',
                statusChanges,
            }),
            plannedAt,
        );
    });
});
