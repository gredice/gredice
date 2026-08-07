import {
    defaultThornDefinition,
    type PlantArchitecture,
    type PlantDefinition,
    type PlantDevelopmentAxes,
    type PlantDevelopmentFoliage,
    type PlantDevelopmentPhenology,
    type PlantDevelopmentProgram,
    type PlantDevelopmentReproduction,
    type PlantDevelopmentSpecial,
    type PlantDevelopmentStorage,
} from '../plant-definition-types';

const HEIGHT_SCALE = 0.88;
const STEM_RADIUS_SCALE = 0.82;
const LEAF_SIZE_SCALE = 0.82;
const FLOWER_SIZE_SCALE = 0.84;
const PRODUCE_SIZE_SCALE = 0.82;
const STEM_MIN_RADIUS_SCALE = 0.82;
const THORN_SIZE_SCALE = 0.82;

function round(value: number) {
    return Math.round(value * 1000) / 1000;
}

interface PlantDevelopmentOverrides {
    axes?: Partial<PlantDevelopmentAxes>;
    foliage?: Partial<PlantDevelopmentFoliage>;
    phenology?: Partial<PlantDevelopmentPhenology>;
    reproduction?: Partial<PlantDevelopmentReproduction>;
    special?: PlantDevelopmentSpecial;
    storage?: PlantDevelopmentStorage;
    variability?: number;
}

const architectureDefaults: Record<
    PlantArchitecture,
    Omit<PlantDevelopmentProgram, 'architecture'>
> = {
    rosette: {
        axes: {
            axisCount: 0,
            branchCount: 0,
            branchLengthScale: 0,
            branchNodeCount: 0,
            branchPitchDegrees: 0,
            branchingPattern: 'none',
            habit: 'basal',
            internodeLengthScale: 0,
            nodeCount: 0,
            pitchDegrees: 0,
            spread: 1,
        },
        foliage: {
            arrangement: 'rosette',
            count: 16,
            emergenceInterval: 0.5,
            maturityDuration: 2.2,
            petioleLengthScale: 0.18,
            phyllotaxisDegrees: 137.5,
            pitchRangeDegrees: [38, 76],
            sizeRange: [0.68, 1.04],
        },
        phenology: { emergenceStart: 0.35, maturityGeneration: 10.5 },
        reproduction: {
            flowerStart: 8,
            flowersPerSite: 1,
            form: 'cluster',
            produceCount: 0,
            site: 'terminal',
            siteCount: 0,
        },
        variability: 0.1,
    },
    clump: {
        axes: {
            axisCount: 0,
            branchCount: 0,
            branchLengthScale: 0,
            branchNodeCount: 0,
            branchPitchDegrees: 0,
            branchingPattern: 'none',
            habit: 'basal',
            internodeLengthScale: 0,
            nodeCount: 0,
            pitchDegrees: 0,
            spread: 0.85,
        },
        foliage: {
            arrangement: 'fan',
            count: 28,
            emergenceInterval: 0.28,
            maturityDuration: 2,
            petioleLengthScale: 0,
            phyllotaxisDegrees: 137.5,
            pitchRangeDegrees: [8, 24],
            sizeRange: [0.72, 1.08],
        },
        phenology: { emergenceStart: 0.3, maturityGeneration: 9.5 },
        reproduction: {
            flowerStart: 8,
            flowersPerSite: 1,
            form: 'spike',
            produceCount: 0,
            site: 'spike',
            siteCount: 0,
        },
        variability: 0.09,
    },
    upright: {
        axes: {
            axisCount: 1,
            branchCount: 3,
            branchLengthScale: 0.48,
            branchNodeCount: 2,
            branchPitchDegrees: 46,
            branchingPattern: 'alternate',
            habit: 'upright',
            internodeLengthScale: 1,
            nodeCount: 9,
            pitchDegrees: 2,
            spread: 0.18,
        },
        foliage: {
            arrangement: 'alternate',
            count: 14,
            emergenceInterval: 0.62,
            maturityDuration: 1.8,
            petioleLengthScale: 0.48,
            phyllotaxisDegrees: 137.5,
            pitchRangeDegrees: [36, 66],
            sizeRange: [0.7, 1.05],
        },
        phenology: { emergenceStart: 0.45, maturityGeneration: 10.5 },
        reproduction: {
            flowerStart: 6.5,
            flowersPerSite: 1,
            form: 'star',
            fruitStart: 8.5,
            produceCount: 0,
            site: 'axillary',
            siteCount: 0,
        },
        variability: 0.1,
    },
    vine: {
        axes: {
            axisCount: 1,
            branchCount: 4,
            branchLengthScale: 0.42,
            branchNodeCount: 2,
            branchPitchDegrees: 18,
            branchingPattern: 'sympodial',
            habit: 'prostrate',
            internodeLengthScale: 1,
            nodeCount: 11,
            pitchDegrees: 5,
            spread: 0.54,
        },
        foliage: {
            arrangement: 'alternate',
            count: 14,
            emergenceInterval: 0.55,
            maturityDuration: 1.65,
            petioleLengthScale: 0.52,
            phyllotaxisDegrees: 137.5,
            pitchRangeDegrees: [38, 62],
            sizeRange: [0.7, 1.08],
        },
        phenology: { emergenceStart: 0.4, maturityGeneration: 10.5 },
        reproduction: {
            flowerStart: 6,
            flowersPerSite: 1,
            form: 'star',
            fruitStart: 8,
            produceCount: 0,
            site: 'axillary',
            siteCount: 0,
        },
        special: { tendrilCount: 8 },
        variability: 0.12,
    },
    shrub: {
        axes: {
            axisCount: 3,
            branchCount: 5,
            branchLengthScale: 0.42,
            branchNodeCount: 2,
            branchPitchDegrees: 42,
            branchingPattern: 'multi-stem',
            habit: 'woody',
            internodeLengthScale: 1,
            nodeCount: 6,
            pitchDegrees: 5,
            spread: 0.32,
        },
        foliage: {
            arrangement: 'alternate',
            count: 32,
            emergenceInterval: 0.25,
            maturityDuration: 1.8,
            petioleLengthScale: 0.32,
            phyllotaxisDegrees: 137.5,
            pitchRangeDegrees: [32, 62],
            sizeRange: [0.72, 1.04],
        },
        phenology: { emergenceStart: 0.35, maturityGeneration: 10.5 },
        reproduction: {
            flowerStart: 6.5,
            flowersPerSite: 1,
            form: 'cluster',
            fruitStart: 8.5,
            produceCount: 0,
            site: 'axillary',
            siteCount: 0,
        },
        variability: 0.11,
    },
    tree: {
        axes: {
            axisCount: 1,
            branchCount: 6,
            branchLengthScale: 0.58,
            branchNodeCount: 3,
            branchPitchDegrees: 50,
            branchingPattern: 'alternate',
            habit: 'woody',
            internodeLengthScale: 1,
            nodeCount: 5,
            pitchDegrees: 0,
            spread: 0.44,
        },
        foliage: {
            arrangement: 'alternate',
            count: 44,
            emergenceInterval: 0.2,
            maturityDuration: 2,
            petioleLengthScale: 0.24,
            phyllotaxisDegrees: 137.5,
            pitchRangeDegrees: [28, 58],
            sizeRange: [0.72, 1.04],
        },
        phenology: { emergenceStart: 0.35, maturityGeneration: 11 },
        reproduction: {
            flowerStart: 7.5,
            flowersPerSite: 1,
            form: 'cluster',
            produceCount: 0,
            site: 'terminal',
            siteCount: 0,
        },
        variability: 0.09,
    },
};

