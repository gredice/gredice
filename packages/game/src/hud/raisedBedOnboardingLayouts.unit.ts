import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    getRaisedBedOnboardingLayouts,
    type RaisedBedOnboardingPlantSortCandidate,
    resolveRaisedBedOnboardingCrops,
} from './raisedBedOnboardingLayouts';

function plantSort({
    id,
    antagonistPlantIds,
    companionPlantIds,
    plantId = id + 10_000,
    plantName,
    sortName,
    availableInStore = true,
}: {
    id: number;
    antagonistPlantIds?: number[];
    companionPlantIds?: number[];
    plantId?: number;
    plantName: string;
    sortName: string;
    availableInStore?: boolean;
}): RaisedBedOnboardingPlantSortCandidate {
    const relationships =
        antagonistPlantIds?.length || companionPlantIds?.length
            ? {
                  antagonists: antagonistPlantIds?.map((antagonistPlantId) => ({
                      id: antagonistPlantId,
                      name: `Plant ${antagonistPlantId.toString()}`,
                  })),
                  companions: companionPlantIds?.map((companionPlantId) => ({
                      id: companionPlantId,
                      name: `Plant ${companionPlantId.toString()}`,
                  })),
              }
            : null;

    return {
        id,
        information: {
            name: sortName,
            plant: {
                id: plantId,
                relationships,
                information: {
                    name: plantName,
                },
            },
        },
        store: {
            availableInStore,
        },
    };
}

const availableSorts = [
    plantSort({
        id: 206,
        plantName: 'Rajčica',
        sortName: 'Rajčica saint pierre',
    }),
    plantSort({
        id: 216,
        plantName: 'Paprika',
        sortName: 'Paprika crvena roga',
    }),
    plantSort({
        id: 226,
        plantName: 'Krastavac',
        sortName: 'Krastavac pariški kornišon',
    }),
    plantSort({
        id: 230,
        plantName: 'Mrkva',
        sortName: 'Mrkva nantes',
    }),
    plantSort({
        id: 284,
        plantName: 'Špinat',
        sortName: 'Špinat matador',
    }),
    plantSort({
        id: 357,
        plantName: 'Salata',
        sortName: 'Salata vegorka',
    }),
    plantSort({
        id: 373,
        plantName: 'Luk',
        sortName: 'Luk Stuttgarter (lukovica)',
    }),
    plantSort({
        id: 353,
        plantName: 'Brokula',
        sortName: 'Brokula gea F1',
    }),
];

