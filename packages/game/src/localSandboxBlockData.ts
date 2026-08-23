import type { BlockData } from '@gredice/client';
import {
    type ArrowSignDirection,
    arrowSignConfigs,
    arrowSignNames,
} from './entities/signageConfig';

export const localSandboxBlockNames = [
    'Raised_Bed',
    'Bucket',
    'WateringCan',
    'PaintRoller',
    'Composter',
    'GardenBox',
    'ShovelSmall',
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
    'StoneSmall',
    'StoneMedium',
    'StoneLarge',
    'DesertStoneSmall',
    'DesertStoneMedium',
    'DesertStoneLarge',
    'MulchWood',
    'MulchCoconut',
    'MulchHey',
    'GiftBox_RedWhite',
    'GiftBox_GreenGold',
    'GiftBox_BlueWhite',
    'GiftBox_PurpleSilver',
    'GiftBox_GoldRed',
    'GiftBox_WhiteGreen',
    'Snowman',
    'Shade',
    'BeachUmbrella',
    'Stool',
    'WoodenBench',
    ...arrowSignNames,
    'WoodenSign',
    'OutletDisplayTable',
    'Fence',
    'WhiteFence',
    'StoneFence',
    'PolishedStoneFence',
    'FenceGate',
    'WhiteFenceGate',
    'StoneFenceGate',
    'PolishedStoneFenceGate',
    'SmallWoodenBridge',
    'WoodenWalkway',
    'StoneWalkway',
    'FishingBoat',
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
    'BirdHouse',
    'FireflyJar',
    'EnamelGardenLamp',
    'DoubleGardenLightPole',
    'HazelLightArch',
    'RoofTileLantern',
    'WickerGardenLantern',
    'WoodenHandLantern',
    'MoonRainBarrel',
    'CatPillow',
    'ChickenCoop',
    'DogHouse',
    'PigletPen',
    'Rabbit',
    'Bush',
    'Tree',
    'Pine',
    'PineAdvent',
    'DeadTreeTall',
    'DeadTreeStump',
    'Tulip',
    'Sunflower',
    'CactusBarrel',
    'CactusColumnCluster',
    'CactusPricklyPear',
    'Block_Grass',
    'Block_Ground',
    'Block_Dry_Ground',
    'Block_Swamp_Ground',
    'Block_Stone',
    'Block_Polished_Stone',
    'Block_Gravel',
    'Block_Sand',
    'Block_Snow',
    'Block_Snow_Falling',
    'Block_Water',
    'Block_Swamp_Water',
    'Block_Grass_Angle',
    'Block_Ground_Angle',
    'Block_Dry_Ground_Angle',
    'Block_Dry_Ground_Corner',
    'Block_Dry_Ground_Reverse_Corner',
    'Block_Swamp_Ground_Angle',
    'Block_Stone_Angle',
    'Block_Polished_Stone_Angle',
    'Block_Gravel_Angle',
    'Block_Sand_Angle',
    'Block_Snow_Angle',
    'Block_Stone_Stairs',
    'Block_Stone_Stairs_Corner',
    'Block_Polished_Stone_Stairs',
    'Block_Polished_Stone_Stairs_Corner',
    // Kept so gardens authored with the previous offer name still render.
    'Block_Stone_Stairs_Half',
    'Block_Grass_Corner',
    'Block_Ground_Corner',
    'Block_Sand_Corner',
    'Block_Snow_Corner',
    'Block_Grass_Reverse_Corner',
    'Block_Ground_Reverse_Corner',
    'Block_Sand_Reverse_Corner',
    'Block_Snow_Reverse_Corner',
] as const;

export type LocalSandboxBlockName = (typeof localSandboxBlockNames)[number];

const localSandboxBlockMetadata: Partial<
    Record<
        LocalSandboxBlockName,
        {
            label: string;
            shortDescription: string;
            fullDescription?: string;
        }
    >
