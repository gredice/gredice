import type { BlockData } from '@gredice/client';
import { cx } from '@gredice/ui/utils';
import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import type {
    GameCameraRigApi,
    GameCameraSnapshot,
} from '../../../packages/game/src/controls/GameCameraRigApi';
import {
    gameHudBottomBarClassName,
    gameHudBottomControlsClassName,
    gameHudBottomItemsClassName,
    getGameHudBottomCloseupClassName,
} from '../../../packages/game/src/GameHud';
import { currentAccountKeys } from '../../../packages/game/src/hooks/useCurrentAccount';
import { ControlsTooltipHud } from '../../../packages/game/src/hud/ControlsTooltipHud';
import { ItemsHud } from '../../../packages/game/src/hud/ItemsHud';
import { SandboxBlockTrashDropTarget } from '../../../packages/game/src/hud/SandboxBlockTrashDropTarget';
import { defaultLocalSandboxStorageKey } from '../../../packages/game/src/localSandboxGarden';
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
        prices: { sunflowers: name === 'PaintRoller' ? 100 : 10 },
        functions: {
            recycler: false,
            raisedBed: name === 'Raised_Bed',
        },
        createdAt: now,
        updatedAt: now,
    } satisfies BlockData;
}

function createMockGameCamera(
    target: [x: number, y: number, z: number],
): GameCameraRigApi {
    const snapshot: GameCameraSnapshot = {
        position: [target[0] - 10, 10, target[2] - 10],
        target,
        version: 1,
        zoom: 100,
    };

    return {
        focus: () => undefined,
        getCamera: () => null,
        getDomElement: () => null,
        getSnapshot: () => snapshot,
        panByDragEdge: () => false,
        projectToScreen: () => null,
        subscribe: () => () => undefined,
    };
}

const blockNames = [
    'Raised_Bed',
    'Bucket',
    'WateringCan',
    'PaintRoller',
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
    'BeachUmbrella',
    'Stool',
    'Fence',
    'StoneSmall',
    'StoneMedium',
    'StoneLarge',
    'WaterWell',
    'LemonadeStand',
    'IceCreamCart',
    'SummerHat',
    'BeachTowelStriped',
    'InflatablePoolSmall',
    'BeachChair',
    'PalmTree',
    'BeachBall',
    'SandcastleSmallA',
    'DesertStoneSmall',
    'DesertStoneMedium',
    'DesertStoneLarge',
    'BirdHouse',
    'FireflyJar',
    'CatPillow',
    'DogHouse',
    'Bush',
    'Tree',
    'Pine',
    'PineAdvent',
    'DeadTreeTall',
    'DeadTreeStump',
    'ShovelSmall',
    'Tulip',
    'Sunflower',
    'CactusBarrel',
    'CactusColumnCluster',
    'CactusPricklyPear',
    'GiftBox_RedWhite',
    'GiftBox_GreenGold',
    'GiftBox_BlueWhite',
    'GiftBox_PurpleSilver',
    'GiftBox_GoldRed',
    'GiftBox_WhiteGreen',
    'Snowman',
    'Block_Grass',
    'Block_Ground',
    'Block_Sand',
    'Block_Snow',
    'Block_Snow_Falling',
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

type ItemsHudStoryOptions = {
    accountSunflowers?: number;
    cameraTarget?: [x: number, y: number, z: number];
    closeup?: boolean;
    isSandbox?: boolean;
    localSandboxStorageKey?: string;
    pickupBlock?: boolean;
    trashTargetActive?: boolean;
};

function createItemsHudQueryClient({
    accountSunflowers = 50,
    isSandbox = false,
}: ItemsHudStoryOptions) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(['blocks'], blockNames.map(createBlockData));
    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(currentAccountKeys, {
        id: 'test-account',
        sunflowers: {
            amount: accountSunflowers,
            history: [],
        },
    });
    queryClient.setQueryData(['gardens'], [{ id: 1, isSandbox }]);
    queryClient.setQueryData(['gardens', 'current', 'summer', 1], {
        id: 1,
        name: 'Test garden',
        isSandbox,
        backgroundPalette: 'current',
        stacks: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [],
    });

    return queryClient;
}

