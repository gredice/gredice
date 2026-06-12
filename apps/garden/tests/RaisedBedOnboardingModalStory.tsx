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
    imageUrl,
    plantName,
    sortName,
}: {
    id: number;
    imageUrl: string;
    plantName: string;
    sortName: string;
}) {
    return {
        id,
        image: {
            cover: {
                url: imageUrl,
            },
        },
        information: {
            name: sortName,
            plant: {
                image: {
                    cover: {
                        url: imageUrl,
                    },
                },
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
        imageUrl:
            'https://cdn.gredice.com/entity-attributes/080d17b9-a04d-4e46-940a-a9be31efa20f-santpierre.png',
        plantName: 'Rajčica',
        sortName: 'Rajčica saint pierre',
    }),
    plantSort({
        id: 216,
        imageUrl:
            'https://cdn.gredice.com/entity-attributes/0f6230a4-ce8b-4a2a-accc-43c102dd910b-pepper-realistic-340.png',
        plantName: 'Paprika',
        sortName: 'Paprika crvena roga',
    }),
    plantSort({
        id: 226,
        imageUrl:
            'https://cdn.gredice.com/entity-attributes/4b222ee1-2411-485c-9732-aab8c7d4a204-tomato-realistic-340.png',
        plantName: 'Krastavac',
        sortName: 'Krastavac pariški kornišon',
    }),
    plantSort({
        id: 230,
        imageUrl:
            'https://cdn.gredice.com/entity-attributes/1d7798f1-9596-4ae7-967a-dd083901463a-parsley-realistic-340.png',
        plantName: 'Mrkva',
        sortName: 'Mrkva nantes',
    }),
    plantSort({
        id: 284,
        imageUrl:
            'https://cdn.gredice.com/entity-attributes/4f63f71a-0b0e-439d-9d66-b69af0a2c316-fennel-realistic-340.png',
        plantName: 'Špinat',
        sortName: 'Špinat matador',
    }),
    plantSort({
        id: 357,
        imageUrl:
            'https://cdn.gredice.com/entity-attributes/0580c848-eda3-4084-9751-75e1ee020fc7-basil-realistic-340.png',
        plantName: 'Salata',
        sortName: 'Salata vegorka',
    }),
    plantSort({
        id: 373,
        imageUrl:
            'https://cdn.gredice.com/entity-attributes/1d7798f1-9596-4ae7-967a-dd083901463a-parsley-realistic-340.png',
        plantName: 'Luk',
        sortName: 'Luk Stuttgarter (lukovica)',
    }),
    plantSort({
        id: 353,
        imageUrl:
            'https://cdn.gredice.com/entity-attributes/4f63f71a-0b0e-439d-9d66-b69af0a2c316-fennel-realistic-340.png',
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

function RaisedBedOnboardingModalFrame({
    autoOpen = true,
    showTrigger,
}: {
    autoOpen?: boolean;
    showTrigger?: boolean;
}) {
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
                            <RaisedBedOnboardingModal
                                autoOpen={autoOpen}
                                enabled
                                showTrigger={showTrigger}
                            />
                        </div>
                    </GameAnalyticsProvider>
                </TestGameStateContext.Provider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}

export function RaisedBedOnboardingModalStory() {
    return <RaisedBedOnboardingModalFrame />;
}

export function RaisedBedOnboardingModalReopenStory() {
    return <RaisedBedOnboardingModalFrame autoOpen={false} showTrigger />;
}
