import type { GameAssetName } from '../../data/models';
import type { EntityName } from '../../entities/entityNameMap';

/** Bump when manifest semantics change so cached comparisons never mix shapes. */
export const gardenSceneManifestVersion = 1;

/**
 * Load order. `current` blocks the first nonblank frame of the displayed
 * garden, `transition-next` covers the garden fading in, and `idle` is work
 * the scene can start without (optional props and wild fauna).
 */
export const gardenSceneAssetPriorities = [
    'current',
    'transition-next',
    'idle',
] as const;
export type GardenSceneAssetPriority =
    (typeof gardenSceneAssetPriorities)[number];

export type GardenSceneShaderVariant = 'generated-plants' | 'water-surface';

type BlockAssetRequirement = {
    readonly assets: readonly GameAssetName[];
    /** Assets that only appear in some block states (for example harvest). */
    readonly optionalAssets?: readonly GameAssetName[];
    readonly shaderVariants?: readonly GardenSceneShaderVariant[];
};

function assets(...names: GameAssetName[]): BlockAssetRequirement {
    return { assets: names };
}

/**
 * Exact GLBs each block renderer resolves through `useGameGLTF`. The mapped
 * type forces every renderable block to declare its requirements, so a new
 * entity cannot silently fall back to bucket preloading.
 */
