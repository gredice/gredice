import type { BlockData } from '@gredice/client';
import { isWaterOrSwampBlockName } from '@gredice/js/gardenBlocks';
import type { getAutumnTreeCanopyStage } from '../../scene/autumnCanopy';
import { contactShadowSnowCrest } from '../../scene/contactShadowStyle';
import { snowPresets } from '../../snow/snowPresets';

/**
 * One soft blob under a standing object, in the object's local frame before
 * its quarter-turn rotation. `halfWidth` runs along local X and `halfDepth`
 * along local Z. The blob is fully dark inside this core and fades out over
 * `spread` units beyond it.
 */
export type StaticContactShadowPart = {
    halfWidth: number;
    halfDepth: number;
    offsetX?: number;
    offsetZ?: number;
    /** Corner radius of the core. Equal to the smaller half extent = round. */
    radius?: number;
    spread?: number;
    /** 0..1, multiplies the tier strength. */
    strength?: number;
    /**
     * The pool under a deciduous crown or bush mound: it fades as the canopy
     * thins in autumn and stays faint under the sparse winter crown
     * (`canopy`, `getAutumnCanopyStage`). The round Tree's crown is gone in
     * winter (`tree`, `getAutumnTreeCanopyStage`), so its pool goes too.
     */
    foliage?: 'canopy' | 'tree';
};

export type StaticContactShadowProfile = readonly StaticContactShadowPart[];

function round(
    halfWidth: number,
    halfDepth = halfWidth,
    extra: Omit<StaticContactShadowPart, 'halfWidth' | 'halfDepth'> = {},
): StaticContactShadowPart {
    return {
        halfDepth,
        halfWidth,
        radius: Math.min(halfWidth, halfDepth),
        ...extra,
    };
}

function box(
    halfWidth: number,
    halfDepth = halfWidth,
    extra: Omit<StaticContactShadowPart, 'halfWidth' | 'halfDepth'> = {},
): StaticContactShadowPart {
    return {
        halfDepth,
        halfWidth,
        radius: Math.min(0.1, halfWidth, halfDepth),
        ...extra,
    };
}

/** Tree-like objects: a tight contact under the trunk, a faint pool under the crown. */
function trunkAndCrown(
    trunk: number,
    crown: number,
    crownStrength: number,
    {
        deciduous = false,
        bareInWinter = false,
    }: { deciduous?: boolean; bareInWinter?: boolean } = {},
): StaticContactShadowProfile {
    return [
        round(trunk, trunk, { spread: Math.max(0.14, trunk * 1.4) }),
        round(crown, crown, {
            foliage: deciduous ? (bareInWinter ? 'tree' : 'canopy') : undefined,
            spread: crown,
            strength: crownStrength,
        }),
    ];
}

/**
 * How much of a crown pool stays with each canopy stage of
 * `getAutumnCanopyStage`: the sparse winter crown is a few leaves on bare
 * branches, so only a trace of the pool is left. A bare winter Tree has no
 * crown at all, so only its trunk contact stays.
 */
export const staticContactShadowFoliageScale = {
    full: 1,
    sparse: 0.15,
    thinning: 0.55,
    bare: 0,
} as const satisfies Record<
    ReturnType<typeof getAutumnTreeCanopyStage>,
    number
>;

const pot = (halfExtent: number) => [round(halfExtent)];

/**
 * Hand-measured from the exported models and the scale each entity applies,
 * so the blob matches the lower body rather than the full 1x1 hitbox.
 */
const staticContactShadowProfiles: Readonly<
    Record<string, StaticContactShadowProfile>