> = {
    ChickenCoop: {
        label: 'Kokošinjac',
        shortDescription:
            'Topao drveni kokošinjac koji u vrt dovodi znatiželjnu kokoš.',
        fullDescription:
            'Smjesti drveni kokošinjac uz gredice i u vrt će stići znatiželjna kokoš. Danju će kljucati i istraživati okolicu, a pred noć se vraćati svojem sigurnom skloništu.',
    },
    PigletPen: {
        label: 'Obor za praščića',
        shortDescription:
            'Mali obor s kaljužom koji u vrt dovodi razigranog praščića.',
        fullDescription:
            'Postavi niski obor od pruća s koritom i kaljužom pa će u vrt stići razigrani praščić. Njuškat će po zemlji, valjati se u blatu i vraćati se u svoj zaklon.',
    },
    Rabbit: {
        label: 'Zec',
        shortDescription:
            'Znatiželjni zec koji skakuće vrtom, njuška i kratko pase.',
        fullDescription:
            'Postavi zeca izravno u vrt. Skakutat će po sigurnom tlu, zastajati kako bi njuškao, uređivao krzno i kratko grickao travu, a pred avatarom će brzo pobjeći obilazeći prepreke.',
    },
    Block_Stone: {
        label: 'Kamen',
        shortDescription:
            'Veliki kameni blok sa zakošenim bridovima za čvrste vrtne površine i zidove.',
    },
    Block_Stone_Angle: {
        label: 'Kamen rub',
        shortDescription:
            'Kosi kameni rub sa zakošenim bridovima za završetke kamenih površina.',
    },
    Block_Gravel: {
        label: 'Šljunak',
        shortDescription:
            'Topliji sivosmeđi šljunčani blok sa sitnim kamenčićima za povezane staze i suhe vrtne površine.',
    },
    Block_Gravel_Angle: {
        label: 'Šljunak rub',
        shortDescription:
            'Kosi rub od toplijeg sivosmeđeg šljunka za prirodne prijelaze uz staze i nasipe.',
    },
    Block_Dry_Ground: {
        label: 'Suha zemlja',
        shortDescription:
            'Topla smeđa suha zemlja, tek nešto svjetlija od obične zemlje, za osunčane i ogoljene dijelove vrta.',
    },
    Block_Dry_Ground_Angle: {
        label: 'Suha zemlja rub',
        shortDescription:
            'Kosi rub tople smeđe suhe zemlje za blage prijelaze između terenskih razina.',
    },
    Block_Dry_Ground_Corner: {
        label: 'Suha zemlja kut',
        shortDescription:
            'Kutni nagib tople smeđe suhe zemlje za vanjske zavoje terena.',
    },
    Block_Dry_Ground_Reverse_Corner: {
        label: 'Suha zemlja obrnuti kut',
        shortDescription:
            'Obrnuti kutni nagib tople smeđe suhe zemlje za unutarnje zavoje terena.',
    },
    Block_Swamp_Ground: {
        label: 'Močvarna zemlja',
        shortDescription:
            'Smeđezelena vlažna zemlja sa svijetlosmeđim raslinjem za močvarne dijelove vrta.',
    },
    Block_Swamp_Ground_Angle: {
        label: 'Močvarna zemlja rub',
        shortDescription:
            'Kosi rub smeđezelene močvarne zemlje sa svijetlosmeđim raslinjem.',
    },
    Block_Swamp_Water: {
        label: 'Močvarna voda',
        shortDescription:
            'Zelenkasta močvarna voda sa zelenim algama na mirnoj površini.',
    },
    Block_Stone_Stairs: {
        label: 'Kamene stube',
        shortDescription:
            'Pune kamene stube s dvije razine za povezivanje nižih i viših površina.',
    },
    Block_Stone_Stairs_Corner: {
        label: 'Kutne kamene stube',
        shortDescription:
            'Kutne kamene stube s dvije razine za povezivanje kamenih stubišta oko zavoja.',
    },
    Block_Stone_Stairs_Half: {
        label: 'Kutne kamene stube',
        shortDescription:
            'Prethodni naziv kutnih kamenih stuba, zadržan za postojeće vrtove.',
    },
    Block_Polished_Stone: {
        label: 'Polirani kamen',
        shortDescription:
            'Jednodijelni blok glatkog poliranog kamena za uredne vrtne površine i zidove.',
    },
    Block_Polished_Stone_Angle: {
        label: 'Polirani kamen rub',
        shortDescription:
            'Kosi jednodijelni rub od poliranog kamena za uredne prijelaze između razina.',
    },
    Block_Polished_Stone_Stairs: {
        label: 'Polirane kamene stube',
        shortDescription:
            'Jednodijelne polirane kamene stube s dvije razine za ravne prijelaze.',
    },
    Block_Polished_Stone_Stairs_Corner: {
        label: 'Kutne polirane kamene stube',
        shortDescription:
            'Jednodijelne kutne stube od poliranog kamena za povezivanje stubišta oko zavoja.',
    },
    WhiteFence: {
        label: 'Bijela ograda',
        shortDescription:
            'Tanka bijela ograda sa širokim šiljastim daskama koja se povezuje sa susjednim dijelovima.',
    },
    StoneFence: {
        label: 'Kamena ograda',
        shortDescription:
            'Ograda od nepravilnog kamena koja se povezuje sa susjednim kamenim dijelovima.',
    },
    PolishedStoneFence: {
        label: 'Ograda od poliranog kamena',
        shortDescription:
            'Jednostavna glatka ograda koja se povezuje sa susjednim dijelovima od poliranog kamena.',
    },
    FenceGate: {
        label: 'Vrata za drvenu ogradu',
        shortDescription:
            'Drvena vrtna vrata koja se otvaraju dodirom i propuštaju posjetitelje i životinje.',
    },
    WhiteFenceGate: {
        label: 'Vrata za bijelu ogradu',
        shortDescription:
            'Bijela vrtna vrata koja se otvaraju dodirom i uklapaju u bijelu ogradu.',
    },
    StoneFenceGate: {
        label: 'Vrata za kamenu ogradu',
        shortDescription:
            'Kamena vrtna vrata koja nastavljaju izgled ograde od nepravilnog kamena.',
    },
    PolishedStoneFenceGate: {
        label: 'Vrata za ogradu od poliranog kamena',
        shortDescription:
            'Bijela vrtna vrata između glatkih stupova od poliranog kamena.',
    },
    StoneWalkway: {
        label: 'Kamena staza',
        shortDescription:
            'Niske vapnenačke ploče za stazu preko tla ili uskog vodenog kanala.',
    },
    FishingBoat: {
        label: 'Ribarska barka',
        shortDescription:
            'Tamna drvena barka s dvije klupe, veslima i spremljenom ribarskom mrežom.',
    },
    EnamelGardenLamp: {
        label: 'Emajlirana vrtna lampa',
        shortDescription:
            'Visoka vrtna lampa s emajliranim sjenilom i toplim, mirnim svjetlom.',
    },
    DoubleGardenLightPole: {
        label: 'Dvostruki drveni rasvjetni stup',
        shortDescription:
            'Visoki drveni stup s dvije nasuprotne svjetiljke za osvjetljenje staza i biljaka.',
    },
    HazelLightArch: {
        label: 'Svjetleći luk od lijeske',
        shortDescription:
            'Luk od lijeskovih grana s visećim lampicama za osvjetljenje vrtnog prolaza.',
    },
    RoofTileLantern: {
        label: 'Fenjer od starog crijepa',
        shortDescription:
            'Niski fenjer od starog crijepa koji stazu obasjava toplim svjetlom.',
    },
    WickerGardenLantern: {
        label: 'Pleteni vrtni fenjer',
        shortDescription:
            'Zaobljeni fenjer od pruća koji kroz pletivo širi meko jantarno svjetlo.',
    },
    WoodenHandLantern: {
        label: 'Drveni ručni fenjer',
        shortDescription:
            'Mali drveni ručni fenjer s toplim svjetlom za vrtne kutke.',
    },
    MoonRainBarrel: {
        label: 'Mjesečeva bačva',
        shortDescription:
            'Ukrasna drvena bačva s plavom vodom koja noću svijetli poput mjesečine.',
    },
};

