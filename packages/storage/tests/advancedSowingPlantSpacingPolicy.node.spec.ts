import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    advancedSowingCanonicalDistancesCm,
    advancedSowingPlantSpacing,
    advancedSowingPlantSpacingByNormalizedName,
    getAdvancedSowingPlantSpacingOptions,
} from '../scripts/lib/advancedSowingPlantSpacingPolicy';

describe('Advanced Sowing plant spacing policy', () => {
    it('covers 47 uniquely named plants with canonical square-foot distances', () => {
        const byName = advancedSowingPlantSpacingByNormalizedName(
            advancedSowingPlantSpacing,
        );

        assert.equal(advancedSowingPlantSpacing.length, 47);
        assert.equal(byName.size, 47);
        for (const entry of advancedSowingPlantSpacing) {
            for (const distance of [
                entry.minDistanceCm,
                entry.optimalDistanceCm,
                entry.maxDistanceCm,
            ]) {
                assert.ok(
                    advancedSowingCanonicalDistancesCm.some(
                        (canonicalDistance) => canonicalDistance === distance,
                    ),
                );
            }
            assert.ok(entry.minDistanceCm <= entry.optimalDistanceCm);
            assert.ok(entry.optimalDistanceCm <= entry.maxDistanceCm);
            assert.ok(getAdvancedSowingPlantSpacingOptions(entry).length > 0);
        }
    });

    it('offers Matovilac dense, standard, and less-dense square layouts', () => {
        const matovilac = advancedSowingPlantSpacing.find(
            (entry) => entry.name === 'Matovilac',
        );
        assert.ok(matovilac);

        assert.deepEqual(
            getAdvancedSowingPlantSpacingOptions(matovilac).map(
                (option) => option.plantCount,
            ),
            [36, 25, 16, 9],
        );
    });

    it('keeps large crops within the supported 3-column bed geometry', () => {
        const tikvice = advancedSowingPlantSpacing.find(
            (entry) => entry.name === 'Tikvice',
        );
        const artichoke = advancedSowingPlantSpacing.find(
            (entry) => entry.name === 'Artičoka',
        );
        assert.ok(tikvice);
        assert.ok(artichoke);

        assert.deepEqual(
            getAdvancedSowingPlantSpacingOptions(tikvice).map((option) => [
                option.fieldSpanRows,
                option.fieldSpanColumns,
            ]),
            [
                [1, 1],
                [2, 2],
                [3, 3],
            ],
        );
        assert.deepEqual(
            getAdvancedSowingPlantSpacingOptions(artichoke).map((option) => [
                option.fieldSpanRows,
                option.fieldSpanColumns,
            ]),
            [[3, 3]],
        );
    });
});
