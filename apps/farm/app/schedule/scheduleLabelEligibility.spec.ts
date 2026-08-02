import { expect, test } from '@playwright/test';
import { isHarvestLabelEligible } from './scheduleLabelEligibility';

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