export const blockAssetRequirements: {
    readonly [Name in EntityName]: BlockAssetRequirement;
} = {
    Block_Ground: assets('BlockGround'),
    Block_Grass: assets('BlockGrass'),
    Block_Sand: assets('BlockSand'),
    Block_Water: { assets: [], shaderVariants: ['water-surface'] },
    Block_Swamp_Water: { assets: [], shaderVariants: ['water-surface'] },
    Block_Dry_Ground: assets('BlockSand'),
    Block_Dry_Ground_Angle: assets('BlockSandAngle'),
    Block_Dry_Ground_Corner: assets('BlockTerrainCorner'),
    Block_Dry_Ground_Reverse_Corner: assets('BlockTerrainReverseCorner'),
    Block_Swamp_Ground: assets('BlockSand'),
    Block_Swamp_Ground_Angle: assets('BlockSandAngle'),
    Block_Stone: assets('BlockStone'),
    Block_Stone_Angle: assets('BlockStoneAngle'),
    Block_Gravel: assets('BlockGravel'),
    Block_Gravel_Angle: assets('BlockGravelAngle'),
    Block_Stone_Stairs: assets('BlockStoneStairs'),
    Block_Stone_Stairs_Corner: assets('BlockStoneStairsCorner'),
    Block_Stone_Stairs_Half: assets('BlockStoneStairsCorner'),
    Block_Polished_Stone: assets('BlockPolishedStone'),
    Block_Polished_Stone_Angle: assets('BlockPolishedStoneAngle'),
    Block_Polished_Stone_Stairs: assets('BlockPolishedStoneStairs'),
    Block_Polished_Stone_Stairs_Corner: assets(
        'BlockPolishedStoneStairsCorner',
    ),
    Block_Ground_Angle: assets('BlockGroundAngle'),
    Block_Grass_Angle: assets('BlockGrassAngle'),
    Block_Sand_Angle: assets('BlockSandAngle'),
    Block_Ground_Corner: assets('BlockTerrainCorner'),
    Block_Grass_Corner: assets('BlockTerrainCorner'),
    Block_Sand_Corner: assets('BlockTerrainCorner'),
    Block_Ground_Reverse_Corner: assets('BlockTerrainReverseCorner'),
    Block_Grass_Reverse_Corner: assets('BlockTerrainReverseCorner'),
    Block_Sand_Reverse_Corner: assets('BlockTerrainReverseCorner'),
    Block_Snow: assets('BlockSand'),
    Block_Snow_Angle: assets('BlockSandAngle'),
    Block_Snow_Corner: assets('BlockTerrainCorner'),
    Block_Snow_Reverse_Corner: assets('BlockTerrainReverseCorner'),
    Block_Snow_Falling: assets('BlockSand'),
    Composter: assets('Composter'),
    Cow: assets('Cow'),
    Raised_Bed: {
        assets: ['RaisedBed', 'Seed'],
        optionalAssets: ['HarvestBasket'],
        shaderVariants: ['generated-plants'],
    },
    Shade: assets('Shade'),
    BeachUmbrella: assets('BeachUmbrella'),
    Fence: assets('Fence'),
    WhiteFence: assets('WhiteFence'),
    StoneFence: assets('StoneFence'),
    PolishedStoneFence: assets('PolishedStoneFence'),
    FenceGate: assets('FenceGate'),
    WhiteFenceGate: assets('WhiteFenceGate'),
    StoneFenceGate: assets('StoneFenceGate'),
    PolishedStoneFenceGate: assets('PolishedStoneFenceGate'),
    GardenBox: assets('GardenBox'),
    Stool: assets('Stool'),
    Bucket: assets('Bucket'),
    WateringCan: assets('WateringCan'),
    LiquidPreparationBottlePestControl: assets(
        'LiquidPreparationBottlePestControl',
    ),
    LiquidPreparationBottleAphidControl: assets(
        'LiquidPreparationBottleAphidControl',
    ),
    LiquidPreparationBottleSlugControl: assets(
        'LiquidPreparationBottleSlugControl',
    ),
    LiquidPreparationBottleTomatoEggplantResistance: assets(
        'LiquidPreparationBottleTomatoEggplantResistance',
    ),
    LiquidPreparationBottleFertilizer: assets(
        'LiquidPreparationBottleFertilizer',
    ),
    LiquidPreparationBottleDiseaseControl: assets(
        'LiquidPreparationBottleDiseaseControl',
    ),
    LiquidPreparationBottleWeevilControl: assets(
        'LiquidPreparationBottleWeevilControl',
    ),
    LiquidPreparationBottleVoleControl: assets(
        'LiquidPreparationBottleVoleControl',
    ),
    LiquidPreparationBottleBeetleControl: assets(
        'LiquidPreparationBottleBeetleControl',
    ),
    PaintRoller: assets('PaintRoller'),
    WaterWell: assets('WaterWell'),
    WoodenBench: assets('WoodenBench'),
    OutletDisplayTable: assets('OutletDisplayTable'),
    LemonadeStand: assets('LemonadeStand'),
    IceCreamCart: assets('IceCreamCart'),
    SummerHat: assets('SummerHat'),
    BeachTowelStriped: assets('BeachTowelStriped'),
    InflatablePoolSmall: assets('InflatablePoolSmall'),
    BeachChair: assets('BeachChair'),
    PalmTree: assets('PalmTree'),
    BeachBall: assets('BeachBall'),
    SandcastleSmallA: assets('SandcastleSmallA'),
    BirdHouse: assets('BirdHouse'),
    ArrowSignWhiteLeft: assets('ArrowSign'),
    ArrowSignRedLeft: assets('ArrowSign'),
    ArrowSignBlueLeft: assets('ArrowSign'),
    ArrowSignGreenLeft: assets('ArrowSign'),
    ArrowSignWoodLeft: assets('ArrowSign'),
    ArrowSignWhiteRight: assets('ArrowSign'),
    ArrowSignRedRight: assets('ArrowSign'),
    ArrowSignBlueRight: assets('ArrowSign'),
    ArrowSignGreenRight: assets('ArrowSign'),
    ArrowSignWoodRight: assets('ArrowSign'),
    ArrowSignWhiteUp: assets('ArrowSign'),
    ArrowSignRedUp: assets('ArrowSign'),
    ArrowSignBlueUp: assets('ArrowSign'),
    ArrowSignGreenUp: assets('ArrowSign'),
    ArrowSignWoodUp: assets('ArrowSign'),
    ArrowSignWhiteDown: assets('ArrowSign'),
    ArrowSignRedDown: assets('ArrowSign'),
    ArrowSignBlueDown: assets('ArrowSign'),
    ArrowSignGreenDown: assets('ArrowSign'),
    ArrowSignWoodDown: assets('ArrowSign'),
    WoodenSign: assets('WoodenSign'),
    CatPillow: assets('CatPillow'),
    Cat_Pillow: assets('CatPillow'),
    ChickenCoop: assets('ChickenCoop'),
    DogHouse: assets('DogHouse'),
    PigletPen: assets('PigletPen'),
    RabbitHutch: assets('RabbitHutch'),
    HorseStable: assets('HorseStable'),
    CowShelter: assets('CowShelter'),
    GoatShelter: assets('GoatShelter'),
    SheepFold: assets('SheepFold'),
    Goat: assets('Goat'),
    Rabbit: assets('Rabbit'),
    Horse: assets('Horse'),
    Sheep: assets('Sheep'),
    SmallWoodenBridge: assets('SmallWoodenBridge'),
    WoodenWalkway: assets('WoodenWalkway'),
    StoneWalkway: assets('StoneWalkway'),
    FishingBoat: assets('FishingBoat'),
    FireflyJar: assets('FireflyJar'),
    EnamelGardenLamp: assets('EnamelGardenLamp'),
    DoubleGardenLightPole: assets('DoubleGardenLightPole'),
    HazelLightArch: assets('HazelLightArch'),
    RoofTileLantern: assets('RoofTileLantern'),
    WickerGardenLantern: assets('WickerGardenLantern'),
    WoodenHandLantern: assets('WoodenHandLantern'),
    MoonRainBarrel: assets('MoonRainBarrel'),
    GiftBox_RedWhite: assets('GiftBox'),
    GiftBox_GreenGold: assets('GiftBox'),
    GiftBox_BlueWhite: assets('GiftBox'),
    GiftBox_PurpleSilver: assets('GiftBox'),
    GiftBox_GoldRed: assets('GiftBox'),
    GiftBox_WhiteGreen: assets('GiftBox'),
    Bush: assets('Bush'),
    Tree: assets('Tree'),
    Pine: assets('Pine'),
    DeadTreeTall: assets('DeadTreeTall'),
    DeadTreeStump: assets('DeadTreeStump'),
    PineAdvent: assets('Pine'),
    StoneSmall: assets('StoneSmall'),
    StoneMedium: assets('StoneMedium'),
    StoneLarge: assets('StoneLarge'),
    DesertStoneSmall: assets('DesertStoneSmall'),
    DesertStoneMedium: assets('DesertStoneMedium'),
    DesertStoneLarge: assets('DesertStoneLarge'),
    ShovelSmall: assets('ShovelSmall'),
    Snowman: assets('Snowman'),
    Tulip: assets('Tulip'),
    Sunflower: assets('Sunflower'),
    CactusBarrel: assets('CactusBarrel', 'GardenFlower'),
    CactusColumnCluster: assets('CactusColumnCluster', 'GardenFlower'),
    CactusPricklyPear: assets('CactusPricklyPear', 'GardenFlower'),
    BaleHey: assets('BaleHey'),
    HarvestPumpkinSquatOrange: assets('HarvestPumpkinSquat'),
    HarvestPumpkinSquatCream: assets('HarvestPumpkinSquat'),
    HarvestPumpkinSquatGreen: assets('HarvestPumpkinSquat'),
    HarvestPumpkinGourdOrange: assets('HarvestPumpkinGourd'),
    HarvestPumpkinGourdCream: assets('HarvestPumpkinGourd'),
    HarvestPumpkinGourdGreen: assets('HarvestPumpkinGourd'),
    HarvestPumpkinGroupOrange: assets('HarvestPumpkinGroup'),
    HarvestPumpkinGroupCream: assets('HarvestPumpkinGroup'),
    HarvestPumpkinGroupGreen: assets('HarvestPumpkinGroup'),
    GardenScarecrow: assets('GardenScarecrow'),
    HarvestCrate: assets('HarvestCrate'),
    HarvestCrateOrchard: assets('HarvestCrateOrchard'),
    HarvestWheelbarrow: assets('HarvestWheelbarrow'),
    AutumnAsterPotMauve: assets('AutumnAsterPot'),
    AutumnAsterPotCream: assets('AutumnAsterPot'),
    AutumnAsterPotGold: assets('AutumnAsterPot'),
    AutumnShrub: assets('AutumnShrub'),
    WoodlandMushrooms: assets('WoodlandMushrooms'),
    FallenLog: assets('FallenLog'),
    AutumnLeafPileMound: assets('AutumnLeafPileMound'),
    AutumnLeafPileCrescent: assets('AutumnLeafPileCrescent'),
    LeafRake: assets('LeafRake'),
    AutumnBlanketBench: assets('AutumnBlanketBench'),
    GardenTeaTable: assets('GardenTeaTable'),
    ChestnutRoastingCart: assets('ChestnutRoastingCart'),
    StackedFirewood: assets('StackedFirewood'),
    GardenBrazier: assets('GardenBrazier'),
    AutumnGrassTuft: assets('AutumnGrassTuft'),
    AutumnSeedHeads: assets('AutumnSeedHeads'),
    SeedDryingRack: assets('SeedDryingRack'),
    WoodlandAcorns: assets('WoodlandAcorns'),
    WoodlandConkers: assets('WoodlandConkers'),
    WoodlandMushroomBasket: assets('WoodlandMushroomBasket'),
    AutumnWreathPost: assets('AutumnWreathPost'),
    AutumnGarland: assets('AutumnGarland'),
    AutumnFenceGate: assets('AutumnFenceGate'),
    SeasonalMaple: assets('SeasonalMaple'),
    PotLowBowl: assets('PotLowBowl'),
    PotRoundedBowl: assets('PotRoundedBowl'),
    PotBulbousNeck: assets('PotBulbousNeck'),
    PotTallTapered: assets('PotTallTapered'),
    PotHourglass: assets('PotHourglass'),
    PotStraightShortTub: assets('PotStraightShortTub'),
    PotNarrowFootBowl: assets('PotNarrowFootBowl'),
    PotSquatRidged: assets('PotSquatRidged'),
    PotTallSlenderCone: assets('PotTallSlenderCone'),
    PotWideLippedCup: assets('PotWideLippedCup'),
    MulchHey: assets('MulchHey'),
    MulchCoconut: assets('MulchCoconut'),
    MulchWood: assets('MulchWood'),
    Stick: assets('Stick'),
    Seed: assets('Seed'),
};

