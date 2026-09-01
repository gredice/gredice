'use client';

import {
    createGardenStructureTemplateSeed,
    getGardenStructureWorldFootprintCells,
} from '@gredice/js/gardenStructures';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useState } from 'react';
import { GameSceneWrapper } from '../../../packages/game/src/GameSceneWrapper';
import {
    type CurrentGarden,
    createMockGarden,
    currentGardenKeys,
} from '../../../packages/game/src/hooks/useCurrentGarden';
import { createGardenPosition } from '../../../packages/game/src/types/Stack';
import { gardenBuildingAvatarDoorwayFixture } from './gardenBuildingAvatarInteriorsFixtureContract';

const structureSeed = createGardenStructureTemplateSeed('house');
const ownedStructure = {
    anchorX: 0,
    anchorY: 0,
    document: structureSeed.document,
    id: 'owned-interior-house',
    isDeleted: false,
    kitKey: structureSeed.kitKey,
    kitVersion: structureSeed.kitVersion,
    pricingVersion: 1,
    refundableSunflowerPrincipal:
        structureSeed.document.footprint.cells.length * 50,
    revision: 1,
    rotation: 0,
    sunflowerPricePerCell: 50,
    templateKey: structureSeed.templateKey,
} satisfies CurrentGarden['structures'][number];

const supportCells = [
    ...getGardenStructureWorldFootprintCells(
        ownedStructure.document,
        ownedStructure,
    ),
    { x: 1, y: 4 },
    { x: 1, y: 5 },
];

const ownedGarden = {
    ...createMockGarden('summer', 'default'),
    raisedBeds: [],
    stacks: supportCells.map((cell, index) => ({
        blocks: [
            {
                id: `owned-interior-grass-${index.toString()}`,
                name: 'Block_Grass',
                rotation: 0,
            },
        ],
        position: createGardenPosition(cell.x, 0, cell.y),
    })),
    structures: [ownedStructure],
} satisfies CurrentGarden;

function createFixtureQueryClient() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
        },
    });
    queryClient.setQueryData(
        currentGardenKeys('summer', undefined, 'default'),
        ownedGarden,
    );
    return queryClient;
}

export function GardenBuildingAvatarInteriorsFixture({
    buildingSystemEnabled = true,
    initialSpawnZ = gardenBuildingAvatarDoorwayFixture.roomSpawnZ,
}: {
    buildingSystemEnabled?: boolean;
    initialSpawnZ?: number;
}) {
    const [queryClient] = useState(createFixtureQueryClient);

    return (
        <QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter>
                <div
                    className="relative h-[480px] w-[720px] overflow-hidden"
                    data-testid="owned-garden-avatar-interiors-fixture"
                >
                    <GameSceneWrapper
                        adaptiveHighQuality={false}
                        appBaseUrl=""
                        dayNightCycleDisabled
                        deferDetails={false}
                        flags={{
                            enableGardenAvatarFlag: true,
                            enableGardenBuildingSystemFlag:
                                buildingSystemEnabled,
                        }}
                        gardenAvatarActivationRequest={1}
                        gardenAvatarInitialSpawnPoint={{
                            x: 1,
                            z: initialSpawnZ,
                        }}
                        gardenStructureDebugFixture
                        hideHud
                        mockGarden
                        noBackground
                        noControls
                        noSound
                        noWeather
                        quality="low"
                        renderDetails
                        spriteBaseUrl=""
                        suppressOpeningHud
                    />
                </div>
            </NuqsTestingAdapter>
        </QueryClientProvider>
    );
}
