import type { PlantDefinition } from '../plant-definition-types';
import { createDevelopmentProgram, createPlant } from './helpers';

const brassicaBase: Pick<
    PlantDefinition,
    'flower' | 'height' | 'leaf' | 'stem'
> = {
    height: 0.68,
    stem: {
        color: '#62853a',
        radius: 0.03,
        radiusDecay: 0.6,
        minRadius: 0.003,
    },
    leaf: {
        color: '#6d983e',
        size: 0.24,
        type: 'lobed',
    },
    flower: {
        enabled: false,
        color: '#ffffff',
        size: 0,
    },
};

export const brassicaPlants = {
    broccoli: createPlant('broccoli', {
        ...brassicaBase,
        name: 'Brokula',
        development: createDevelopmentProgram('upright', {
            axes: {
                branchCount: 0,
                nodeCount: 7,
                spread: 0.12,
            },
            foliage: {
                count: 14,
                emergenceInterval: 0.55,
                petioleLengthScale: 0.48,
                pitchRangeDegrees: [38, 64],
                sizeRange: [0.68, 1.05],
            },
            phenology: { maturityGeneration: 10.5 },
            storage: {
                aboveSoilFraction: 1,
                birthGeneration: 6,
                matureGeneration: 10.5,
                sizeScale: 1,
            },
            variability: 0.08,
        }),
        vegetable: {
            enabled: true,
            type: 'broccoli',
            baseSize: 0.22,
        },
    }),
    cauliflower: createPlant('cauliflower', {
        ...brassicaBase,
        name: 'Cvjetača',
        development: createDevelopmentProgram('upright', {
            axes: {
                branchCount: 0,
                nodeCount: 6,
                spread: 0.12,
            },
            foliage: {
                count: 14,
                emergenceInterval: 0.55,
                petioleLengthScale: 0.46,
                pitchRangeDegrees: [40, 66],
                sizeRange: [0.7, 1.06],
            },
            phenology: { maturityGeneration: 10.5 },
            storage: {
                aboveSoilFraction: 1,
                birthGeneration: 6,
                matureGeneration: 10.5,
                sizeScale: 1,
            },
            variability: 0.08,
        }),
        leaf: {
            ...brassicaBase.leaf,
            color: '#739943',
            size: 0.25,
        },
        vegetable: {
            enabled: true,
            type: 'cauliflower',
            baseSize: 0.24,
        },
    }),
    kale: createPlant('kale', {
        ...brassicaBase,
        name: 'Kelj',
        development: createDevelopmentProgram('upright', {
            axes: {
                branchCount: 0,
                nodeCount: 9,
                spread: 0.14,
            },
            foliage: {
                count: 18,
                emergenceInterval: 0.44,
                petioleLengthScale: 0.42,
                pitchRangeDegrees: [35, 62],
                sizeRange: [0.64, 1.06],
            },
            phenology: { maturityGeneration: 10.5 },
            variability: 0.1,
        }),
        height: 0.74,
        leaf: {
            ...brassicaBase.leaf,
            type: 'ruffled',
        },
        vegetable: {
            enabled: false,
            type: 'broccoli',
            baseSize: 0.24,
        },
    }),
    kohlrabi: createPlant('kohlrabi', {
        ...brassicaBase,
        name: 'Koraba',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 0.72 },
            foliage: {
                count: 12,
                emergenceInterval: 0.56,
                petioleLengthScale: 0.54,
                pitchRangeDegrees: [34, 62],
                sizeRange: [0.66, 1.04],
            },
            phenology: { maturityGeneration: 10 },
            storage: {
                aboveSoilFraction: 0.78,
                birthGeneration: 4,
                matureGeneration: 10,
                sizeScale: 1,
            },
            variability: 0.08,
        }),
        height: 0.66,
        stem: {
            ...brassicaBase.stem,
            color: '#5f8436',
            radius: 0.02,
            radiusDecay: 0.7,
            minRadius: 0.002,
        },
        leaf: {
            ...brassicaBase.leaf,
            color: '#7ba444',
            size: 0.2,
            type: 'oval',
        },
        vegetable: {
            enabled: true,
            type: 'kohlrabi',
            baseSize: 0.24,
        },
    }),
    cabbage: createPlant('cabbage', {
        ...brassicaBase,
        name: 'Kupus',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 0.98 },
            foliage: {
                count: 16,
                emergenceInterval: 0.44,
                petioleLengthScale: 0.16,
                pitchRangeDegrees: [45, 78],
                sizeRange: [0.62, 1.08],
            },
            phenology: { maturityGeneration: 10 },
            storage: {
                aboveSoilFraction: 0.66,
                birthGeneration: 5,
                matureGeneration: 10,
                sizeScale: 1,
            },
            variability: 0.08,
        }),
        height: 0.46,
        leaf: {
            ...brassicaBase.leaf,
            color: '#84a850',
            size: 0.28,
            type: 'round',
        },
        vegetable: {
            enabled: true,
            type: 'cabbage',
            baseSize: 0.3,
        },
    }),
    collard: createPlant('collard', {
        ...brassicaBase,
        name: 'Raštika',
        development: createDevelopmentProgram('upright', {
            axes: {
                branchCount: 0,
                nodeCount: 9,
                spread: 0.16,
            },
            foliage: {
                count: 18,
                emergenceInterval: 0.44,
                petioleLengthScale: 0.48,
                pitchRangeDegrees: [34, 62],
                sizeRange: [0.66, 1.06],
            },
            phenology: { maturityGeneration: 10.5 },
            variability: 0.09,
        }),
        height: 0.78,
        leaf: {
            ...brassicaBase.leaf,
            color: '#67883d',
            size: 0.27,
            type: 'lobed',
        },
        vegetable: {
            enabled: false,
            type: 'broccoli',
            baseSize: 0.24,
        },
    }),
};
