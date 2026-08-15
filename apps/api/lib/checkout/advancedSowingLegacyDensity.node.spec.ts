import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildAdvancedSowingLegacyDensitySnapshots } from './advancedSowingLegacyDensity';

describe('Advanced Sowing legacy density snapshots', () => {
    it('captures the density used by active one-field legacy visuals', () => {
        assert.deepEqual(
            buildAdvancedSowingLegacyDensitySnapshots({
                plantings: [
                    {
                        configurationSource: 'legacy',
                        id: 11,
                        isActive: true,
                        plantSortId: 101,
                    },
                    {
                        configurationSource: 'legacy',
                        id: 12,
                        isActive: false,
                        plantSortId: 102,
                    },
                ],
                seedingDistanceByPlantSortId: new Map([[101, 15]]),
            }),
            [
                {
                    layoutKey: 'v1:fields:1x1:plants:2x2',
                    plantingId: 11,
                    plantSortId: 101,
                },
            ],
        );
    });

    it('fails closed by omitting a planting whose catalogue row was not loaded', () => {
        assert.deepEqual(
            buildAdvancedSowingLegacyDensitySnapshots({
                plantings: [
                    {
                        configurationSource: 'legacy',
                        id: 11,
                        isActive: true,
                        plantSortId: 101,
                    },
                ],
                seedingDistanceByPlantSortId: new Map(),
            }),
            [],
        );
    });
});
