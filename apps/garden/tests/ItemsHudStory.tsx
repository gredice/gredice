import type { BlockData } from '@gredice/client';
import { cx } from '@gredice/ui/utils';
import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import type {
    GameCameraRigApi,
    GameCameraSnapshot,
} from '../../../packages/game/src/controls/GameCameraRigApi';
import { arrowSignNames } from '../../../packages/game/src/entities/signageConfig';
import {
    gameHudBottomBarClassName,
    gameHudBottomControlsClassName,
    gameHudBottomItemsClassName,
    getGameHudBottomCloseupClassName,
} from '../../../packages/game/src/GameHud';
import { currentAccountKeys } from '../../../packages/game/src/hooks/useCurrentAccount';
import { ControlsTooltipHud } from '../../../packages/game/src/hud/ControlsTooltipHud';
import { ItemsHud } from '../../../packages/game/src/hud/ItemsHud';
import { defaultLocalSandboxStorageKey } from '../../../packages/game/src/localSandboxGarden';
import {
    createGameState,
    GameStateContext,
    useGameState,
} from '../../../packages/game/src/useGameState';

const now = '2026-05-13T00:00:00.000Z';

const blockFixtures: Record<
    string,
    {
        label: string;
        shortDescription: string;
        sunflowers: number;
        height: number;
        stackable: boolean;
    }
