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

const createdAt = new Date(0).toISOString();

function createLocalSandboxBlockData(
    name: (typeof localSandboxBlockNames)[number],
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
            height: isGroundBlock ? 1 : 0.8,
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
