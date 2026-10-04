import type { PlantDefinition } from '../plant-definition-types';
import { createDevelopmentProgram, createPlant } from './helpers';

const rootBase: Pick<PlantDefinition, 'flower' | 'height' | 'leaf' | 'stem'> = {
    height: 0.68,
    stem: {
        color: '#426d1b',
        radius: 0.022,
        radiusDecay: 0.8,
        minRadius: 0.002,
    },
    leaf: {
        color: '#4f8b29',
        size: 0.18,
        type: 'pinnate',
    },
    flower: {
        enabled: false,
        color: '#ffffff',
        size: 0,
    },
};

export const rootPlants = {
    carrot: createPlant('carrot', {
        ...rootBase,
        name: 'Mrkva',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 0.9 },
            foliage: {
                count: 15,
                petioleLengthScale: 0.78,
                pitchRangeDegrees: [38, 74],
                sizeRange: [0.68, 1.12],
            },
            phenology: { maturityGeneration: 10 },
            storage: {
                aboveSoilFraction: 0.2,
                birthGeneration: 1.5,
                matureGeneration: 10,
                sizeScale: 1,
            },
            variability: 0.11,
        }),
        height: 0.82,
        stem: {
            ...rootBase.stem,
            color: '#3f6a1c',
            radius: 0.028,
            minRadius: 0.01,
        },
        leaf: {
            ...rootBase.leaf,
            color: '#4a7d28',
            size: 0.22,
            type: 'feathery',
        },
        vegetable: {
            enabled: true,
            type: 'carrot',
            baseSize: 0.24,
        },
    }),
    beet: createPlant('beet', {
        ...rootBase,
        name: 'Cikla',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 0.86 },
            foliage: {
                count: 12,
                petioleLengthScale: 0.72,
                pitchRangeDegrees: [36, 70],
                sizeRange: [0.7, 1.1],
            },
            phenology: { maturityGeneration: 9.5 },
            storage: {
                aboveSoilFraction: 0.34,
                birthGeneration: 1.25,
                matureGeneration: 9.5,
                sizeScale: 1,
            },
            variability: 0.08,
        }),
        height: 0.68,
        stem: {
            ...rootBase.stem,
            color: '#7d3c47',
            radius: 0.026,
            minRadius: 0.008,
        },
        leaf: {
            ...rootBase.leaf,
            color: '#5b8a34',
            size: 0.24,
            type: 'heart',
        },
        vegetable: {
            enabled: true,
            type: 'beet',
            baseSize: 0.27,
        },
    }),
    radish: createPlant('radish', {
        ...rootBase,
        name: 'Rotkvica',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 0.74 },
            foliage: {
                count: 10,
                emergenceInterval: 0.42,
                petioleLengthScale: 0.58,
                pitchRangeDegrees: [40, 72],
                sizeRange: [0.66, 1.08],
            },
            phenology: { maturityGeneration: 8 },
            storage: {
                aboveSoilFraction: 0.38,
                birthGeneration: 1,
                matureGeneration: 8,
                sizeScale: 1,
            },
            variability: 0.08,
        }),
        height: 0.5,
        stem: {
            ...rootBase.stem,
            color: '#4b6f20',
            radius: 0.02,
            minRadius: 0.007,
        },
        leaf: {
            ...rootBase.leaf,
            size: 0.16,
            type: 'lobed',
        },
        vegetable: {
            enabled: true,
            type: 'radish',
            baseSize: 0.18,
        },
    }),
    turnip: createPlant('turnip', {
        ...rootBase,
        name: 'Repa',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 0.8 },
            foliage: {
                count: 12,
                petioleLengthScale: 0.64,
                pitchRangeDegrees: [38, 70],
                sizeRange: [0.68, 1.08],
            },
            phenology: { maturityGeneration: 9.5 },
            storage: {
                aboveSoilFraction: 0.36,
                birthGeneration: 1.25,
                matureGeneration: 9.5,
                sizeScale: 1,
            },
            variability: 0.08,
        }),
        height: 0.62,
        stem: {
            ...rootBase.stem,
            radius: 0.022,
            minRadius: 0.007,
        },
        leaf: {
            ...rootBase.leaf,
            size: 0.2,
            type: 'lobed',
        },
        vegetable: {
            enabled: true,
            type: 'turnip',
            baseSize: 0.25,
        },
    }),
};