> = {
    Block_Stone: {
        label: 'Kamen',
        shortDescription:
            'Veliki kameni blok sa zakošenim bridovima za čvrste vrtne površine i zidove.',
        sunflowers: 5,
        height: 0.4,
        stackable: true,
    },
    Block_Stone_Angle: {
        label: 'Kamen rub',
        shortDescription:
            'Kosi kameni rub sa zakošenim bridovima za završetke kamenih površina.',
        sunflowers: 5,
        height: 0.4,
        stackable: true,
    },
    Block_Gravel: {
        label: 'Šljunak',
        shortDescription:
            'Sivi šljunčani blok sa sitnim kamenčićima za staze i suhe vrtne površine.',
        sunflowers: 5,
        height: 0.4,
        stackable: true,
    },
    Block_Gravel_Angle: {
        label: 'Šljunak rub',
        shortDescription:
            'Kosi rub od sivog šljunka za prirodne prijelaze uz staze i nasipe.',
        sunflowers: 5,
        height: 0.4,
        stackable: true,
    },
    Block_Dry_Ground: {
        label: 'Suha zemlja',
        shortDescription:
            'Svijetla suha zemlja bez raslinja za osunčane i ogoljene dijelove vrta.',
        sunflowers: 5,
        height: 0.4,
        stackable: true,
    },
    Block_Dry_Ground_Angle: {
        label: 'Suha zemlja rub',
        shortDescription:
            'Kosi rub svijetle suhe zemlje za blage prijelaze između terenskih razina.',
        sunflowers: 5,
        height: 0.4,
        stackable: true,
    },
    Block_Swamp_Ground: {
        label: 'Močvarna zemlja',
        shortDescription:
            'Smeđesiva vlažna zemlja sa svijetlosmeđim raslinjem za močvarne dijelove vrta.',
        sunflowers: 5,
        height: 0.4,
        stackable: true,
    },
    Block_Swamp_Ground_Angle: {
        label: 'Močvarna zemlja rub',
        shortDescription:
            'Kosi rub smeđesive močvarne zemlje sa svijetlosmeđim raslinjem.',
        sunflowers: 5,
        height: 0.4,
        stackable: true,
    },
    Block_Swamp_Water: {
        label: 'Močvarna voda',
        shortDescription:
            'Zelenkasta močvarna voda sa zelenim algama na mirnoj površini.',
        sunflowers: 5,
        height: 0.4,
        stackable: true,
    },
    Block_Stone_Stairs: {
        label: 'Kamene stube',
        shortDescription:
            'Pune kamene stube s dvije razine za povezivanje nižih i viših površina.',
        sunflowers: 5,
        height: 0.4,
        stackable: true,
    },
    Block_Stone_Stairs_Half: {
        label: 'Kamene polustube',
        shortDescription:
            'Kamene stube pola širine za završetke, rubove i uske prijelaze.',
        sunflowers: 5,
        height: 0.4,
        stackable: true,
    },
    MulchWood: {
        label: 'Malč - kora drveta',
        shortDescription:
            'Malč od kore drveta koristi se za zadržavanje vlage, zaštitu tla i smanjenje rasta korova.',
        sunflowers: 20,
        height: 0.01,
        stackable: true,
    },
    MulchCoconut: {
        label: 'Malč - kokosova kora',
        shortDescription:
            'Malč od kokosove kore koristi se za zaštitu tla, očuvanje vlage i dekorativni izgled gredice.',
        sunflowers: 20,
        height: 0.01,
        stackable: true,
    },
    MulchHey: {
        label: 'Malč - slama',
        shortDescription:
            'Malč od slame koristi se za zaštitu tla, zadržavanje vlage i sprječavanje rasta korova.',
        sunflowers: 20,
        height: 0.01,
        stackable: true,
    },
    SmallWoodenBridge: {
        label: 'Mali drveni most',
        shortDescription:
            'Mali lučni most za povezivanje obala uskog vrtnog kanala.',
        sunflowers: 80,
        height: 0.38,
        stackable: false,
    },
    OutletDisplayTable: {
        label: 'Drveni izložbeni stol',
        shortDescription:
            'Čvrst drveni stol za izlaganje tegli, biljaka i vrtnih ukrasa.',
        sunflowers: 40,
        height: 0.67,
        stackable: true,
    },
    WoodenWalkway: {
        label: 'Drvena staza',
        shortDescription:
            'Ravne drvene daske za stazu preko tla ili uskog vodenog kanala.',
        sunflowers: 40,
        height: 0.1,
        stackable: false,
    },
    Fence: {
        label: 'Ograda',
        shortDescription:
            'Drvena ograda koja se povezuje sa susjednim dijelovima.',
        sunflowers: 5,
        height: 0.58,
        stackable: false,
    },
    WhiteFence: {
        label: 'Bijela ograda',
        shortDescription:
            'Tanka bijela ograda sa širokim šiljastim daskama koja se povezuje sa susjednim dijelovima.',
        sunflowers: 5,
        height: 0.72,
        stackable: false,
    },
    StoneWalkway: {
        label: 'Kamena staza',
        shortDescription:
            'Niske vapnenačke ploče za stazu preko tla ili uskog vodenog kanala.',
        sunflowers: 50,
        height: 0.1,
        stackable: false,
    },
    FireflyJar: {
        label: 'Staklenka s krijesnicom',
        shortDescription:
            'Vrlo rijetka noćna dekoracija koja svijetli u vrtu i može se kupiti samo noću.',
        sunflowers: 100,
        height: 0.5,
        stackable: true,
    },
    EnamelGardenLamp: {
        label: 'Emajlirana vrtna lampa',
        shortDescription:
            'Visoka vrtna lampa s emajliranim sjenilom i toplim, mirnim svjetlom.',
        sunflowers: 80,
        height: 1.45,
        stackable: false,
    },
    HazelLightArch: {
        label: 'Svjetleći luk od lijeske',
        shortDescription:
            'Luk od lijeskovih grana s visećim lampicama za osvjetljenje vrtnog prolaza.',
        sunflowers: 120,
        height: 1.65,
        stackable: false,
    },
    RoofTileLantern: {
        label: 'Fenjer od starog crijepa',
        shortDescription:
            'Niski fenjer od starog crijepa koji stazu obasjava toplim svjetlom.',
        sunflowers: 40,
        height: 0.4,
        stackable: false,
    },
    WickerGardenLantern: {
        label: 'Pleteni vrtni fenjer',
        shortDescription:
            'Zaobljeni fenjer od pruća koji kroz pletivo širi meko jantarno svjetlo.',
        sunflowers: 60,
        height: 0.7,
        stackable: false,
    },
    WoodenHandLantern: {
        label: 'Drveni ručni fenjer',
        shortDescription:
            'Mali drveni ručni fenjer s toplim svjetlom za vrtne kutke.',
        sunflowers: 50,
        height: 0.66,
        stackable: false,
    },
    MoonRainBarrel: {
        label: 'Mjesečeva bačva',
        shortDescription:
            'Ukrasna drvena bačva s plavom vodom koja noću svijetli poput mjesečine.',
        sunflowers: 100,
        height: 1,
        stackable: false,
    },
};

