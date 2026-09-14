import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getRaisedBedFieldActivePlantIdentity } from '../../utils/raisedBedFields';
import {
    type AdvancedSowingGardenPlantingInput,
    buildAdvancedSowingGardenPlantingVisuals,
    groupAdvancedSowingGardenPlantingsByFootprint,
    indexAdvancedSowingPlantingsByPosition,
} from './advancedSowingGardenVisuals';
import { plantLifecycleMilestones } from './plantLifecycleMilestones';
import { selectedPlantingField } from './selectedPlantingField';

function selectedPlanting(
    overrides: Partial<AdvancedSowingGardenPlantingInput> = {},
): AdvancedSowingGardenPlantingInput {
    return {
        anchorPositionIndex: 17,
        configurationSource: 'selected',
        id: 901,
        isActive: true,
        layoutKey: 'v1:fields:1x1:plants:2x2',
        layoutVersion: 1,
        lifecycleStartedAt: '2026-08-10T08:00:00.000Z',
        lifecycleStatus: 'planned',
        memberships: [
            {
                isAnchor: true,
                positionIndex: 17,
                relativeColumn: 0,
                relativeRow: 0,
            },
        ],
        plantCount: 4,
        plantSortId: 42,
        plantsPerAxis: 2,
        selectedSeedingDistanceCm: 15,
        spanColumns: 1,
        spanRows: 1,
        ...overrides,
    };
}

describe('persisted Advanced Sowing Garden visuals', () => {
    it('keeps two co-plantings in one field as distinct planting choices', () => {
        const visuals = buildAdvancedSowingGardenPlantingVisuals(
            [
                selectedPlanting(),
                selectedPlanting({
                    id: 902,
                    layoutKey: 'v1:fields:1x1:plants:1x1',
                    plantCount: 1,
                    plantSortId: 43,
                    plantsPerAxis: 1,
                    selectedSeedingDistanceCm: 30,
                }),
            ],
            18,
        );
        const byPosition = indexAdvancedSowingPlantingsByPosition(visuals);

        assert.deepEqual(
            visuals.map((planting) => planting.id),
            [901, 902],
        );
        assert.deepEqual(
            byPosition.get(17)?.map((planting) => planting.id),
            [901, 902],
        );
        const groups = groupAdvancedSowingGardenPlantingsByFootprint(visuals);
        assert.equal(groups.length, 1);
        assert.deepEqual(
            groups[0]?.plantings.map((planting) => planting.id),
            [901, 902],
        );
    });

    it('keeps one 2 by 2 planting with all four persisted memberships', () => {
        const visuals = buildAdvancedSowingGardenPlantingVisuals(
            [
                selectedPlanting({
                    layoutKey: 'v1:fields:2x2:plants:1x1',
                    memberships: [
                        {
                            isAnchor: false,
                            positionIndex: 13,
                            relativeColumn: 1,
                            relativeRow: 1,
                        },
                        {
                            isAnchor: true,
                            positionIndex: 17,
                            relativeColumn: 0,
                            relativeRow: 0,
                        },
                        {
                            isAnchor: false,
                            positionIndex: 14,
                            relativeColumn: 0,
                            relativeRow: 1,
                        },
                        {
                            isAnchor: false,
                            positionIndex: 16,
                            relativeColumn: 1,
                            relativeRow: 0,
                        },
                    ],
                    plantCount: 1,
                    plantsPerAxis: 1,
                    selectedSeedingDistanceCm: 60,
                    spanColumns: 2,
                    spanRows: 2,
                }),
            ],
            18,
        );

        assert.equal(visuals.length, 1);
        assert.deepEqual(
            visuals[0]?.memberships.map(
                (membership) => membership.positionIndex,
            ),
            [17, 16, 14, 13],
        );
        assert.deepEqual(
            Array.from(indexAdvancedSowingPlantingsByPosition(visuals).keys()),
            [17, 16, 14, 13],
        );
        assert.deepEqual(
            groupAdvancedSowingGardenPlantingsByFootprint(visuals)[0]
                ?.positionIndices,
            [13, 14, 16, 17],
        );
    });

    it('fails closed for incomplete selected snapshots and ignores legacy rows', () => {
        assert.deepEqual(
            buildAdvancedSowingGardenPlantingVisuals(
                [
                    selectedPlanting({ plantCount: null }),
                    selectedPlanting({
                        configurationSource: 'legacy',
                        id: 902,
                    }),
                ],
                18,
            ),
            [],
        );
    });

    it('deduplicates a repeated planting projection by planting id', () => {
        assert.equal(
            buildAdvancedSowingGardenPlantingVisuals(
                [selectedPlanting(), selectedPlanting()],
                18,
            ).length,
            1,
        );
    });

    it('keeps authoritative lifecycle status in the compatibility visual', () => {
        assert.equal(
            buildAdvancedSowingGardenPlantingVisuals(
                [selectedPlanting({ lifecycleStatus: 'sprouted' })],
                18,
            )[0]?.lifecycleStatus,
            'sprouted',
        );
    });
});

describe('selected planting in the existing field HUD', () => {
    it('does not turn lifecycle creation into a sowing date or a legacy mutation identity', () => {
        const [planting] = buildAdvancedSowingGardenPlantingVisuals(
            [selectedPlanting()],
            18,
        );
        assert.ok(planting);
        const field = selectedPlantingField(planting, 17);
        assert.equal(field.plantSowDate, null);
        assert.equal(field.plantGrowthDate, undefined);
        assert.equal(getRaisedBedFieldActivePlantIdentity(field), null);
        assert.deepEqual(plantLifecycleMilestones(field), {
            sowed: false,
            sprouted: false,
            ready: false,
            harvested: false,
        });
    });

    it('uses recorded sowing completion and keeps undated later milestones honest', () => {
        const [planting] = buildAdvancedSowingGardenPlantingVisuals(
            [
                selectedPlanting({
                    lifecycleStatus: 'ready',
                    selectedTask: {
                        scheduledDate: '2026-08-12',
                        sowingLocation: 'direct',
                        status: 'completed',
                        completion: {
                            completedAt: '2026-08-13T10:00:00Z',
                            status: 'pendingVerification',
                        },
                        verification: { verifiedAt: '2026-08-14T10:00:00Z' },
                    },
                }),
            ],
            18,
        );
        assert.ok(planting);
        const field = selectedPlantingField(planting, 17);
        assert.equal(field.plantSowDate, '2026-08-13T10:00:00.000Z');
        assert.equal(field.plantGrowthDate, undefined);
        assert.equal(field.plantReadyDate, undefined);
        assert.deepEqual(plantLifecycleMilestones(field), {
            sowed: true,
            sprouted: true,
            ready: true,
            harvested: false,
        });
        assert.equal(getRaisedBedFieldActivePlantIdentity(field), null);
    });
});
