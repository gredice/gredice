import { GameAnalyticsProvider } from '@gredice/game';
import { NuqsAdapter } from '@gredice/ui/nuqs';
import { currentGardenKeys } from '@packages/game/hooks/useCurrentGarden';
import { queryKey as currentUserQueryKey } from '@packages/game/hooks/useCurrentUser';
import { useShoppingCartQueryKey } from '@packages/game/hooks/useShoppingCart';
import { RaisedBedField } from '@packages/game/hud/raisedBed/RaisedBedField';
import { createGameState, GameStateContext } from '@packages/game/useGameState';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useRef } from 'react';

const raisedBedId = 1;
const gardenId = 42;
const now = new Date('2026-06-03T10:00:00.000Z');
const msPerDay = 1000 * 60 * 60 * 24;
const sortIds = {
    basil: 458,
    bellPepper: 219,
    fennel: 276,
    parsley: 213,
    tomato: 206,
} as const;
const plantIds = {
    basil: 1001,
    bellPepper: 1002,
    fennel: 1003,
    parsley: 1004,
    tomato: 1000,
} as const;
const plantImageUrls = {
    basil: 'https://cdn.gredice.com/entity-attributes/0580c848-eda3-4084-9751-75e1ee020fc7-basil-realistic-340.png',
    bellPepper:
        'https://cdn.gredice.com/entity-attributes/0f6230a4-ce8b-4a2a-accc-43c102dd910b-pepper-realistic-340.png',
    fennel: 'https://cdn.gredice.com/entity-attributes/4f63f71a-0b0e-439d-9d66-b69af0a2c316-fennel-realistic-340.png',
    parsley:
        'https://cdn.gredice.com/entity-attributes/1d7798f1-9596-4ae7-967a-dd083901463a-parsley-realistic-340.png',
    tomato: 'https://cdn.gredice.com/entity-attributes/4b222ee1-2411-485c-9732-aab8c7d4a204-tomato-realistic-340.png',
} as const;
const sortImageUrls = {
    basil: plantImageUrls.basil,
    bellPepper: plantImageUrls.bellPepper,
    fennel: plantImageUrls.fennel,
    parsley: plantImageUrls.parsley,
    tomato: 'https://cdn.gredice.com/entity-attributes/080d17b9-a04d-4e46-940a-a9be31efa20f-santpierre.png',
} as const;
const fieldSortLayout = [
    sortIds.tomato,
    sortIds.tomato,
    sortIds.fennel,
    sortIds.bellPepper,
    sortIds.bellPepper,
    sortIds.tomato,
    sortIds.parsley,
    sortIds.parsley,
    sortIds.parsley,
    sortIds.bellPepper,
    sortIds.tomato,
    sortIds.tomato,
    sortIds.bellPepper,
    sortIds.parsley,
    sortIds.parsley,
    sortIds.basil,
    sortIds.tomato,
    sortIds.tomato,
];
const fieldHistorySortIds = new Map<number, number[]>([
    [4, [sortIds.parsley, sortIds.basil, sortIds.tomato]],
    [10, [sortIds.basil]],
    [13, [sortIds.tomato, sortIds.bellPepper]],
]);

function isoDaysAgo(daysAgo: number) {
    return new Date(now.getTime() - daysAgo * msPerDay).toISOString();
}

function buildPlantCycle({
    historyIndex,
    plantSortId,
    positionIndex,
}: {
    historyIndex: number;
    plantSortId: number;
    positionIndex: number;
}) {
    const cycleOffset = historyIndex * 34 + positionIndex;
    const plantSowDate = isoDaysAgo(190 + cycleOffset);
    const plantGrowthDate = isoDaysAgo(178 + cycleOffset);
    const plantReadyDate = isoDaysAgo(138 + cycleOffset);
    const plantHarvestedDate = isoDaysAgo(120 + cycleOffset);
    const plantRemovedDate = isoDaysAgo(110 + cycleOffset);

    return {
        active: false,
        plantPlaceEventId: 1000 + positionIndex * 10 + historyIndex,
        plantSortId,
        positionIndex,
        plantStatus: 'removed',
        sowingLocation: 'direct',
        plantScheduledDate: undefined,
        plantSowDate,
        plantGrowthDate,
        plantReadyDate,
        plantDeadDate: undefined,
        plantHarvestedDate,
        plantRemovedDate,
        startedAt: plantSowDate,
        endedAt: plantRemovedDate,
        stoppedDate: plantRemovedDate,
        toBeRemoved: false,
        assignedUserId: null,
        assignedUserIds: [],
        assignedBy: null,
        assignedAt: undefined,
        createdAt: plantSowDate,
        updatedAt: plantRemovedDate,
    };
}

