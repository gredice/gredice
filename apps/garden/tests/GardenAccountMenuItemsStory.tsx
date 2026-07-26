import { Button } from '@gredice/ui/Button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, StrictMode, useMemo } from 'react';
import { GardenSelectionGate } from '../../../packages/game/src/GardenSelectionGate';
import {
    currentGardenKeys,
    useCurrentGarden,
} from '../../../packages/game/src/hooks/useCurrentGarden';
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
    isDefault: true,
    isSandbox: false,
    createdAt: '2026-06-01T00:00:00.000Z',
};

const sandboxGarden = {
    id: 2,
    name: 'Vrt za igru 1',
    isDefault: false,
    isSandbox: true,
    createdAt: '2026-06-01T00:00:00.000Z',
};

const otherAccountGarden = {
    id: 3,
    name: 'Drugi vrt',
    isDefault: false,
    isSandbox: false,
    createdAt: '2026-06-01T00:00:00.000Z',
};

type GardenAccountMenuStoryOptions = {
    defaultGardenId?: number;
    emptyCurrentAccount?: boolean;
    includeOtherAccount?: boolean;
    initialGardenId?: number;
    sandboxFirst?: boolean;
    seedOtherGardenDetails?: boolean;
};

function createGardenAccountMenuQueryClient({
    defaultGardenId,
    emptyCurrentAccount = false,
    includeOtherAccount = true,
    sandboxFirst = false,
    seedOtherGardenDetails = true,
}: GardenAccountMenuStoryOptions = {}) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    const withDefaultState = <TGarden extends typeof currentGarden>(
        garden: TGarden,
    ) => ({
        ...garden,
        isDefault: garden.id === defaultGardenId,
    });
    const currentAccountGardens = emptyCurrentAccount
        ? []
        : (sandboxFirst
              ? [sandboxGarden, currentGarden]
              : [currentGarden, sandboxGarden]
          ).map(withDefaultState);
    const currentAccountGroup = {
        accountId: 'test-account',
        name: 'test@example.com račun',
        isCurrent: true,
        gardens: currentAccountGardens,
    };
    const otherAccountGroup = {
        accountId: 'other-account',
        name: 'other@example.com račun',
        isCurrent: false,
        gardens: [withDefaultState(otherAccountGarden)],
    };

    queryClient.setQueryData(useGardensKeys, currentAccountGardens);
    queryClient.setQueryData(gardenAccountGroupsKeys, [
        currentAccountGroup,
        ...(includeOtherAccount ? [otherAccountGroup] : []),
    ]);
    const seededGardens = emptyCurrentAccount
        ? []
        : [currentGarden, sandboxGarden];
    if (seedOtherGardenDetails) {
        seededGardens.push(otherAccountGarden);
    }
    for (const garden of seededGardens) {
        queryClient.setQueryData(currentGardenKeys('summer', garden.id), {
            id: garden.id,
            name: garden.name,
            isSandbox: garden.isSandbox,
            stacks: [],
            location: { lat: 45.739, lon: 16.572 },
            raisedBeds: [],
        });
    }

    return queryClient;
}

function GardenAccountMenuItemsTestProviders({
    children,
    options,
    showSelectionOutputs = true,
}: PropsWithChildren<{
    options?: GardenAccountMenuStoryOptions;
    showSelectionOutputs?: boolean;
}>) {
    const {
        defaultGardenId,
        emptyCurrentAccount,
        includeOtherAccount,
        initialGardenId,
        sandboxFirst,
        seedOtherGardenDetails,
    } = options ?? {};
    const queryClient = useMemo(
        () =>
            createGardenAccountMenuQueryClient({
                defaultGardenId,
                emptyCurrentAccount,
                includeOtherAccount,
                initialGardenId,
                sandboxFirst,
                seedOtherGardenDetails,
            }),
        [
            defaultGardenId,
            emptyCurrentAccount,
            includeOtherAccount,
            initialGardenId,
            sandboxFirst,
            seedOtherGardenDetails,
        ],
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
        <NuqsTestingAdapter
            hasMemory
            searchParams={
                initialGardenId
                    ? `vrt=${initialGardenId.toString()}`
                    : undefined
            }
        >
            <ReactQuery.QueryClientProvider client={queryClient}>
                <GardenAccountMenuItemsTestContent
                    gameState={gameState}
                    showSelectionOutputs={showSelectionOutputs}
                >
                    {children}
                </GardenAccountMenuItemsTestContent>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}

function GardenAccountMenuItemsTestContent({
    children,
    gameState,
    showSelectionOutputs,
}: PropsWithChildren<{
    gameState: ReturnType<typeof createGameState>;
    showSelectionOutputs: boolean;
}>) {
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
            {showSelectionOutputs && <GardenSelectionOutputs />}
        </GameStateContext.Provider>
    );
}