const createdAt = new Date(0).toISOString();

function getArrowSignHeight(direction: ArrowSignDirection) {
    return direction === 'Up' || direction === 'Down' ? 1.32 : 1.18;
}

const localSandboxStackHeights: Partial<Record<LocalSandboxBlockName, number>> =
    {
        ...Object.fromEntries(
            arrowSignConfigs.map((config) => [
                config.name,
                getArrowSignHeight(config.direction),
            ]),
        ),
        Block_Grass: 0.4,
        Block_Ground: 0.4,
        Block_Dry_Ground: 0.4,
        Block_Swamp_Ground: 0.4,
        Block_Stone: 0.4,
        Block_Polished_Stone: 0.4,
        Block_Gravel: 0.4,
        Block_Sand: 0.4,
        Block_Snow: 0.4,
        Block_Snow_Falling: 0.4,
        Block_Water: 0.4,
        Block_Swamp_Water: 0.4,
        Block_Grass_Angle: 0.4,
        Block_Ground_Angle: 0.4,
        Block_Dry_Ground_Angle: 0.4,
        Block_Dry_Ground_Corner: 0.4,
        Block_Dry_Ground_Reverse_Corner: 0.4,
        Block_Swamp_Ground_Angle: 0.4,
        Block_Stone_Angle: 0.4,
        Block_Polished_Stone_Angle: 0.4,
        Block_Gravel_Angle: 0.4,
        Block_Sand_Angle: 0.4,
        Block_Snow_Angle: 0.4,
        Block_Stone_Stairs: 0.4,
        Block_Stone_Stairs_Corner: 0.4,
        Block_Polished_Stone_Stairs: 0.4,
        Block_Polished_Stone_Stairs_Corner: 0.4,
        Block_Stone_Stairs_Half: 0.4,
        Block_Grass_Corner: 0.4,
        Block_Ground_Corner: 0.4,
        Block_Sand_Corner: 0.4,
        Block_Snow_Corner: 0.4,
        Block_Grass_Reverse_Corner: 0.4,
        Block_Ground_Reverse_Corner: 0.4,
        Block_Sand_Reverse_Corner: 0.4,
        Block_Snow_Reverse_Corner: 0.4,
        GiftBox_BlueWhite: 0.62,
        GiftBox_GoldRed: 0.62,
        GiftBox_GreenGold: 0.62,
        GiftBox_PurpleSilver: 0.62,
        GiftBox_RedWhite: 0.62,
        GiftBox_WhiteGreen: 0.62,
        MulchCoconut: 0.01,
        MulchHey: 0.01,
        MulchWood: 0.01,
        PaintRoller: 0.9,
        BeachUmbrella: 1.8,
        LemonadeStand: 1.9,
        IceCreamCart: 1.9,
        SummerHat: 0.2,
        BeachTowelStriped: 0.08,
        InflatablePoolSmall: 0.35,
        BeachChair: 0.55,
        WoodenBench: 0.41,
        WoodenSign: 1.16,
        OutletDisplayTable: 0.67,
        WhiteFence: 0.72,
        StoneFence: 0.68,
        PolishedStoneFence: 0.68,
        FenceGate: 0.72,
        WhiteFenceGate: 0.72,
        StoneFenceGate: 0.68,
        PolishedStoneFenceGate: 0.68,
        PalmTree: 1.5,
        BeachBall: 0.32,
        SandcastleSmallA: 0.35,
        SmallWoodenBridge: 0.38,
        WoodenWalkway: 0.1,
        Stool: 0.39,
        StoneWalkway: 0.1,
        EnamelGardenLamp: 1.45,
        DoubleGardenLightPole: 2.2,
        HazelLightArch: 1.65,
        RoofTileLantern: 0.4,
        WickerGardenLantern: 0.7,
        WoodenHandLantern: 0.66,
        MoonRainBarrel: 1,
        ChickenCoop: 0.86,
        PigletPen: 0.78,
        Rabbit: 0.76,
        FishingBoat: 0.62,
        PineAdvent: 2.6,
        Raised_Bed: 0.35,
        Snowman: 0.5,
        Sunflower: 1,
    };