function buildPlant({
    companions = [],
    antagonists = [],
    imageUrl,
    name,
    plantId,
}: {
    antagonists?: { id: number; name: string }[];
    companions?: { id: number; name: string }[];
    imageUrl: string;
    name: string;
    plantId: number;
}) {
    return {
        id: plantId,
        image: {
            cover: {
                url: imageUrl,
            },
        },
        images: {
            cover: {
                url: imageUrl,
            },
        },
        information: {
            name,
        },
        relationships: {
            companions,
            antagonists,
        },
        attributes: {
            germinationWindowMax: 10,
            germinationWindowMin: 5,
            growthWindowMax: 80,
            growthWindowMin: 55,
            harvestWindowMax: 28,
            harvestWindowMin: 14,
        },
    };
}

function buildSort({
    imageUrl,
    name,
    plant,
    sortId,
}: {
    imageUrl: string;
    name: string;
    plant: ReturnType<typeof buildPlant>;
    sortId: number;
}) {
    return {
        id: sortId,
        image: {
            cover: {
                url: imageUrl,
            },
        },
        images: {
            cover: {
                url: imageUrl,
            },
        },
        information: {
            name,
            shortDescription: plant.information.name,
            plant,
        },
        store: {
            availableInStore: true,
        },
    };
}

function buildSorts() {
    const tomato = buildPlant({
        plantId: plantIds.tomato,
        name: 'Rajčica',
        imageUrl: plantImageUrls.tomato,
        companions: [{ id: plantIds.basil, name: 'Bosiljak' }],
        antagonists: [{ id: plantIds.fennel, name: 'Komorač' }],
    });
    const basil = buildPlant({
        plantId: plantIds.basil,
        name: 'Bosiljak',
        imageUrl: plantImageUrls.basil,
        companions: [
            { id: plantIds.tomato, name: 'Rajčica' },
            { id: plantIds.bellPepper, name: 'Paprika' },
        ],
    });
    const bellPepper = buildPlant({
        plantId: plantIds.bellPepper,
        name: 'Paprika',
        imageUrl: plantImageUrls.bellPepper,
        companions: [{ id: plantIds.basil, name: 'Bosiljak' }],
        antagonists: [{ id: plantIds.fennel, name: 'Komorač' }],
    });
    const fennel = buildPlant({
        plantId: plantIds.fennel,
        name: 'Komorač',
        imageUrl: plantImageUrls.fennel,
        antagonists: [
            { id: plantIds.tomato, name: 'Rajčica' },
            { id: plantIds.bellPepper, name: 'Paprika' },
        ],
    });
    const parsley = buildPlant({
        plantId: plantIds.parsley,
        name: 'Peršin',
        imageUrl: plantImageUrls.parsley,
    });

    return [
        buildSort({
            sortId: sortIds.tomato,
            name: 'Rajčica Saint Pierre',
            imageUrl: sortImageUrls.tomato,
            plant: tomato,
        }),
        buildSort({
            sortId: sortIds.basil,
            name: 'Bosiljak Italiano Classico',
            imageUrl: sortImageUrls.basil,
            plant: basil,
        }),
        buildSort({
            sortId: sortIds.bellPepper,
            name: 'Paprika Babura',
            imageUrl: sortImageUrls.bellPepper,
            plant: bellPepper,
        }),
        buildSort({
            sortId: sortIds.fennel,
            name: 'Komorač Dragon',
            imageUrl: sortImageUrls.fennel,
            plant: fennel,
        }),
        buildSort({
            sortId: sortIds.parsley,
            name: 'Peršin lisnati',
            imageUrl: sortImageUrls.parsley,
            plant: parsley,
        }),
    ];
}

function buildField(positionIndex: number, plantSortId: number) {
    const plantSowDate = isoDaysAgo(74 + (positionIndex % 4) * 4);
    const plantGrowthDate = isoDaysAgo(62 + (positionIndex % 3) * 4);
    const plantCycles = (fieldHistorySortIds.get(positionIndex) ?? []).map(
        (historyPlantSortId, historyIndex) =>
            buildPlantCycle({
                historyIndex,
                plantSortId: historyPlantSortId,
                positionIndex,
            }),
    );

    return {
        id: positionIndex + 1,
        raisedBedId,
        isDeleted: false,
        active: true,
        toBeRemoved: false,
        stoppedDate: undefined,
        positionIndex,
        plantSortId,
        plantStatus: 'sprouted',
        sowingLocation: 'direct',
        plantScheduledDate: undefined,
        plantSowDate,
        plantGrowthDate,
        plantReadyDate: undefined,
        plantDeadDate: undefined,
        plantHarvestedDate: undefined,
        plantRemovedDate: undefined,
        plantCycles,
        assignedUserId: null,
        assignedUserIds: [],
        assignedBy: null,
        assignedAt: undefined,
        createdAt: plantSowDate,
        updatedAt: plantGrowthDate,
    };
}