function GardenSelectionOutputs() {
    const [selectedGardenId] = useCurrentGardenIdParam();
    const { data: selectedGarden } = useCurrentGarden();

    return (
        <>
            <output className="sr-only" data-testid="selected-garden-id">
                {selectedGardenId ?? 'default'}
            </output>
            <output className="sr-only" data-testid="current-garden-id">
                {selectedGarden?.id ?? 'loading'}
            </output>
            <output className="sr-only" data-testid="current-garden-kind">
                {selectedGarden
                    ? selectedGarden.isSandbox
                        ? 'sandbox'
                        : 'real'
                    : 'loading'}
            </output>
        </>
    );
}

function CrossAccountUrlSelectionControl() {
    const [, setSelectedGardenId] = useCurrentGardenIdParam();

    return (
        <Button
            onClick={() => {
                void setSelectedGardenId(otherAccountGarden.id);
            }}
        >
            Otvori drugi vrt putem URL-a
        </Button>
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

export function SandboxFirstGardenAccountMenuItemsStory() {
    const options = {
        initialGardenId: sandboxGarden.id,
        sandboxFirst: true,
        seedOtherGardenDetails: false,
    };

    return (
        <div className="min-h-96 p-4">
            <GardenAccountMenuItemsTestProviders options={options}>
                <GardenSelectionGate>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button>Otvori izbornik</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-80 p-4" align="start">
                            <GardenAccountMenuItems />
                        </DropdownMenuContent>
                    </DropdownMenu>
                </GardenSelectionGate>
            </GardenAccountMenuItemsTestProviders>
        </div>
    );
}

export function SingleRealGardenAccountMenuItemsStory() {
    const options = {
        includeOtherAccount: false,
    };

    return (
        <div className="min-h-96 p-4">
            <GardenAccountMenuItemsTestProviders options={options}>
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

export function DefaultGardenSelectionGateStory() {
    const options = {
        defaultGardenId: otherAccountGarden.id,
        emptyCurrentAccount: true,
        seedOtherGardenDetails: false,
    };

    return (
        <GardenAccountMenuItemsTestProviders
            options={options}
            showSelectionOutputs={false}
        >
            <StrictMode>
                <GardenSelectionGate>
                    <output data-testid="default-garden-ready">
                        Zadani vrt je spreman
                    </output>
                    <GardenSelectionOutputs />
                </GardenSelectionGate>
            </StrictMode>
        </GardenAccountMenuItemsTestProviders>
    );
}

export function DefaultGardenMutationGateStory() {
    const options = {
        defaultGardenId: currentGarden.id,
    };

    return (
        <GardenAccountMenuItemsTestProviders
            options={options}
            showSelectionOutputs={false}
        >
            <GardenSelectionGate>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button>Otvori izbornik</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-80 p-4" align="start">
                        <GardenAccountMenuItems />
                    </DropdownMenuContent>
                </DropdownMenu>
                <GardenSelectionOutputs />
            </GardenSelectionGate>
        </GardenAccountMenuItemsTestProviders>
    );
}

export function PostStartupCrossAccountSelectionStory() {
    const options = {
        defaultGardenId: currentGarden.id,
        seedOtherGardenDetails: false,
    };

    return (
        <GardenAccountMenuItemsTestProviders
            options={options}
            showSelectionOutputs={false}
        >
            <CrossAccountUrlSelectionControl />
            <StrictMode>
                <GardenSelectionGate>
                    <output data-testid="post-startup-selection-ready">
                        Odabrani vrt je spreman
                    </output>
                    <GardenSelectionOutputs />
                </GardenSelectionGate>
            </StrictMode>
        </GardenAccountMenuItemsTestProviders>
    );
}
