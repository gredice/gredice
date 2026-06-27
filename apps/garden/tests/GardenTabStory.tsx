import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { currentGardenKeys } from '../../../packages/game/src/hooks/useCurrentGarden';
import { gardenAccountGroupsKeys } from '../../../packages/game/src/hooks/useGardenAccountGroups';
import { useGardensKeys } from '../../../packages/game/src/hooks/useGardens';
import { GardenTab } from '../../../packages/game/src/modals/components/GardenTab';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

type GardenTabStoryProps = {
    activeRaisedBedCount?: number;
    isSandbox?: boolean;
};

const baseGarden = {
    id: 1,
    name: 'Test',
    isSandbox: false,
    backgroundPalette: 'current',
    createdAt: '2026-06-01T00:00:00.000Z',
};

function raisedBed(id: number, status: string) {
    return {
        id,
        name: `Gredica ${id.toString()}`,
        status,
        fields: [],
        latestPhotoOperation: null,
        weedState: null,
    };
}

function createGardenTabQueryClient(
    activeRaisedBedCount = 0,
    isSandbox = false,
) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });
    const garden = {
        ...baseGarden,
        isSandbox,
    };
    const raisedBeds = [
        ...Array.from({ length: activeRaisedBedCount }, (_value, index) =>
            raisedBed(index + 1, 'active'),
        ),
        raisedBed(activeRaisedBedCount + 1, 'abandoned'),
    ];

    queryClient.setQueryData(useGardensKeys, [garden]);
    queryClient.setQueryData(gardenAccountGroupsKeys, [
        {
            accountId: 'test-account',
            name: 'test@example.com račun',
            isCurrent: true,
            gardens: [garden],
        },
    ]);
    queryClient.setQueryData(currentGardenKeys('summer', garden.id), {
        id: garden.id,
        name: garden.name,
        isSandbox: garden.isSandbox,
        stacks: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds,
    });

    return queryClient;
}

function GardenTabTestProviders({
    activeRaisedBedCount,
    isSandbox,
    children,
}: PropsWithChildren<GardenTabStoryProps>) {
    const queryClient = useMemo(
        () => createGardenTabQueryClient(activeRaisedBedCount, isSandbox),
        [activeRaisedBedCount, isSandbox],
    );
    const gameState = useMemo(
        () =>
            createGameState({
                appBaseUrl: '',
                freezeTime: new Date('2026-06-01T00:00:00.000Z'),
                isMock: false,
            }),
        [],
    );

    return (
        <ReactQuery.QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter>
                <GameStateContext.Provider value={gameState}>
                    {children}
                </GameStateContext.Provider>
            </NuqsTestingAdapter>
        </ReactQuery.QueryClientProvider>
    );
}

export function GardenTabStory({
    activeRaisedBedCount,
    isSandbox,
}: GardenTabStoryProps) {
    return (
        <div className="min-h-96 max-w-2xl p-4">
            <GardenTabTestProviders
                activeRaisedBedCount={activeRaisedBedCount}
                isSandbox={isSandbox}
            >
                <GardenTab />
            </GardenTabTestProviders>
        </div>
    );
}
