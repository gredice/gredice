import { expect, test } from '@playwright/test';
import {
    findHarvestLabelPlantCycleAtDate,
    isHarvestLabelEligible,
} from './scheduleLabelEligibility';

test('prints an explicitly targeted field regardless of plant status', () => {
    for (const plantStatus of [
        'sprouted',
        'firstFruitSet',
        'ready',
        'harvested',
        null,
        undefined,
    ]) {
        expect(isHarvestLabelEligible({ plantStatus }, 'explicitField')).toBe(
            true,
        );
    }
});

test('prints only ready plants when harvesting a whole raised bed', () => {
    expect(isHarvestLabelEligible({ plantStatus: 'ready' }, 'raisedBed')).toBe(
        true,
    );

    for (const plantStatus of ['sprouted', 'firstFruitSet', 'harvested']) {
        expect(isHarvestLabelEligible({ plantStatus }, 'raisedBed')).toBe(
            false,
        );
    }

    expect(isHarvestLabelEligible({ plantStatus: null }, 'raisedBed')).toBe(
        false,
    );
    expect(isHarvestLabelEligible({}, 'raisedBed')).toBe(false);
});

test('binds an explicit label to the plant cycle at the operation date', () => {
    const firstCycle = {
        plantPlaceEventId: 101,
        plantSortId: 11,
        startedAt: new Date('2026-05-01T08:00:00.000Z'),
    };
    const replacementCycle = {
        plantPlaceEventId: 202,
        plantSortId: 22,
        startedAt: new Date('2026-07-01T08:00:00.000Z'),
    };
    const cycles = [replacementCycle, firstCycle];

    expect(
        findHarvestLabelPlantCycleAtDate(
            cycles,
            new Date('2026-06-15T08:00:00.000Z'),
        ),
    ).toBe(firstCycle);
    expect(
        findHarvestLabelPlantCycleAtDate(
            cycles,
            new Date('2026-07-15T08:00:00.000Z'),
        ),
    ).toBe(replacementCycle);
    expect(
        findHarvestLabelPlantCycleAtDate(
            cycles,
            new Date('2026-04-15T08:00:00.000Z'),
        ),
    ).toBeUndefined();
});
