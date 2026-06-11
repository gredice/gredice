import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    getRaisedBedOnboardingLayouts,
    type RaisedBedOnboardingPlantSortCandidate,
    resolveRaisedBedOnboardingCrops,
} from './raisedBedOnboardingLayouts';

function plantSort({
    id,
    plantName,
    sortName,
    availableInStore = true,
}: {
    id: number;
    plantName: string;
    sortName: string;
    availableInStore?: boolean;
}): RaisedBedOnboardingPlantSortCandidate {
    return {
        id,
        information: {
            name: sortName,
            plant: {
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
});