type LocalSandboxHitboxAttributes = Partial<
    Record<
        LocalSandboxBlockName,
        Pick<
            BlockData['attributes'],
            'hitboxDepth' | 'hitboxHeight' | 'hitboxWidth'
        >
    >
>;

const localSandboxHitboxAttributes: LocalSandboxHitboxAttributes = {
    ...Object.fromEntries(
        arrowSignConfigs.map((config) => [
            config.name,
            {
                hitboxDepth: 0.12,
                hitboxHeight: getArrowSignHeight(config.direction),
                hitboxWidth: 0.8,
            },
        ]),
    ),
    MulchCoconut: {
        hitboxDepth: 0.96,
        hitboxHeight: 0.08,
        hitboxWidth: 0.96,
    },
    MulchHey: {
        hitboxDepth: 0.96,
        hitboxHeight: 0.08,
        hitboxWidth: 0.96,
    },
    MulchWood: {
        hitboxDepth: 0.96,
        hitboxHeight: 0.08,
        hitboxWidth: 0.96,
    },
    Block_Stone_Stairs_Corner: {
        hitboxDepth: 1,
        hitboxHeight: 0.4,
        hitboxWidth: 1,
    },
    Block_Stone_Stairs_Half: {
        hitboxDepth: 1,
        hitboxHeight: 0.4,
        hitboxWidth: 1,
    },
    Block_Polished_Stone_Stairs_Corner: {
        hitboxDepth: 1,
        hitboxHeight: 0.4,
        hitboxWidth: 1,
    },
    SmallWoodenBridge: {
        hitboxDepth: 1,
        hitboxHeight: 0.38,
        hitboxWidth: 0.84,
    },
    WoodenWalkway: {
        hitboxDepth: 1,
        hitboxHeight: 0.1,
        hitboxWidth: 0.86,
    },
    Stool: {
        hitboxDepth: 0.66,
        hitboxHeight: 0.39,
        hitboxWidth: 0.66,
    },
    StoneWalkway: {
        hitboxDepth: 1,
        hitboxHeight: 0.1,
        hitboxWidth: 0.86,
    },
    EnamelGardenLamp: {
        hitboxDepth: 0.46,
        hitboxHeight: 1.45,
        hitboxWidth: 0.52,
    },
    DoubleGardenLightPole: {
        hitboxDepth: 0.38,
        hitboxHeight: 2.2,
        hitboxWidth: 0.94,
    },
    HazelLightArch: {
        hitboxDepth: 1,
        hitboxHeight: 1.65,
        hitboxWidth: 0.24,
    },
    RoofTileLantern: {
        hitboxDepth: 0.48,
        hitboxHeight: 0.4,
        hitboxWidth: 0.48,
    },
    WickerGardenLantern: {
        hitboxDepth: 0.62,
        hitboxHeight: 0.7,
        hitboxWidth: 0.62,
    },
    WoodenHandLantern: {
        hitboxDepth: 0.4,
        hitboxHeight: 0.66,
        hitboxWidth: 0.44,
    },
    MoonRainBarrel: {
        hitboxDepth: 0.84,
        hitboxHeight: 1,
        hitboxWidth: 0.76,
    },
    FishingBoat: {
        hitboxDepth: 1.84,
        hitboxHeight: 0.62,
        hitboxWidth: 0.94,
    },
    SummerHat: {
        hitboxDepth: 0.64,
        hitboxHeight: 0.2,
        hitboxWidth: 0.8,
    },
    WoodenBench: {
        hitboxDepth: 0.36,
        hitboxHeight: 0.41,
        hitboxWidth: 1.1,
    },
    WoodenSign: {
        hitboxDepth: 0.12,
        hitboxHeight: 1.16,
        hitboxWidth: 0.88,
    },
    OutletDisplayTable: {
        hitboxDepth: 0.75,
        hitboxHeight: 0.67,
        hitboxWidth: 0.9,
    },
    WhiteFence: {
        hitboxDepth: 1,
        hitboxHeight: 0.72,
        hitboxWidth: 1,
    },
    StoneFence: {
        hitboxDepth: 1,
        hitboxHeight: 0.68,
        hitboxWidth: 1,
    },
    PolishedStoneFence: {
        hitboxDepth: 1,
        hitboxHeight: 0.68,
        hitboxWidth: 1,
    },
    FenceGate: {
        hitboxDepth: 1,
        hitboxHeight: 0.72,
        hitboxWidth: 1,
    },
    WhiteFenceGate: {
        hitboxDepth: 1,
        hitboxHeight: 0.72,
        hitboxWidth: 1,
    },
    StoneFenceGate: {
        hitboxDepth: 1,
        hitboxHeight: 0.68,
        hitboxWidth: 1,
    },
    PolishedStoneFenceGate: {
        hitboxDepth: 1,
        hitboxHeight: 0.68,
        hitboxWidth: 1,
    },
    ChickenCoop: {
        hitboxDepth: 0.97,
        hitboxHeight: 0.86,
        hitboxWidth: 0.76,
    },
    PigletPen: {
        hitboxDepth: 0.89,
        hitboxHeight: 0.78,
        hitboxWidth: 0.94,
    },
    Rabbit: {
        hitboxDepth: 0.72,
        hitboxHeight: 0.76,
        hitboxWidth: 0.58,
    },
};