export function createDevelopmentProgram(
    architecture: PlantArchitecture,
    overrides: PlantDevelopmentOverrides = {},
): PlantDevelopmentProgram {
    const defaults = architectureDefaults[architecture];

    return {
        architecture,
        axes: { ...defaults.axes, ...overrides.axes },
        foliage: { ...defaults.foliage, ...overrides.foliage },
        phenology: { ...defaults.phenology, ...overrides.phenology },
        reproduction: {
            ...defaults.reproduction,
            ...overrides.reproduction,
        },
        special: overrides.special ?? defaults.special,
        storage: overrides.storage,
        variability: overrides.variability ?? defaults.variability,
    };
}

export function createPlant(
    key: string,
    definition: Omit<PlantDefinition, 'key'>,
): PlantDefinition {
    const thorn = {
        ...defaultThornDefinition,
        ...definition.thorn,
    };

    return {
        ...definition,
        key,
        height: round(definition.height * HEIGHT_SCALE),
        stem: {
            ...definition.stem,
            radius: round(definition.stem.radius * STEM_RADIUS_SCALE),
            minRadius: round(definition.stem.minRadius * STEM_MIN_RADIUS_SCALE),
        },
        leaf: {
            ...definition.leaf,
            size: round(definition.leaf.size * LEAF_SIZE_SCALE),
        },
        flower: {
            ...definition.flower,
            size: round(definition.flower.size * FLOWER_SIZE_SCALE),
        },
        vegetable: {
            ...definition.vegetable,
            baseSize: round(definition.vegetable.baseSize * PRODUCE_SIZE_SCALE),
        },
        thorn: {
            ...thorn,
            size: round(thorn.size * THORN_SIZE_SCALE),
        },
    };
}
