import type { BlockData } from '@gredice/client';

const localSandboxBlockNames = [
    'Raised_Bed',
    'Bucket',
    'WateringCan',
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
    'BaleHey',
    'MulchHey',
    'MulchCoconut',
    'MulchWood',
    'GiftBox_RedWhite',
    'GiftBox_GreenGold',
    'GiftBox_BlueWhite',
    'GiftBox_PurpleSilver',
    'GiftBox_GoldRed',
    'GiftBox_WhiteGreen',
    'Snowman',
    'Shade',
    'Stool',
    'Fence',
    'WaterWell',
    'BirdHouse',
    'FireflyJar',
    'CatPillow',
    'Bush',
    'Tree',
    'Pine',
    'PineAdvent',
    'DeadTreeTall',
    'DeadTreeStump',
    'Tulip',
    'CactusBarrel',
    'CactusColumnCluster',
    'CactusPricklyPear',
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
] as const;

type LocalSandboxBlockName = (typeof localSandboxBlockNames)[number];

const createdAt = new Date(0).toISOString();

const localSandboxStackHeights: Partial<Record<LocalSandboxBlockName, number>> =
    {
        Block_Grass: 0.4,
        Block_Ground: 0.4,
        Block_Sand: 0.4,
        Block_Snow: 0.4,
        Block_Snow_Falling: 0.4,
        Block_Water: 0.4,
        Block_Grass_Angle: 0.25,
        Block_Ground_Angle: 0.25,
        Block_Sand_Angle: 0.25,
        Block_Snow_Angle: 0.4,
        Block_Grass_Corner: 0.25,
        Block_Ground_Corner: 0.25,
        Block_Sand_Corner: 0.25,
        Block_Snow_Corner: 0.4,
        Block_Grass_Reverse_Corner: 0.25,
        Block_Ground_Reverse_Corner: 0.25,
        Block_Sand_Reverse_Corner: 0.25,
        Block_Snow_Reverse_Corner: 0.4,
        GiftBox_BlueWhite: 0.62,
        GiftBox_GoldRed: 0.62,
        GiftBox_GreenGold: 0.62,
        GiftBox_PurpleSilver: 0.62,
        GiftBox_RedWhite: 0.62,
        GiftBox_WhiteGreen: 0.62,
        PineAdvent: 2.6,
        Raised_Bed: 0.35,
        Snowman: 0.5,
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
            label: name.replaceAll('_', ' '),
            shortDescription: '',
            fullDescription: '',
        },
        attributes: {
            height: getLocalSandboxStackHeight(name),
            stackable: isGroundBlock,
            type: isRaisedBed ? 'raisedBed' : 'decoration',
            nightOnlyPurchase: false,
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