type LocalSandboxPlacementAttributes = Partial<
    Record<
        LocalSandboxBlockName,
        Pick<
            BlockData['attributes'],
            'placeableOnWater' | 'spanDepth' | 'spanWidth'
        >
    >
>;

const localSandboxPlacementAttributes: LocalSandboxPlacementAttributes = {
    Block_Swamp_Water: { placeableOnWater: true },
    SmallWoodenBridge: { placeableOnWater: true },
    WoodenWalkway: { placeableOnWater: true },
    StoneWalkway: {
        placeableOnWater: true,
        spanDepth: 1,
        spanWidth: 1,
    },
    FishingBoat: {
        placeableOnWater: true,
        spanDepth: 2,
        spanWidth: 1,
    },
    EnamelGardenLamp: {
        placeableOnWater: false,
        spanDepth: 1,
        spanWidth: 1,
    },
    DoubleGardenLightPole: {
        placeableOnWater: false,
        spanDepth: 1,
        spanWidth: 1,
    },
    HazelLightArch: {
        placeableOnWater: false,
        spanDepth: 1,
        spanWidth: 1,
    },
    RoofTileLantern: {
        placeableOnWater: false,
        spanDepth: 1,
        spanWidth: 1,
    },
    WickerGardenLantern: {
        placeableOnWater: false,
        spanDepth: 1,
        spanWidth: 1,
    },
    WoodenHandLantern: {
        placeableOnWater: false,
        spanDepth: 1,
        spanWidth: 1,
    },
    MoonRainBarrel: {
        placeableOnWater: false,
        spanDepth: 1,
        spanWidth: 1,
    },
    ChickenCoop: {
        placeableOnWater: false,
        spanDepth: 1,
        spanWidth: 1,
    },
    PigletPen: {
        placeableOnWater: false,
        spanDepth: 1,
        spanWidth: 1,
    },
    Rabbit: {
        placeableOnWater: false,
        spanDepth: 1,
        spanWidth: 1,
    },
};