function ItemsHudTestProviders({
    children,
    accountSunflowers,
    cameraTarget,
    isSandbox = false,
    localSandboxStorageKey,
    closeup = false,
    pickupBlock = false,
    trashTargetActive = false,
}: PropsWithChildren<ItemsHudStoryOptions>) {
    const queryClient = useMemo(
        () => createItemsHudQueryClient({ accountSunflowers, isSandbox }),
        [accountSunflowers, isSandbox],
    );
    const gameStore = useMemo(() => {
        const store = createGameState({
            appBaseUrl: 'http://localhost',
            freezeTime: new Date('2026-05-13T12:00:00.000Z'),
            isMock: false,
            localSandboxStorageKey,
            winterMode: 'summer',
        });
        if (pickupBlock) {
            store.setState({
                pickupBlock: {
                    id: 'pickup-block-1',
                    name: 'Block_Grass',
                    rotation: 0,
                },
                sandboxBlockTrashDropTargetActive: trashTargetActive,
            });
        }
        if (closeup) {
            store.setState({ view: 'closeup' });
        }
        if (cameraTarget) {
            store.setState({
                gameCamera: createMockGameCamera(cameraTarget),
            });
        }
        return store;
    }, [
        cameraTarget,
        closeup,
        localSandboxStorageKey,
        pickupBlock,
        trashTargetActive,
    ]);

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

function BottomControlsTestFrame({ closeup = false }: { closeup?: boolean }) {
    return (
        <div
            data-testid="bottom-controls"
            aria-hidden={closeup}
            inert={closeup ? true : undefined}
            className={cx(
                gameHudBottomControlsClassName,
                getGameHudBottomCloseupClassName(closeup),
            )}
        >
            <div className="h-10 w-40 rounded-lg border bg-muted" />
        </div>
    );
}

function ItemsHudTestFrame({ closeup = false }: { closeup?: boolean }) {
    return (
        <div
            data-testid="bottom-items"
            aria-hidden={closeup}
            inert={closeup ? true : undefined}
            className={cx(
                gameHudBottomItemsClassName,
                getGameHudBottomCloseupClassName(closeup),
            )}
        >
            <ItemsHud />
        </div>
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
                    <BottomControlsTestFrame />
                    <ItemsHudTestFrame />
                </div>
            </div>
        </ItemsHudTestProviders>
    );
}

export function ItemsHudCameraTargetStory() {
    return (
        <ItemsHudTestProviders cameraTarget={[12.4, 0, -7.6]}>
            <div className="relative h-screen w-screen overflow-hidden">
                <div
                    data-testid="bottom-hud"
                    className={gameHudBottomBarClassName}
                >
                    <BottomControlsTestFrame />
                    <ItemsHudTestFrame />
                </div>
            </div>
        </ItemsHudTestProviders>
    );
}

export function LowSunflowerBalanceItemsHudStory() {
    return (
        <ItemsHudTestProviders accountSunflowers={20}>
            <div className="relative h-screen w-screen overflow-hidden">
                <div
                    data-testid="bottom-hud"
                    className={gameHudBottomBarClassName}
                >
                    <BottomControlsTestFrame />
                    <ItemsHudTestFrame />
                </div>
            </div>
        </ItemsHudTestProviders>
    );
}

export function ItemsHudControlsTooltipStory() {
    return (
        <ItemsHudTestProviders>
            <div className="relative h-screen w-screen overflow-hidden">
                <div
                    data-testid="bottom-hud"
                    className={gameHudBottomBarClassName}
                >
                    <div
                        data-testid="bottom-controls"
                        className={cx(
                            gameHudBottomControlsClassName,
                            getGameHudBottomCloseupClassName(false),
                        )}
                    >
                        <div className="h-10 w-40 rounded-lg border bg-muted" />
                        <ControlsTooltipHud />
                    </div>
                    <ItemsHudTestFrame />
                </div>
            </div>
        </ItemsHudTestProviders>
    );
}

export function SandboxItemsHudStory() {
    return (
        <ItemsHudTestProviders isSandbox>
            <div className="relative h-screen w-screen overflow-hidden">
                <div
                    data-testid="bottom-hud"
                    className={gameHudBottomBarClassName}
                >
                    <BottomControlsTestFrame />
                    <ItemsHudTestFrame />
                </div>
            </div>
        </ItemsHudTestProviders>
    );
}

export function LocalSandboxItemsHudStory() {
    return (
        <ItemsHudTestProviders
            isSandbox
            localSandboxStorageKey={`${defaultLocalSandboxStorageKey}.items-hud-test`}
        >
            <div className="relative h-screen w-screen overflow-hidden">
                <div
                    data-testid="bottom-hud"
                    className={gameHudBottomBarClassName}
                >
                    <BottomControlsTestFrame />
                    <ItemsHudTestFrame />
                </div>
            </div>
        </ItemsHudTestProviders>
    );
}

export function SandboxBlockTrashDropTargetStory() {
    return (
        <ItemsHudTestProviders isSandbox pickupBlock trashTargetActive>
            <div className="relative h-screen w-screen overflow-hidden">
                <div
                    data-testid="bottom-hud"
                    className={gameHudBottomBarClassName}
                >
                    <BottomControlsTestFrame />
                    <SandboxBlockTrashDropTarget />
                    <ItemsHudTestFrame />
                </div>
            </div>
        </ItemsHudTestProviders>
    );
}

export function CloseupBottomHudStory() {
    return (
        <ItemsHudTestProviders closeup>
            <div className="relative h-screen w-screen overflow-hidden">
                <div
                    data-testid="bottom-hud"
                    className={gameHudBottomBarClassName}
                >
                    <BottomControlsTestFrame closeup />
                    <ItemsHudTestFrame closeup />
                </div>
            </div>
        </ItemsHudTestProviders>
    );
}
