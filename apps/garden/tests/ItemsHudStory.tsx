import type { BlockData } from '@gredice/client';
import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import {
    gameHudBottomBarClassName,
    gameHudBottomControlsClassName,
} from '../../../packages/game/src/GameHud';
import { ItemsHud } from '../../../packages/game/src/hud/ItemsHud';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

const now = '2026-05-13T00:00:00.000Z';

function createBlockData(name: string, index: number) {
    return {
        id: index + 1,
        entityType: { id: 8, name: 'block', label: 'Blok' },
        slug: name.toLowerCase().replaceAll('_', '-'),
        information: {
            name,
            label: name.replaceAll('_', ' '),
            shortDescription: 'Mock block for HUD layout tests.',
            fullDescription: 'Mock block for HUD layout tests.',
        },
        attributes: {
            height: 1,
            nightOnlyPurchase: name === 'FireflyJar',
            stackable: true,
            type: name === 'Raised_Bed' ? 'raisedBed' : 'decoration',
        },
        prices: { sunflowers: 10 },
        functions: {
            recycler: false,
            raisedBed: name === 'Raised_Bed',
        },
        createdAt: now,
        updatedAt: now,
    } satisfies BlockData;
}

const blockNames = [
    'Raised_Bed',
    'Bucket',
    'WateringCan',
    'Composter',
    'GardenBox',
    'PotLowBowl',
    'PotRoundedBowl',
    'PotBulbousNeck',
    'PotTallTapered',
    'PotHourglass',
    'PotStraightShortTub',
    'PotNarrowFootBowl',
    'PotSquatRidged',
    'PotTallSlenderCone',
    'PotWideLippedCup',
    'Shade',
    'Stool',
    'Fence',
    'StoneSmall',
    'StoneMedium',
    'StoneLarge',
    'WaterWell',
    'DesertStoneSmall',
    'DesertStoneMedium',
    'DesertStoneLarge',
    'BirdHouse',
    'FireflyJar',
    'CatPillow',
    'Bush',
    'Tree',
    'Pine',
    'DeadTreeTall',
    'DeadTreeStump',
    'ShovelSmall',
    'Tulip',
    'CactusBarrel',
    'CactusColumnCluster',
    'CactusPricklyPear',
    'BaleHey',
    'MulchHey',
    'MulchCoconut',
    'MulchWood',
    'Block_Grass',
    'Block_Ground',
    'Block_Sand',
    'Block_Snow',
    'Block_Water',
    'Block_Grass_Angle',
    'Block_Ground_Angle',
    'Block_Sand_Angle',
    'Block_Snow_Angle',
    'Block_Grass_Corner',
    'Block_Ground_Corner',
    'Block_Sand_Corner',
    'Block_Snow_Corner',
    'Block_Grass_Reverse_Corner',
    'Block_Ground_Reverse_Corner',
    'Block_Sand_Reverse_Corner',
    'Block_Snow_Reverse_Corner',
];

function createItemsHudQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(['blocks'], blockNames.map(createBlockData));
    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(['gardens'], [{ id: 1 }]);
    queryClient.setQueryData(['gardens', 'current', 'summer', 1], {
        id: 1,
        name: 'Test garden',
        stacks: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [],
    });

    return queryClient;
}

function ItemsHudTestProviders({ children }: PropsWithChildren) {
    const queryClient = useMemo(() => createItemsHudQueryClient(), []);
    const gameStore = useMemo(() => {
        const store = createGameState({
            appBaseUrl: 'http://localhost',
            freezeTime: new Date('2026-05-13T12:00:00.000Z'),
            isMock: false,
            winterMode: 'summer',
        });
        return store;
    }, []);

    return (
        <NuqsTestingAdapter>
            <ReactQuery.QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={gameStore}>
                    {children}
                </GameStateContext.Provider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}

export function ItemsHudAlignmentStory() {
    return (
        <ItemsHudTestProviders>
            <div className="relative h-screen w-screen overflow-hidden">
                <div
                    data-testid="bottom-hud"
                    className={gameHudBottomBarClassName}
                >
                    <div
                        data-testid="bottom-controls"
                        className={gameHudBottomControlsClassName}
                    >
                        <div className="h-10 w-40 rounded-lg border bg-muted" />
                    </div>
                    <ItemsHud />
                </div>
            </div>
        </ItemsHudTestProviders>
    );
}