function createBlockData(name: string, index: number) {
    const fixture = blockFixtures[name];

    return {
        id: index + 1,
        entityType: { id: 8, name: 'block', label: 'Blok' },
        slug: name.toLowerCase().replaceAll('_', '-'),
        information: {
            name,
            label: fixture?.label ?? name.replaceAll('_', ' '),
            shortDescription:
                fixture?.shortDescription ?? 'Mock block for HUD layout tests.',
            fullDescription:
                fixture?.shortDescription ?? 'Mock block for HUD layout tests.',
        },
        attributes: {
            height: fixture?.height ?? 1,
            nightOnlyPurchase: name === 'FireflyJar',
            stackable: fixture?.stackable ?? true,
            type: name === 'Raised_Bed' ? 'raisedBed' : 'decoration',
        },
        prices: {
            sunflowers:
                fixture?.sunflowers ?? (name === 'PaintRoller' ? 100 : 10),
        },
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
    'WoodenBench',
    ...arrowSignNames,
    'WoodenSign',
    'OutletDisplayTable',
    'Fence',
    'WhiteFence',
    'SmallWoodenBridge',
    'WoodenWalkway',
    'StoneWalkway',
    'StoneSmall',
    'StoneMedium',
    'StoneLarge',
    'MulchWood',
    'MulchCoconut',
    'MulchHey',
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
    'EnamelGardenLamp',
    'HazelLightArch',
    'RoofTileLantern',
    'WickerGardenLantern',
    'WoodenHandLantern',
    'MoonRainBarrel',
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
    'Block_Dry_Ground',
    'Block_Swamp_Ground',
    'Block_Stone',
    'Block_Gravel',
    'Block_Sand',
    'Block_Snow',
    'Block_Snow_Falling',
    'Block_Water',
    'Block_Swamp_Water',
    'Block_Grass_Angle',
    'Block_Ground_Angle',
    'Block_Dry_Ground_Angle',
    'Block_Swamp_Ground_Angle',
    'Block_Stone_Angle',
    'Block_Gravel_Angle',
    'Block_Sand_Angle',
    'Block_Snow_Angle',
    'Block_Stone_Stairs',
    'Block_Stone_Stairs_Half',
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
    pickupHudDropTargetActive?: boolean;
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
    pickupHudDropTargetActive = false,
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
                itemsHudDropTargetActive: pickupHudDropTargetActive,
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
        pickupHudDropTargetActive,
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

function HudPlacementDragStateProbe() {
    const drag = useGameState((state) => state.hudPlacementDrag);

    return (
        <output data-testid="hud-placement-drag-state">
            {drag
                ? `${drag.blockName}:${drag.dropRequest ? 'drop' : 'drag'}`
                : 'idle'}
        </output>
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

export function ItemsHudDragStateStory() {
    return (
        <ItemsHudTestProviders>
            <div className="relative h-screen w-screen overflow-hidden">
                <HudPlacementDragStateProbe />
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

export function LowSunflowerBalanceItemsHudDragStateStory() {
    return (
        <ItemsHudTestProviders accountSunflowers={20}>
            <div className="relative h-screen w-screen overflow-hidden">
                <HudPlacementDragStateProbe />
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

export function SandboxItemsHudDropTargetStory() {
    return (
        <ItemsHudTestProviders isSandbox pickupBlock>
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

export function ItemsHudDropTargetStory() {
    return (
        <ItemsHudTestProviders pickupBlock>
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

export function ActiveItemsHudDropTargetStory() {
    return (
        <ItemsHudTestProviders pickupBlock pickupHudDropTargetActive>
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
