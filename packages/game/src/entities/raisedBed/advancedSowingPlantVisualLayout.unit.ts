import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_PLANT_GENERATION } from '../../generators/plant/lib/plant-definitions';
import {
    type AdvancedSowingWorldPosition,
    buildAdvancedSowingPlantVisualLayout,
    getSelectedPlantingVisualGeneration,
} from './advancedSowingPlantVisualLayout';

describe('Advanced Sowing generated-plant layout', () => {
    it('places one multi-field plant at the persisted footprint centroid', () => {
        const fieldPositionByIndex = new Map<
            number,
            AdvancedSowingWorldPosition
        >([
            [13, [-1, -0.75, -1]],
            [14, [1, -0.75, -1]],
            [16, [-1, -0.75, 1]],
            [17, [1, -0.75, 1]],
        ]);
        const layout = buildAdvancedSowingPlantVisualLayout({
            fieldPositionByIndex,
            planting: {
                memberships: [
                    { positionIndex: 17 },
                    { positionIndex: 16 },
                    { positionIndex: 14 },
                    { positionIndex: 13 },
                ],
                plantCount: 1,
                plantsPerAxis: 1,
            },
        });

        assert.deepEqual(layout?.centroid, [0, -0.75, 0]);
        assert.deepEqual(layout?.instancePositions, [[0, -0.73, 0]]);
    });

    it('uses persisted same-field density without multiplying by memberships', () => {
        const fieldPositionByIndex = new Map<
            number,
            AdvancedSowingWorldPosition
        >([[17, [2, -0.75, 3]]]);
        const layout = buildAdvancedSowingPlantVisualLayout({
            fieldPositionByIndex,
            planting: {
                memberships: [{ positionIndex: 17 }],
                plantCount: 4,
                plantsPerAxis: 2,
            },
        });

        assert.equal(layout?.instancePositions.length, 4);
        assert.deepEqual(layout?.centroid, [2, -0.75, 3]);
        assert.deepEqual(layout?.instancePositions, [
            [1.935, -0.73, 2.935],
            [1.935, -0.73, 3.065],
            [2.065, -0.73, 2.935],
            [2.065, -0.73, 3.065],
        ]);
    });

    it('fails closed when persisted count and density disagree', () => {
        const fieldPositionByIndex = new Map<
            number,
            AdvancedSowingWorldPosition
        >([[17, [0, -0.75, 0]]]);
        assert.equal(
            buildAdvancedSowingPlantVisualLayout({
                fieldPositionByIndex,
                planting: {
                    memberships: [{ positionIndex: 17 }],
                    plantCount: 3,
                    plantsPerAxis: 2,
                },
            }),
            null,
        );
    });

    it('derives visibility and growth only from authoritative lifecycle status', () => {
        assert.equal(getSelectedPlantingVisualGeneration('planned'), null);
        assert.equal(getSelectedPlantingVisualGeneration('sowed'), null);
        assert.equal(
            getSelectedPlantingVisualGeneration('sprouted'),
            MAX_PLANT_GENERATION * 0.25,
        );
        assert.equal(
            getSelectedPlantingVisualGeneration('ready'),
            MAX_PLANT_GENERATION,
        );
        assert.equal(getSelectedPlantingVisualGeneration('removed'), null);
    });
});
