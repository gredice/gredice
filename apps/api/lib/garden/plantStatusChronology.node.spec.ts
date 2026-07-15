import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPlantStatusEffectiveDateAllowed } from './plantStatusChronology';

const plantCycleStartedAt = new Date('2026-07-01T08:00:00.000Z');

function isAllowed(
    effectiveDate: string,
    previousStatusChangedAt: string | null,
) {
    return isPlantStatusEffectiveDateAllowed({
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
});
