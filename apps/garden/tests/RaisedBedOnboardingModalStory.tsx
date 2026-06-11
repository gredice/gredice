import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useMemo } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import { currentGardenKeys } from '../../../packages/game/src/hooks/useCurrentGarden';
import { RaisedBedOnboardingModal } from '../../../packages/game/src/hud/RaisedBedOnboardingModal';
import {
    createGameState as createTestGameState,
    GameStateContext as TestGameStateContext,
} from '../../../packages/game/src/useGameState';

const now = '2026-06-11T00:00:00.000Z';
const gardenId = 101;
const raisedBedId = 201;

function plantSort({
    id,
    plantName,
    sortName,
}: {
    id: number;
    plantName: string;
    sortName: string;
}) {
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
            availableInStore: true,
        },
    };
}

const onboardingSorts = [
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

function createOnboardingQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });
    const garden = {
        id: gardenId,
        name: 'Test garden',
        isSandbox: false,
        backgroundPalette: 'default',
        farmId: null,
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [
            {
                id: raisedBedId,
                name: 'Početna gredica',
                blockId: 'raised-bed-1',
                physicalId: '1',
                fields: [],
                appliedOperations: [],
                status: 'new',
                abandonReason: null,
                isValid: true,
                orientation: 'horizontal',
                createdAt: now,
                updatedAt: now,
            },
        ],
        stacks: [
            {
                position: { x: 0, y: 0, z: 0 },
                blocks: [
                    {
                        id: 'raised-bed-1',
                        name: 'RaisedBed',
                        rotation: 0,
                    },
                ],
            },
        ],
    };

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(['gardens'], [{ id: gardenId }]);
    queryClient.setQueryData(currentGardenKeys('summer', gardenId), garden);
    queryClient.setQueryData(['shopping-cart'], {
        allowPurchase: true,
        hasDeliverableItems: false,
        id: 1,
        items: [],
        notes: [],
        total: 0,
        totalSunflowers: 0,
    });
    queryClient.setQueryData(['sorts'], onboardingSorts);

    return queryClient;
}

export function RaisedBedOnboardingModalStory() {
    const queryClient = useMemo(() => createOnboardingQueryClient(), []);
    const gameStore = useMemo(
        () =>
            createTestGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: new Date('2026-06-11T12:00:00.000Z'),
                isMock: false,
                winterMode: 'summer',
            }),
        [],
    );

    return (
        <NuqsTestingAdapter>
            <ReactQuery.QueryClientProvider client={queryClient}>
                <TestGameStateContext.Provider value={gameStore}>
                    <GameAnalyticsProvider capture={() => undefined}>
                        <div className="min-h-dvh bg-green-950/20">
                            <RaisedBedOnboardingModal enabled />
                        </div>
                    </GameAnalyticsProvider>
                </TestGameStateContext.Provider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
