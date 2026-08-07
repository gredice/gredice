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
            axes: { spread: 0.72 },
            foliage: {
                count: 13,
                petioleLengthScale: 0.28,
                pitchRangeDegrees: [42, 72],
                sizeRange: [0.62, 1.06],
            },
            phenology: { maturityGeneration: 10 },
            storage: {
                aboveSoilFraction: 0.08,
                birthGeneration: 1.5,
                matureGeneration: 10,
                sizeScale: 1,
            },
            variability: 0.08,
        }),
        height: 0.72,
        stem: {
            ...rootBase.stem,
            color: '#3b6718',
            radius: 0.024,
        },
        leaf: {
            ...rootBase.leaf,
            type: 'feathery',
        },
        vegetable: {
            enabled: true,
            type: 'carrot',
            baseSize: 0.2,
        },
    }),
    beet: createPlant('beet', {
        ...rootBase,
        name: 'Cikla',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 0.82 },
            foliage: {
                count: 12,
                petioleLengthScale: 0.48,
                pitchRangeDegrees: [38, 68],
                sizeRange: [0.68, 1.06],
            },
            phenology: { maturityGeneration: 9.5 },
            storage: {
                aboveSoilFraction: 0.26,
                birthGeneration: 1.25,
                matureGeneration: 9.5,
                sizeScale: 1,
            },
            variability: 0.07,
        }),
        height: 0.62,
        stem: {
            ...rootBase.stem,
            color: '#7d3c47',
            radius: 0.024,
        },
        leaf: {
            ...rootBase.leaf,
            color: '#5b8a34',
            size: 0.21,
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
            axes: { spread: 0.68 },
            foliage: {
                count: 10,
                emergenceInterval: 0.42,
                petioleLengthScale: 0.32,
                pitchRangeDegrees: [42, 70],
                sizeRange: [0.64, 1.04],
            },
            phenology: { maturityGeneration: 8 },
            storage: {
                aboveSoilFraction: 0.3,
                birthGeneration: 1,
                matureGeneration: 8,
                sizeScale: 1,
            },
            variability: 0.07,
        }),
        height: 0.46,
        stem: {
            ...rootBase.stem,
            color: '#4b6f20',
            radius: 0.018,
        },
        leaf: {
            ...rootBase.leaf,
            size: 0.15,
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
            axes: { spread: 0.76 },
            foliage: {
                count: 12,
                petioleLengthScale: 0.36,
                pitchRangeDegrees: [40, 68],
                sizeRange: [0.66, 1.05],
            },
            phenology: { maturityGeneration: 9.5 },
            storage: {
                aboveSoilFraction: 0.28,
                birthGeneration: 1.25,
                matureGeneration: 9.5,
                sizeScale: 1,
            },
            variability: 0.08,
        }),
        height: 0.58,
        leaf: {
            ...rootBase.leaf,
            size: 0.19,
            type: 'lobed',
        },
        vegetable: {
            enabled: true,
            type: 'turnip',
            baseSize: 0.25,
        },
    }),
};