> = {
    ArrowSign: [round(0.13, 0.08, { spread: 0.1 })],
    AutumnAsterPot: [round(0.27)],
    AutumnBlanketBench: [box(0.5, 0.18)],
    AutumnGarland: [box(0.4, 0.1, { strength: 0.75 })],
    AutumnSeedHeads: [round(0.26, 0.26, { strength: 0.6 })],
    AutumnShrub: [round(0.34, 0.34, { spread: 0.16 })],
    AutumnWreathPost: [round(0.15)],
    BaleHey: [box(0.19, 0.37)],
    BeachChair: [box(0.28, 0.4, { strength: 0.75 })],
    BeachUmbrella: [
        round(0.07, 0.07, { spread: 0.12 }),
        round(0.34, 0.34, { spread: 0.3, strength: 0.35 }),
    ],
    BirdFeeder: [round(0.22, 0.22, { strength: 0.8 })],
    BirdHouse: [round(0.24, 0.24, { strength: 0.85 })],
    Bucket: [round(0.24)],
    // The bare winter bush (`Bush_AutumnSparse` and its branches) is about
    // 0.4 across, so a tight contact stays all year and the pool under the
    // full mound fades with the canopy like a crown pool.
    Bush: [
        round(0.2, 0.2, { spread: 0.14 }),
        round(0.36, 0.36, { foliage: 'canopy', spread: 0.22 }),
    ],
    CactusBarrel: [round(0.33, 0.33, { spread: 0.14 })],
    CactusColumnCluster: [round(0.3, 0.26, { spread: 0.14 })],
    CactusPricklyPear: [round(0.2, 0.14)],
    CatPillow: [round(0.42, 0.3)],
    ChestnutRoastingCart: [box(0.7, 0.34, { strength: 0.85 })],
    ChickenCoop: [box(0.38, 0.46, { offsetZ: -0.14 })],
    Composter: [box(0.38)],
    CowShelter: [box(0.88, 0.78, { offsetZ: 0.04 })],
    DeadTreeStump: [round(0.22, 0.22, { spread: 0.15 })],
    DeadTreeTall: [round(0.2, 0.2, { spread: 0.2 })],
    DesertStoneLarge: [round(0.34, 0.22, { spread: 0.16 })],
    DesertStoneMedium: [round(0.3, 0.2, { spread: 0.13 })],
    DesertStoneSmall: [round(0.19, 0.14, { spread: 0.1 })],
    DogHouse: [box(0.36, 0.37, { offsetX: 0.1, offsetZ: -0.06 })],
    DoubleGardenLightPole: [round(0.17)],
    EnamelGardenLamp: [round(0.13, 0.13, { offsetX: -0.08 })],
    FallenLog: [box(0.88, 0.22, { radius: 0.22 })],
    FireflyJar: [round(0.13)],
    FriendlyGhost: [round(0.22, 0.22, { strength: 0.85 })],
    GardenBox: [box(0.45, 0.36)],
    GardenBrazier: [round(0.28, 0.24)],
    GardenScarecrow: [round(0.14, 0.1)],
    GardenTeaTable: [round(0.38, 0.32, { strength: 0.85 })],
    GiftBox: [box(0.27)],
    GoatShelter: [box(0.43, 0.42)],
    HarvestCrate: [box(0.4, 0.34)],
    HarvestPumpkinGourd: [round(0.2)],
    HarvestPumpkinGroup: [round(0.37, 0.38)],
    HarvestPumpkinSquat: [round(0.31)],
    HarvestWheelbarrow: [box(0.82, 0.3, { strength: 0.85 })],
    HazelLightArch: [
        round(0.08, 0.08, { offsetZ: -0.43, spread: 0.12 }),
        round(0.08, 0.08, { offsetZ: 0.43, spread: 0.12 }),
    ],
    HedgehogShelter: [round(0.38, 0.35)],
    HorseStable: [box(0.86, 0.8, { offsetZ: 0.05 })],
    IceCreamCart: [box(1.15, 0.58, { strength: 0.85 })],
    InflatablePoolSmall: [round(0.52, 0.52, { spread: 0.12 })],
    LeafRake: [round(0.2, 0.2, { strength: 0.7 })],
    LemonadeStand: [box(1.15, 0.58, { strength: 0.85 })],
    LiquidPreparationBottle: [round(0.18)],
    MoonRainBarrel: [round(0.3)],
    OutletDisplayTable: [box(0.42, 0.35, { strength: 0.7 })],
    PaintRoller: [round(0.16, 0.1, { offsetX: 0.04 })],
    PalmTree: trunkAndCrown(0.09, 0.34, 0.45),
    PigletPen: [box(0.43, 0.42, { strength: 0.6 })],
    Pine: [round(0.38, 0.38, { spread: 0.26, strength: 0.9 })],
    PineAdvent: [round(0.38, 0.38, { spread: 0.26, strength: 0.9 })],
    PotBulbousNeck: pot(0.23),
    PotHourglass: pot(0.18),
    PotLowBowl: pot(0.24),
    PotNarrowFootBowl: pot(0.2),
    PotRoundedBowl: pot(0.2),
    PotSquatRidged: pot(0.22),
    PotStraightShortTub: pot(0.19),
    PotTallSlenderCone: pot(0.16),
    PotTallTapered: pot(0.18),
    PotWideLippedCup: pot(0.2),
    PumpkinLantern: [round(0.31)],
    RabbitHutch: [box(0.42, 0.46, { offsetZ: -0.08 })],
    RoofTileLantern: [round(0.2)],
    Rose: [round(0.2)],
    SandcastleSmallA: [round(0.22, 0.12)],
    SeasonalMaple: trunkAndCrown(0.12, 0.32, 0.5, { deciduous: true }),
    SeedDryingRack: [box(0.4, 0.28, { strength: 0.65 })],
    SheepFold: [box(0.82, 0.72, { offsetZ: 0.04 })],
    ShovelSmall: [round(0.1, 0.07, { spread: 0.08 })],
    SmallWoodenBridge: [box(0.4, 0.48, { strength: 0.7 })],
    Snowman: [round(0.22)],
    StackedFirewood: [box(0.36, 0.33)],
    StoneLarge: [round(0.33, 0.34, { spread: 0.16 })],
    StoneMedium: [round(0.31, 0.3, { spread: 0.13 })],
    StoneSmall: [round(0.2, 0.21, { spread: 0.1 })],
    Stool: [round(0.28, 0.28, { strength: 0.85 })],
    SummerHat: [round(0.38, 0.3, { spread: 0.08, strength: 0.7 })],
    Sunflower: [round(0.12, 0.12, { spread: 0.14 })],
    SupportedCobweb: [round(0.22, 0.22, { strength: 0.55 })],
    Tree: trunkAndCrown(0.13, 0.4, 0.55, {
        deciduous: true,
        bareInWinter: true,
    }),
    Tulip: [round(0.14, 0.14, { spread: 0.12, strength: 0.8 })],
    WateringCan: [round(0.24, 0.19, { offsetX: 0.03 })],
    WaterWell: [box(0.55, 0.43, { radius: 0.3 })],
    WickerGardenLantern: [round(0.22)],
    WoodenBench: [box(0.5, 0.15, { strength: 0.8 })],
    WoodenHandLantern: [round(0.16)],
    WoodenSign: [round(0.13, 0.08, { spread: 0.1 })],
    WoodlandMushroomBasket: [round(0.3)],
    WoodlandMushrooms: [round(0.3, 0.3, { strength: 0.7 })],
};

