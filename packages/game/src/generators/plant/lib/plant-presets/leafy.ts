import type { PlantDefinition } from '../plant-definition-types';
import { createDevelopmentProgram, createPlant } from './helpers';

const leafyBase: Pick<
    PlantDefinition,
    'flower' | 'height' | 'leaf' | 'stem' | 'vegetable'
> = {
    height: 0.52,
    stem: {
        color: '#5b7c38',
        radius: 0.018,
        radiusDecay: 0.7,
        minRadius: 0.002,
    },
    leaf: {
        color: '#74a23f',
        size: 0.22,
        type: 'oval',
    },
    flower: {
        enabled: false,
        color: '#ffffff',
        size: 0,
    },
    vegetable: {
        enabled: false,
        type: 'cabbage',
        baseSize: 0.18,
    },
};

export const leafyPlants = {
    swisschard: createPlant('swisschard', {
        ...leafyBase,
        name: 'Blitva',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 0.88 },
            foliage: {
                count: 12,
                emergenceInterval: 0.62,
                petioleLengthScale: 0.52,
                pitchRangeDegrees: [35, 68],
                sizeRange: [0.72, 1.08],
            },
            phenology: { maturityGeneration: 10 },
            variability: 0.09,
        }),
        height: 0.6,
        stem: {
            ...leafyBase.stem,
            color: '#935f42',
            radius: 0.02,
        },
        leaf: {
            ...leafyBase.leaf,
            color: '#6ca63c',
            size: 0.25,
            type: 'heart',
        },
    }),
    celery: createPlant('celery', {
        ...leafyBase,
        name: 'Celer',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 0.72 },
            foliage: {
                count: 14,
                emergenceInterval: 0.5,
                petioleLengthScale: 0.58,
                pitchRangeDegrees: [32, 62],
                sizeRange: [0.7, 1.06],
            },
            phenology: { maturityGeneration: 10.5 },
            variability: 0.08,
        }),
        height: 0.78,
        stem: {
            ...leafyBase.stem,
            color: '#6f9154',
            radius: 0.022,
        },
        leaf: {
            ...leafyBase.leaf,
            color: '#5e8d38',
            size: 0.16,
            type: 'pinnate',
        },
    }),
    lettuce: createPlant('lettuce', {
        ...leafyBase,
        name: 'Salata',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 1.05 },
            foliage: {
                count: 20,
                emergenceInterval: 0.36,
                petioleLengthScale: 0.14,
                pitchRangeDegrees: [46, 78],
                sizeRange: [0.62, 1.08],
            },
            phenology: { maturityGeneration: 9.5 },
            variability: 0.12,
        }),
        height: 0.34,
        stem: {
            ...leafyBase.stem,
            radius: 0.012,
        },
        leaf: {
            ...leafyBase.leaf,
            color: '#8abc52',
            size: 0.26,
            type: 'ruffled',
        },
    }),
    spinach: createPlant('spinach', {
        ...leafyBase,
        name: 'Špinat',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 0.88 },
            foliage: {
                count: 16,
                emergenceInterval: 0.42,
                petioleLengthScale: 0.32,
                pitchRangeDegrees: [42, 72],
                sizeRange: [0.66, 1.06],
            },
            phenology: { maturityGeneration: 9 },
            variability: 0.09,
        }),
        height: 0.38,
        leaf: {
            ...leafyBase.leaf,
            color: '#5f9436',
            size: 0.18,
            type: 'oval',
        },
    }),
    arugula: createPlant('arugula', {
        ...leafyBase,
        name: 'Rukola',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 0.94 },
            foliage: {
                count: 22,
                emergenceInterval: 0.3,
                petioleLengthScale: 0.3,
                pitchRangeDegrees: [40, 72],
                sizeRange: [0.58, 1.04],
            },
            phenology: { maturityGeneration: 8.5 },
            variability: 0.13,
        }),
        height: 0.36,
        leaf: {
            ...leafyBase.leaf,
            color: '#679d3b',
            size: 0.18,
            type: 'lobed',
        },
    }),
    mache: createPlant('mache', {
        ...leafyBase,
        name: 'Matovilac',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 0.92 },
            foliage: {
                count: 18,
                emergenceInterval: 0.34,
                petioleLengthScale: 0.18,
                pitchRangeDegrees: [46, 76],
                sizeRange: [0.6, 1.04],
            },
            phenology: { maturityGeneration: 8.5 },
            variability: 0.1,
        }),
        height: 0.28,
        stem: {
            ...leafyBase.stem,
            radius: 0.012,
        },
        leaf: {
            ...leafyBase.leaf,
            color: '#7eae49',
            size: 0.15,
            type: 'round',
        },
    }),
};
