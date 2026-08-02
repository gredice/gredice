import { expect, test } from '@playwright/test';
import { isHarvestLabelEligible } from './scheduleLabelEligibility';

test('prints harvest labels only for plants ready for harvest', () => {
    expect(isHarvestLabelEligible({ plantStatus: 'ready' })).toBe(true);

    for (const plantStatus of ['sprouted', 'firstFruitSet', 'harvested']) {
        expect(isHarvestLabelEligible({ plantStatus })).toBe(false);
    }

    expect(isHarvestLabelEligible({ plantStatus: null })).toBe(false);
    expect(isHarvestLabelEligible({})).toBe(false);
});