function getLocalSandboxStackHeight(name: LocalSandboxBlockName) {
    return localSandboxStackHeights[name] ?? 0.8;
}

function createLocalSandboxBlockData(
    name: LocalSandboxBlockName,
    index: number,
): BlockData {
    const isGroundBlock = name.startsWith('Block_');
    const isRaisedBed = name === 'Raised_Bed';
    const isOutletDisplayTable = name === 'OutletDisplayTable';
    const metadata = localSandboxBlockMetadata[name];
    return {
        id: index + 1,
        entityType: {
            id: 8,
            name: 'block',
            label: 'Blok',
        },
        slug: name.toLowerCase().replaceAll('_', '-'),
        information: {
            name,
            label:
                metadata?.label ??
                (isOutletDisplayTable
                    ? 'Drveni izložbeni stol'
                    : name.replaceAll('_', ' ')),
            shortDescription:
                metadata?.shortDescription ??
                (isOutletDisplayTable
                    ? 'Čvrst drveni stol za izlaganje tegli, biljaka i vrtnih ukrasa.'
                    : ''),
            fullDescription:
                metadata?.fullDescription ??
                metadata?.shortDescription ??
                (isOutletDisplayTable
                    ? 'Izložbeni stol izrađen od toplih drvenih dasaka. Postavi ga uz gredice ili vrtnu stazu, a na njegovu plohu složi tegle i druge ukrase.'
                    : ''),
        },
        attributes: {
            height: getLocalSandboxStackHeight(name),
            stackable: isGroundBlock || isOutletDisplayTable,
            type: isRaisedBed ? 'raisedBed' : 'decoration',
            nightOnlyPurchase: false,
            ...localSandboxHitboxAttributes[name],
            ...localSandboxPlacementAttributes[name],
            ...(['LemonadeStand', 'IceCreamCart'].includes(name)
                ? { spanDepth: 2, spanWidth: 3 }
                : {}),
        },
        prices: {
            sunflowers: 0,
        },
        functions: {
            recycler: false,
            raisedBed: isRaisedBed,
        },
        createdAt,
        updatedAt: createdAt,
    };
}

export function getLocalSandboxBlockData(): BlockData[] {
    return localSandboxBlockNames.map(createLocalSandboxBlockData);
}