export type GardenSceneFaunaFamily =
    | 'fauna:bats'
    | 'fauna:bees'
    | 'fauna:birds'
    | 'fauna:butterflies'
    | 'fauna:cats'
    | 'fauna:chickens'
    | 'fauna:cows'
    | 'fauna:dogs'
    | 'fauna:frogs'
    | 'fauna:goats'
    | 'fauna:horses'
    | 'fauna:ladybugs'
    | 'fauna:piglets'
    | 'fauna:rabbits'
    | 'fauna:sheep'
    | 'fauna:slugs'
    | 'fauna:squirrels';

type FaunaFamilyRequirement = {
    readonly family: GardenSceneFaunaFamily;
    readonly asset: GameAssetName;
    /** Blocks whose presence lets the family's habitat resolver spawn actors. */
    readonly habitats: readonly EntityName[];
};

const treeHabitats = ['Tree', 'Pine', 'PineAdvent'] satisfies EntityName[];

/**
 * Specialized fauna renderers already return before fetching when their
 * habitat resolver finds nothing. The manifest mirrors those habitat blocks so
 * idle prefetch never decodes a family the garden cannot spawn.
 */
export const faunaFamilyRequirements: readonly FaunaFamilyRequirement[] = [
    {
        family: 'fauna:birds',
        asset: 'BirdSmall',
        habitats: [...treeHabitats, 'BirdHouse'],
    },
    {
        family: 'fauna:squirrels',
        asset: 'Squirrel',
        habitats: [
            ...treeHabitats,
            'DeadTreeTall',
            'DeadTreeStump',
            'PalmTree',
            'Bush',
            'BirdHouse',
        ],
    },
    {
        family: 'fauna:frogs',
        asset: 'Frog',
        habitats: [
            'Block_Swamp_Water',
            'Block_Swamp_Ground',
            'Block_Swamp_Ground_Angle',
        ],
    },
    {
        family: 'fauna:bats',
        asset: 'Bat',
        habitats: [...treeHabitats, 'DeadTreeTall', 'Bush'],
    },
    {
        family: 'fauna:bees',
        asset: 'Bee',
        habitats: ['Raised_Bed', 'Tulip', 'Sunflower'],
    },
    {
        family: 'fauna:ladybugs',
        asset: 'Ladybug',
        habitats: ['Raised_Bed', 'Tulip'],
    },
    {
        family: 'fauna:slugs',
        asset: 'Slug',
        habitats: ['Raised_Bed', 'Bush', 'Tulip', ...treeHabitats],
    },
    {
        family: 'fauna:butterflies',
        asset: 'Butterfly',
        habitats: ['Raised_Bed', 'Tulip', 'Block_Grass', 'Block_Grass_Angle'],
    },
    {
        family: 'fauna:cats',
        asset: 'Cat',
        habitats: ['CatPillow', 'Cat_Pillow'],
    },
    { family: 'fauna:dogs', asset: 'Dog', habitats: ['DogHouse'] },
    { family: 'fauna:chickens', asset: 'Chicken', habitats: ['ChickenCoop'] },
    { family: 'fauna:piglets', asset: 'Piglet', habitats: ['PigletPen'] },
    {
        family: 'fauna:goats',
        asset: 'Goat',
        habitats: ['Goat', 'GoatShelter'],
    },
    {
        family: 'fauna:sheep',
        asset: 'Sheep',
        habitats: ['Sheep', 'SheepFold'],
    },
    { family: 'fauna:rabbits', asset: 'Rabbit', habitats: ['RabbitHutch'] },
    { family: 'fauna:horses', asset: 'Horse', habitats: ['HorseStable'] },
    { family: 'fauna:cows', asset: 'Cow', habitats: ['CowShelter'] },
];