describe('raised bed onboarding layouts', () => {
    test('resolves current store-available crop sorts before old unavailable ids', () => {
        const crops = resolveRaisedBedOnboardingCrops([
            plantSort({
                id: 337,
                plantName: 'Rajčica',
                sortName: 'Rajčica fiaschetto',
                availableInStore: false,
            }),
            ...availableSorts,
        ]);

        assert.equal(crops.tomato?.sortId, 206);
        assert.equal(crops.pepper?.sortId, 216);
        assert.equal(crops.carrot?.sortId, 230);
    });

    test('every suggested layout fills twelve fields and leaves six customizable fields', () => {
        const crops = resolveRaisedBedOnboardingCrops(availableSorts);
        const layouts = getRaisedBedOnboardingLayouts({
            care: 'balanced',
            crops,
            goal: 'salads',
        });

        assert.equal(layouts.length, 4);
        for (const layout of layouts) {
            assert.equal(layout.placements.length, 12, layout.id);
            assert.equal(layout.emptyPositionIndices.length, 6, layout.id);
            assert.equal(
                new Set(layout.placements.map((item) => item.positionIndex))
                    .size,
                12,
                layout.id,
            );
            assert.equal(
                new Set([
                    ...layout.placements.map((item) => item.positionIndex),
                    ...layout.emptyPositionIndices,
                ]).size,
                18,
                layout.id,
            );
        }
    });

    test('suggested layouts use varied empty-field patterns', () => {
        const crops = resolveRaisedBedOnboardingCrops(availableSorts);
        const layouts = getRaisedBedOnboardingLayouts({
            care: 'balanced',
            crops,
            goal: 'salads',
        });

        assert.equal(layouts.length, 4);
        assert.equal(
            new Set(
                layouts.map((layout) => layout.emptyPositionIndices.join(',')),
            ).size,
            layouts.length,
        );
    });

    test('preferences rank the matching personalized layout first', () => {
        const crops = resolveRaisedBedOnboardingCrops(availableSorts);

        assert.equal(
            getRaisedBedOnboardingLayouts({
                care: 'easy',
                crops,
                goal: 'snacks',
            })[0]?.id,
            'snack-path',
        );
        assert.equal(
            getRaisedBedOnboardingLayouts({
                care: 'varied',
                crops,
                goal: 'cooking',
            })[0]?.id,
            'summer-kitchen',
        );
        assert.equal(
            getRaisedBedOnboardingLayouts({
                care: 'easy',
                crops,
                goal: 'autumn',
            })[0]?.id,
            'calm-harvest',
        );
    });

    test('known companion neighbors break otherwise equal suggestion rankings', () => {
        const cucumberPlantId = 10226;
        const lettucePlantId = 10357;
        const crops = resolveRaisedBedOnboardingCrops([
            plantSort({
                id: 226,
                companionPlantIds: [lettucePlantId],
                plantId: cucumberPlantId,
                plantName: 'Krastavac',
                sortName: 'Krastavac pariški kornišon',
            }),
            plantSort({
                id: 357,
                companionPlantIds: [cucumberPlantId],
                plantId: lettucePlantId,
                plantName: 'Salata',
                sortName: 'Salata vegorka',
            }),
            ...availableSorts.filter(
                (sort) => sort.id !== 226 && sort.id !== 357,
            ),
        ]);
        const layouts = getRaisedBedOnboardingLayouts({
            care: 'balanced',
            crops,
            goal: 'salads',
        });

        assert.equal(layouts[0]?.id, 'salad-bowl');
        assert.equal(layouts[1]?.id, 'snack-path');
    });

    test('filters layouts with antagonist plants in neighboring fields', () => {
        const tomatoPlantId = 101;
        const lettucePlantId = 102;
        const crops = resolveRaisedBedOnboardingCrops([
            plantSort({
                id: 206,
                antagonistPlantIds: [lettucePlantId],
                plantId: tomatoPlantId,
                plantName: 'Rajčica',
                sortName: 'Rajčica saint pierre',
            }),
            plantSort({
                id: 357,
                antagonistPlantIds: [tomatoPlantId],
                plantId: lettucePlantId,
                plantName: 'Salata',
                sortName: 'Salata vegorka',
            }),
            ...availableSorts.filter(
                (sort) => sort.id !== 206 && sort.id !== 357,
            ),
        ]);
        const layouts = getRaisedBedOnboardingLayouts({
            care: 'balanced',
            crops,
            goal: 'salads',
        });

        assert.ok(layouts.length > 0);
        assert.equal(
            layouts.some((layout) => layout.id === 'salad-bowl'),
            false,
        );
    });

    test('does not fall back to layouts with antagonist neighbors', () => {
        const plantFixtures = [
            {
                id: 206,
                plantId: 101,
                plantName: 'Rajčica',
                sortName: 'Rajčica saint pierre',
            },
            {
                id: 216,
                plantId: 102,
                plantName: 'Paprika',
                sortName: 'Paprika crvena roga',
            },
            {
                id: 226,
                plantId: 103,
                plantName: 'Krastavac',
                sortName: 'Krastavac pariški kornišon',
            },
            {
                id: 230,
                plantId: 104,
                plantName: 'Mrkva',
                sortName: 'Mrkva nantes',
            },
            {
                id: 284,
                plantId: 105,
                plantName: 'Špinat',
                sortName: 'Špinat matador',
            },
            {
                id: 357,
                plantId: 106,
                plantName: 'Salata',
                sortName: 'Salata vegorka',
            },
            {
                id: 373,
                plantId: 107,
                plantName: 'Luk',
                sortName: 'Luk Stuttgarter (lukovica)',
            },
            {
                id: 353,
                plantId: 108,
                plantName: 'Brokula',
                sortName: 'Brokula gea F1',
            },
        ];
        const allPlantIds = plantFixtures.map((fixture) => fixture.plantId);
        const crops = resolveRaisedBedOnboardingCrops(
            plantFixtures.map((fixture) =>
                plantSort({
                    ...fixture,
                    antagonistPlantIds: allPlantIds.filter(
                        (plantId) => plantId !== fixture.plantId,
                    ),
                }),
            ),
        );

        assert.deepEqual(
            getRaisedBedOnboardingLayouts({
                care: 'balanced',
                crops,
                goal: 'salads',
            }),
            [],
        );
    });
});
