import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/client';
import { getHudEntityPlacementAvailability } from './itemPlacementAvailability';

const raisedBedBlock = {
    id: 13,
    entityType: { id: 8, name: 'block', label: 'Blok' },
    slug: 'raised-bed',
    information: {
        name: 'Raised_Bed',
        label: 'Gredica',
        shortDescription: 'Gredica',
        fullDescription: 'Gredica',
    },
    attributes: {
        height: 0.3,
        stackable: false,
        type: 'raisedBed',
        nightOnlyPurchase: false,
    },
    prices: { sunflowers: 200 },
    functions: { recycler: false, raisedBed: true },
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z',
} satisfies BlockData;

describe('getHudEntityPlacementAvailability', () => {
    it('uses the price of the single 1 x 2 block', () => {
        const unavailable = getHudEntityPlacementAvailability({
            accountSunflowers: 199,
            block: raisedBedBlock,
            isAccountLoading: false,
            isSandbox: false,
            timeOfDay: 0.5,
        });
        const available = getHudEntityPlacementAvailability({
            accountSunflowers: 200,
            block: raisedBedBlock,
            isAccountLoading: false,
            isSandbox: false,
            timeOfDay: 0.5,
        });

        assert.equal(unavailable.sunflowerPrice, 200);
        assert.equal(unavailable.canPlace, false);
        assert.equal(
            unavailable.insufficientSunflowersMessage,
            'Nedovoljno suncokreta.',
        );
        assert.equal(available.canPlace, true);
    });
});
