import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import {
    currentGardenKeys,
    useCurrentGarden,
} from '../../../packages/game/src/hooks/useCurrentGarden';
import { gardenAccountGroupsKeys } from '../../../packages/game/src/hooks/useGardenAccountGroups';
import { useGardensKeys } from '../../../packages/game/src/hooks/useGardens';
import { WoodenSignModal } from '../../../packages/game/src/modals/WoodenSignModal';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

const woodenSignTestGardenId = 42;
const woodenSignTestBlockId = 'wooden-sign-1';

const woodenSignInitialMessage = 'DOBRO\nDOŠLI!!';

function createWoodenSignTestGarden(message = woodenSignInitialMessage) {
    return {
        id: woodenSignTestGardenId,
        name: 'Vrt s natpisom',
        isSandbox: false,
        isPublic: false,
        backgroundPalette: 'default' as const,
        farmId: null,
        homeCamera: null,
        location: { lat: 45.739, lon: 16.572 },
        previewImage: null,
        previewSourceRevision: null,
        raisedBeds: [],
        stacks: [
            {
                position: { x: 0, y: 0, z: 0 },
                blocks: [
                    {
                        id: woodenSignTestBlockId,
                        message,
                        name: 'WoodenSign',
                        rotation: 0,
                    },
                ],
            },
        ],
    };
}

function createWoodenSignQueryClient(message: string) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false, staleTime: Infinity },
        },
    });
    const garden = createWoodenSignTestGarden(message);

    queryClient.setQueryData(useGardensKeys, [
        {
            id: woodenSignTestGardenId,
            isDefault: true,
            isSandbox: false,
            name: garden.name,
        },
    ]);
    queryClient.setQueryData(gardenAccountGroupsKeys, [
        {
            accountId: 'test-account',
            gardens: [
                {
                    id: woodenSignTestGardenId,
                    isDefault: true,
                    isSandbox: false,
                    name: garden.name,
                },
            ],
            isCurrent: true,
            name: 'Testni račun',
        },
    ]);
    queryClient.setQueryData(
        currentGardenKeys('summer', woodenSignTestGardenId),
        garden,
    );

    return queryClient;
}

function WoodenSignTestProviders({
    children,
    initialMessage,
}: PropsWithChildren<{ initialMessage: string }>) {
    const queryClient = useMemo(
        () => createWoodenSignQueryClient(initialMessage),
        [initialMessage],
    );
    const gameState = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: new Date('2026-08-12T10:00:00.000Z'),
                isMock: false,
                winterMode: 'summer',
            }),
        [],
    );

    return (
        <NuqsTestingAdapter
            hasMemory
            searchParams={`vrt=${woodenSignTestGardenId.toString()}&natpis=${woodenSignTestBlockId}`}
        >
            <ReactQuery.QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={gameState}>
                    <GameAnalyticsProvider capture={() => undefined}>
                        {children}
                    </GameAnalyticsProvider>
                </GameStateContext.Provider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}

function CurrentWoodenSignMessage() {
    const { data: garden } = useCurrentGarden();
    const message = garden?.stacks
        .flatMap((stack) => stack.blocks)
        .find((block) => block.id === woodenSignTestBlockId)?.message;

    return (
        <output className="sr-only" data-testid="current-sign-message">
            {message ?? 'prazno'}
        </output>
    );
}

export function WoodenSignModalStory({
    initialMessage = woodenSignInitialMessage,
}: {
    initialMessage?: string;
} = {}) {
    return (
        <WoodenSignTestProviders initialMessage={initialMessage}>
            <WoodenSignModal />
            <CurrentWoodenSignMessage />
        </WoodenSignTestProviders>
    );
}