export type GardenSceneManifestAsset = {
    readonly name: GameAssetName;
    readonly priority: GardenSceneAssetPriority;
};

export type GardenSceneManifest = {
    readonly version: typeof gardenSceneManifestVersion;
    /** Stable content key; equal keys describe identical load work. */
    readonly key: string;
    readonly gardenId: number | null;
    /** Sorted by priority, then name, without duplicates. */
    readonly assets: readonly GardenSceneManifestAsset[];
    readonly families: readonly GardenSceneFaunaFamily[];
    readonly shaderVariants: readonly GardenSceneShaderVariant[];
    /** Block names with no renderer; useful for drift diagnostics. */
    readonly unknownBlockNames: readonly string[];
};

function isEntityName(name: string): name is EntityName {
    return Object.hasOwn(blockAssetRequirements, name);
}

export function collectGardenBlockNames(
    stacks:
        | readonly { readonly blocks: readonly { readonly name: string }[] }[]
        | undefined,
) {
    const names = new Set<string>();
    for (const stack of stacks ?? []) {
        for (const block of stack.blocks) {
            names.add(block.name);
        }
    }
    return names;
}

const priorityRank: Record<GardenSceneAssetPriority, number> = {
    current: 0,
    'transition-next': 1,
    idle: 2,
};

