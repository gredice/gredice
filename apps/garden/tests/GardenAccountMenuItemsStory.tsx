import { Button } from '@gredice/ui/Button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { currentGardenKeys } from '../../../packages/game/src/hooks/useCurrentGarden';
import { gardenAccountGroupsKeys } from '../../../packages/game/src/hooks/useGardenAccountGroups';
import { useGardensKeys } from '../../../packages/game/src/hooks/useGardens';
import { GardenAccountMenuItems } from '../../../packages/game/src/hud/GardenAccountMenuItems';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';
import { useCurrentGardenIdParam } from '../../../packages/game/src/useUrlState';

const currentGarden = {
    id: 1,
    name: 'Test',
    isSandbox: false,
    createdAt: '2026-06-01T00:00:00.000Z',
};

const sandboxGarden = {
    id: 2,
    name: 'Vrt za igru 1',
    isSandbox: true,
    createdAt: '2026-06-01T00:00:00.000Z',
};

const otherAccountGarden = {
    id: 3,
    name: 'Drugi vrt',
    isSandbox: false,
    createdAt: '2026-06-01T00:00:00.000Z',
};

function createGardenAccountMenuQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(useGardensKeys, [currentGarden, sandboxGarden]);
    queryClient.setQueryData(gardenAccountGroupsKeys, [
        {
            accountId: 'test-account',
            name: 'test@example.com račun',
            isCurrent: true,
            gardens: [currentGarden, sandboxGarden],
        },
        {
            accountId: 'other-account',
            name: 'other@example.com račun',
            isCurrent: false,
            gardens: [otherAccountGarden],
        },
    ]);
    queryClient.setQueryData(currentGardenKeys('summer', currentGarden.id), {
        id: currentGarden.id,
        name: currentGarden.name,
        isSandbox: currentGarden.isSandbox,
        stacks: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [],
    });

    return queryClient;
}

function GardenAccountMenuItemsTestProviders({ children }: PropsWithChildren) {
    const queryClient = useMemo(createGardenAccountMenuQueryClient, []);
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
        <NuqsTestingAdapter hasMemory>
            <ReactQuery.QueryClientProvider client={queryClient}>
                <GardenAccountMenuItemsTestContent gameState={gameState}>
                    {children}
                </GardenAccountMenuItemsTestContent>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}

function GardenAccountMenuItemsTestContent({
    children,
    gameState,
}: PropsWithChildren<{
    gameState: ReturnType<typeof createGameState>;
}>) {
    const [selectedGardenId] = useCurrentGardenIdParam();

    // Keep one active refetch pending so the switcher test can prove that URL
    // selection no longer waits for every invalidated query to settle.
    ReactQuery.useQuery({
        queryKey: ['accounts', 'current', 'switch-delay-probe'],
        queryFn: () => new Promise<never>(() => undefined),
        initialData: 'ready',
        staleTime: Number.POSITIVE_INFINITY,
    });

    return (
        <GameStateContext.Provider value={gameState}>
            {children}
            <output className="sr-only" data-testid="selected-garden-id">
                {selectedGardenId ?? 'default'}
            </output>
        </GameStateContext.Provider>
    );
}

export function GardenAccountMenuItemsStory() {
    return (
        <div className="min-h-96 p-4">
            <GardenAccountMenuItemsTestProviders>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button>Otvori izbornik</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-80 p-4" align="start">
                        <GardenAccountMenuItems />
                    </DropdownMenuContent>
                </DropdownMenu>
            </GardenAccountMenuItemsTestProviders>
        </div>
    );
}