const profileAliases: ReadonlyArray<readonly [RegExp, string]> = [
    [/^ArrowSign/, 'ArrowSign'],
    [/^AutumnAsterPot/, 'AutumnAsterPot'],
    [/^Cat_Pillow$/, 'CatPillow'],
    [/^GiftBox_/, 'GiftBox'],
    [/^HarvestCrate/, 'HarvestCrate'],
    [/^HarvestPumpkinGourd/, 'HarvestPumpkinGourd'],
    [/^HarvestPumpkinGroup/, 'HarvestPumpkinGroup'],
    [/^HarvestPumpkinSquat/, 'HarvestPumpkinSquat'],
    [/^LiquidPreparationBottle/, 'LiquidPreparationBottle'],
    [/^PumpkinLantern/, 'PumpkinLantern'],
];

/** Flat ground cover lies on the floor and gets no blob of its own. */
const groundCoverBlockNames: ReadonlySet<string> = new Set([
    'AutumnGrassTuft',
    'AutumnLeafPileCrescent',
    'AutumnLeafPileMound',
    'BeachTowelStriped',
    'MulchCoconut',
    'MulchHey',
    'MulchWood',
    'StoneWalkway',
    'WoodenWalkway',
    'WoodlandAcorns',
    'WoodlandConkers',
]);

/** Surfaces another block can stand on, besides flat terrain. */
const walkableCoverBlockNames: ReadonlySet<string> = new Set([
    'MulchCoconut',
    'MulchHey',
    'MulchWood',
    'StoneWalkway',
    'WoodenWalkway',
]);

/**
 * Moving actors and their placement blocks already get a blob from
 * `ActorGroundingShadows`; bed internals belong to the raised bed.
 */
const actorOrInternalBlockNames: ReadonlySet<string> = new Set([
    'BeachBall',
    'Cow',
    'FishingBoat',
    'Goat',
    'Horse',
    'Rabbit',
    'Seed',
    'Sheep',
    'Stick',
]);

export const raisedBedContactShadowName = 'Raised_Bed';

/**
 * The lattice shade is a panel about 0.94 long and 0.14 thick at its feet that
 * joins its neighbours like a fence. Light passes through the lattice.
 */