function buildGarden() {
    return {
        id: gardenId,
        name: 'Storybook vrt',
        isSandbox: false,
        farmId: null,
        location: {
            lat: 45.739,
            lon: 16.572,
        },
        stacks: [
            {
                position: { x: 0, y: 0, z: 0 },
                blocks: [
                    {
                        id: 'ground-1',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                    {
                        id: 'raised-bed-1-a',
                        name: 'Raised_Bed',
                        rotation: 0,
                    },
                ],
            },
            {
                position: { x: 0, y: 0, z: 1 },
                blocks: [
                    {
                        id: 'ground-2',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                    {
                        id: 'raised-bed-1-b',
                        name: 'Raised_Bed',
                        rotation: 0,
                    },
                ],
            },
        ],
        raisedBeds: [
            {
                id: raisedBedId,
                name: 'Sunčano Sunce',
                blockId: 'raised-bed-1-a',
                physicalId: 'storybook-raised-bed-1',
                fields: fieldSortLayout.map((plantSortId, positionIndex) =>
                    buildField(positionIndex, plantSortId),
                ),
                appliedOperations: [],
                status: 'new',
                abandonReason: null,
                updatedAt: now.toISOString(),
                createdAt: now.toISOString(),
                isValid: true,
                orientation: 'horizontal',
            },
        ],
    };
}

function createQueryClient() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                staleTime: Number.POSITIVE_INFINITY,
            },
        },
    });
    const sorts = buildSorts();

    queryClient.setQueryData(['sorts'], sorts);
    for (const sort of sorts) {
        queryClient.setQueryData(['plants', 'sorts', sort.id], sort);
        queryClient.setQueryData(
            ['plants', sort.information.plant.id, 'sorts'],
            sorts.filter(
                (candidate) =>
                    candidate.information.plant.id ===
                    sort.information.plant.id,
            ),
        );
    }
    queryClient.setQueryData(
        currentGardenKeys('summer', null, 'default'),
        buildGarden(),
    );
    queryClient.setQueryData(useShoppingCartQueryKey, { items: [] });
    queryClient.setQueryData(currentUserQueryKey.currentUser, {
        id: 1,
        name: 'Storybook user',
    });

    return queryClient;
}

function RaisedBedStoryProviders({ children }: { children: ReactNode }) {
    const queryClientRef = useRef<QueryClient | null>(null);
    const gameStateRef = useRef<ReturnType<typeof createGameState> | null>(
        null,
    );

    if (!queryClientRef.current) {
        queryClientRef.current = createQueryClient();
    }

    if (!gameStateRef.current) {
        gameStateRef.current = createGameState({
            appBaseUrl: '',
            freezeTime: now,
            isMock: true,
            mockGardenProfile: 'default',
            winterMode: 'summer',
        });
    }

    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClientRef.current}>
                <GameStateContext.Provider value={gameStateRef.current}>
                    <GameAnalyticsProvider capture={() => undefined}>
                        {children}
                    </GameAnalyticsProvider>
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsAdapter>
    );
}

function RaisedBedRelationshipDemo() {
    return (
        <RaisedBedStoryProviders>
            <div className="relative min-h-[680px] w-[480px] overflow-hidden bg-[#c7be74]">
                <div className="absolute -left-16 top-10 h-[560px] w-[260px] rotate-[-8deg] bg-lime-800/40 blur-[2px]" />
                <div className="absolute bottom-0 left-0 h-32 w-full bg-lime-900/15" />
                <div className="absolute left-1/2 top-12 h-[570px] w-[300px] -translate-x-1/2 bg-[#b7896e] p-[30px] shadow-lg">
                    <RaisedBedField
                        gardenId={gardenId}
                        raisedBedId={raisedBedId}
                    />
                </div>
            </div>
        </RaisedBedStoryProviders>
    );
}

const meta = {
    title: 'packages/game/hud/raisedBed/RaisedBedField',
    component: RaisedBedField,
    tags: ['autodocs'],
    args: {
        gardenId,
        raisedBedId,
    },
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'RaisedBedField renders the raised-bed planting grid, including relationship edge indicators for placed plants.',
            },
        },
    },
} satisfies Meta<typeof RaisedBedField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RelationshipIndicators: Story = {
    name: 'Relationship indicators',
    render: () => <RaisedBedRelationshipDemo />,
};