export function compareGardenSceneAssetPriority(
    left: GardenSceneAssetPriority,
    right: GardenSceneAssetPriority,
) {
    return priorityRank[left] - priorityRank[right];
}

/**
 * Pure manifest builder. `priority` is the priority of required assets; idle
 * assets (optional states, fauna) are always demoted to `idle`.
 */
export function createGardenSceneManifest({
    blockNames,
    details = true,
    gardenId = null,
    priority = 'current',
}: {
    blockNames: Iterable<string>;
    /** Matches the scene's `renderDetails && zoom !== 'far'` fauna gate. */
    details?: boolean;
    gardenId?: number | null;
    priority?: Exclude<GardenSceneAssetPriority, 'idle'>;
}): GardenSceneManifest {
    const assetPriorities = new Map<GameAssetName, GardenSceneAssetPriority>();
    const shaderVariants = new Set<GardenSceneShaderVariant>();
    const unknownBlockNames = new Set<string>();
    const present = new Set<string>();
    const addAsset = (
        name: GameAssetName,
        assetPriority: GardenSceneAssetPriority,
    ) => {
        const existing = assetPriorities.get(name);
        if (
            !existing ||
            compareGardenSceneAssetPriority(assetPriority, existing) < 0
        ) {
            assetPriorities.set(name, assetPriority);
        }
    };

    for (const name of blockNames) {
        present.add(name);
        if (!isEntityName(name)) {
            unknownBlockNames.add(name);
            continue;
        }
        const requirement = blockAssetRequirements[name];
        for (const asset of requirement.assets) addAsset(asset, priority);
        for (const asset of requirement.optionalAssets ?? [])
            addAsset(asset, 'idle');
        for (const variant of requirement.shaderVariants ?? [])
            shaderVariants.add(variant);
    }

    const families: GardenSceneFaunaFamily[] = [];
    if (details) {
        for (const requirement of faunaFamilyRequirements) {
            if (requirement.habitats.some((name) => present.has(name))) {
                families.push(requirement.family);
                addAsset(requirement.asset, 'idle');
            }
        }
    }

    const sortedAssets = [...assetPriorities]
        .map(([name, assetPriority]) => ({ name, priority: assetPriority }))
        .sort(
            (left, right) =>
                compareGardenSceneAssetPriority(
                    left.priority,
                    right.priority,
                ) || left.name.localeCompare(right.name),
        );
    const sortedFamilies = families.sort();
    const sortedShaderVariants = [...shaderVariants].sort();
    const key = [
        `v${gardenSceneManifestVersion}`,
        sortedAssets
            .map((asset) => `${asset.priority[0]}:${asset.name}`)
            .join(','),
        sortedFamilies.join(','),
        sortedShaderVariants.join(','),
    ].join('|');

    return {
        version: gardenSceneManifestVersion,
        key,
        gardenId,
        assets: sortedAssets,
        families: sortedFamilies,
        shaderVariants: sortedShaderVariants,
        unknownBlockNames: [...unknownBlockNames].sort(),
    };
}