export const shadeContactShadowName = 'Shade';
export const shadeContactShadowStyle = {
    arm: 0.07,
    panelHalfLength: 0.47,
    strength: 0.6,
} as const;

/**
 * Half thickness of a fence's post and of the run between posts. Timber and
 * picket rails stand clear of the ground, so their run is lighter than the
 * post; stone walls reach the ground along their whole length.
 */
export const fenceContactShadowStyles = {
    Fence: { arm: 0.1, armStrength: 0.65, post: 0.11 },
    PolishedStoneFence: { arm: 0.14, armStrength: 1, post: 0.15 },
    StoneFence: { arm: 0.16, armStrength: 1, post: 0.17 },
    WhiteFence: { arm: 0.07, armStrength: 0.65, post: 0.08 },
} as const satisfies Record<
    string,
    { arm: number; armStrength: number; post: number }
>;

export const fenceGateContactShadowStyles = {
    AutumnFenceGate: { halfThickness: 0.1, strength: 0.65 },
    FenceGate: { halfThickness: 0.1, strength: 0.65 },
    PolishedStoneFenceGate: { halfThickness: 0.14, strength: 1 },
    StoneFenceGate: { halfThickness: 0.15, strength: 1 },
    WhiteFenceGate: { halfThickness: 0.07, strength: 0.65 },
} as const satisfies Record<
    string,
    { halfThickness: number; strength: number }
>;

export function isTerrainBlockName(name: string) {
    return name.startsWith('Block_');
}

export function isFlatTerrainSurfaceBlockName(name: string) {
    return (
        isTerrainBlockName(name) &&
        !isWaterOrSwampBlockName(name) &&
        !name.includes('_Stairs') &&
        !name.endsWith('_Angle') &&
        !name.endsWith('_Corner')
    );
}

export function isSlopedTerrainBlockName(name: string) {
    return (
        isTerrainBlockName(name) &&
        !isWaterOrSwampBlockName(name) &&
        !isFlatTerrainSurfaceBlockName(name)
    );
}

export function isWalkableCoverBlockName(name: string) {
    return walkableCoverBlockNames.has(name);
}

/**
 * Snow that settles on a surface a blob lies on, as its renderer configures
 * the snow overlay: the overlay sits `lift` above the surface and grows to
 * `maxThickness` (before noise) at a coverage of 1 / `coverageMultiplier`.
 * Its drifts reach at most `crest` times `maxThickness`.
 */
export type ContactShadowReceiverSnow = {
    coverageMultiplier: number;
    crest: number;
    lift: number;
    maxThickness: number;
};

export const noContactShadowReceiverSnow: ContactShadowReceiverSnow = {
    coverageMultiplier: 1,
    crest: contactShadowSnowCrest,
    lift: 0,
    maxThickness: 0,
};

/**
 * The flat terrain cubes (`Block_Grass_1_2`, and `Block_Sand_1` for sand, dry
 * ground and snow) sample the overlay noise in block-local space at a
 * `noiseScale` of 0.2. Over a whole cube that stays close to the noise lattice
 * point at the local origin, whose value is -1, so the snow on these tops is
 * 0.65 to 0.69 of `maxThickness` everywhere (see the unit test). Rising to the
 * default crest would float a blob about 0.07 above full grass snow and
 * darken the bottom of whatever stands in it.
 */
export const contactShadowCubeSnowCrest = 0.8;

function receiverSnow(
    preset: { coverageMultiplier?: number; maxThickness: number },
    lift: number,
    crest: number = contactShadowSnowCrest,
): ContactShadowReceiverSnow {
    return {
        coverageMultiplier: preset.coverageMultiplier ?? 1,
        crest,
        lift,
        maxThickness: preset.maxThickness,
    };
}

/**
 * Mirrors the `snow` and `snowLift` each flat surface renderer passes in
 * `EntityInstances`, `AdditionalEntityInstances` (`Block_Ground` sets its own
 * 0.22), `BlockSnowFalling`, `StoneWalkway`, `WoodenWalkway` and
 * `MulchPatch`. A zero lift there becomes 0.003.
 */
const contactShadowReceiverSnowByName: Readonly<
    Record<string, ContactShadowReceiverSnow>