export type GardenSceneLoadPlanEntry = GardenSceneManifestAsset & {
    /** Needed by the displayed or the incoming garden; never evicted. */
    readonly pinned: boolean;
};

/**
 * Merges the displayed and incoming manifests into one ordered load plan.
 * Anything either scene requires is pinned so a seamless swap never evicts
 * an asset the other side still needs.
 */
export function mergeGardenSceneLoadPlan(
    current: GardenSceneManifest | null,
    next: GardenSceneManifest | null,
): GardenSceneLoadPlanEntry[] {
    const plan = new Map<GameAssetName, GardenSceneLoadPlanEntry>();
    const add = (
        asset: GardenSceneManifestAsset,
        priority: GardenSceneAssetPriority,
    ) => {
        const existing = plan.get(asset.name);
        const pinned = asset.priority !== 'idle';
        if (
            !existing ||
            compareGardenSceneAssetPriority(priority, existing.priority) < 0
        ) {
            plan.set(asset.name, {
                name: asset.name,
                priority,
                pinned: pinned || Boolean(existing?.pinned),
            });
        } else if (pinned && !existing.pinned) {
            plan.set(asset.name, { ...existing, pinned });
        }
    };

    for (const asset of current?.assets ?? []) add(asset, asset.priority);
    for (const asset of next?.assets ?? [])
        add(asset, asset.priority === 'idle' ? 'idle' : 'transition-next');

    return [...plan.values()].sort(
        (left, right) =>
            compareGardenSceneAssetPriority(left.priority, right.priority) ||
            left.name.localeCompare(right.name),
    );
}

export function mergeGardenSceneShaderVariants(
    ...manifests: (GardenSceneManifest | null)[]
) {
    const variants = new Set<GardenSceneShaderVariant>();
    for (const manifest of manifests)
        for (const variant of manifest?.shaderVariants ?? [])
            variants.add(variant);
    return variants;
}