> = {
    Block_Dry_Ground: receiverSnow(
        snowPresets.sand,
        0.003,
        contactShadowCubeSnowCrest,
    ),
    Block_Grass: receiverSnow(
        snowPresets.grassFlat,
        0.01,
        contactShadowCubeSnowCrest,
    ),
    Block_Gravel: receiverSnow(snowPresets.stone, 0.002),
    Block_Ground: receiverSnow({ maxThickness: 0.22 }, 0.003),
    Block_Polished_Stone: receiverSnow(snowPresets.stone, 0.002),
    Block_Sand: receiverSnow(
        snowPresets.sand,
        0.003,
        contactShadowCubeSnowCrest,
    ),
    Block_Snow: receiverSnow(
        snowPresets.snow,
        0.003,
        contactShadowCubeSnowCrest,
    ),
    Block_Snow_Falling: receiverSnow(
        snowPresets.snow,
        0.003,
        contactShadowCubeSnowCrest,
    ),
    Block_Stone: receiverSnow(snowPresets.stone, 0.002),
    MulchCoconut: receiverSnow(snowPresets.mulch, 0.002),
    MulchHey: receiverSnow(snowPresets.mulch, 0.002),
    MulchWood: receiverSnow(snowPresets.mulch, 0.002),
    StoneWalkway: receiverSnow(snowPresets.stone, 0.003),
    WoodenWalkway: receiverSnow({ maxThickness: 0.018 }, 0.003),
};

/** The snow a blob lying on `name` has to rise above. */
export function getContactShadowReceiverSnow(name: string) {
    return contactShadowReceiverSnowByName[name] ?? noContactShadowReceiverSnow;
}

/**
 * Where walkable cover draws its top above its own base, where that is higher
 * than its block height. A mulch patch is 0.026 tall
 * (`createMulchPatchGeometry`) on a 0.01 block, so a blob at the block height
 * would be buried in it. Walkways draw their top at or below their 0.1 block
 * height (`walkwayPlacement`), and objects on them stand at the block height,
 * so their blobs stay there.
 */
const contactShadowReceiverVisualTops: Readonly<Record<string, number>> = {
    MulchCoconut: 0.026,
    MulchHey: 0.026,
    MulchWood: 0.026,
};

/** Height of the drawn top of `name` above its base, if it has its own. */
export function getContactShadowReceiverVisualTop(name: string) {
    return contactShadowReceiverVisualTops[name] ?? 0;
}

/** True when this block never gets a static contact shadow. */
export function isStaticContactShadowExcludedName(name: string) {
    return (
        isTerrainBlockName(name) ||
        groundCoverBlockNames.has(name) ||
        actorOrInternalBlockNames.has(name)
    );
}

function positiveNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : undefined;
}

/**
 * Falls back to an explicit hitbox (shrunk to the lower body) and then to a
 * medium round blob, so a new catalogue entry still stands on the floor.
 */
function resolveFallbackProfile(
    blockData: BlockData | null | undefined,
): StaticContactShadowProfile {
    const width = positiveNumber(blockData?.attributes?.hitboxWidth);
    const depth = positiveNumber(blockData?.attributes?.hitboxDepth);
    if (width !== undefined && depth !== undefined) {
        const halfWidth = Math.max(0.08, width * 0.42);
        const halfDepth = Math.max(0.08, depth * 0.42);
        return [round(halfWidth, halfDepth)];
    }

    return [round(0.28)];
}

/** The hand-measured profile for a block or its colour family, if any. */
export function getMeasuredStaticContactShadowProfile(
    name: string,
): StaticContactShadowProfile | null {
    if (isStaticContactShadowExcludedName(name)) {
        return null;
    }

    const direct = staticContactShadowProfiles[name];
    if (direct) {
        return direct;
    }

    for (const [pattern, alias] of profileAliases) {
        if (pattern.test(name)) {
            const aliased = staticContactShadowProfiles[alias];
            if (aliased) {
                return aliased;
            }
        }
    }

    return null;
}

export function getStaticContactShadowProfile(
    name: string,
    blockData?: BlockData | null,
): StaticContactShadowProfile | null {
    if (isStaticContactShadowExcludedName(name)) {
        return null;
    }

    return (
        getMeasuredStaticContactShadowProfile(name) ??
        resolveFallbackProfile(blockData)
    );
}

export function resolveStaticContactShadowSpread(
    part: StaticContactShadowPart,
) {
    return (
        part.spread ??
        Math.min(
            0.2,
            Math.max(
                0.08,
                0.06 + 0.25 * Math.max(part.halfWidth, part.halfDepth),
            ),
        )
    );
}
