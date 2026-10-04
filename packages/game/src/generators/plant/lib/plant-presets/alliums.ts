import type { PlantDefinition } from '../plant-definition-types';
import { createDevelopmentProgram, createPlant } from './helpers';

const alliumBase: Pick<PlantDefinition, 'flower' | 'height' | 'leaf' | 'stem'> =
    {
        height: 1.02,
        stem: {
            color: '#5d9540',
            radius: 0.015,
            radiusDecay: 0.24,
            minRadius: 0.008,
        },
        leaf: {
            color: '#5d9540',
            size: 0.3,
            type: 'tubular',
        },
        flower: {
            enabled: false,
            color: '#ffffff',
            size: 0,
        },
    };

export const alliumPlants = {
    onion: createPlant('onion', {
        ...alliumBase,
        name: 'Luk',
        development: createDevelopmentProgram('clump', {
            axes: { spread: 0.34 },
            foliage: {
                count: 10,
                emergenceInterval: 0.62,
                pitchRangeDegrees: [5, 18],
                sizeRange: [0.66, 1.04],
            },
            phenology: { maturityGeneration: 10 },
            storage: {
                aboveSoilFraction: 0.4,
                birthGeneration: 1.5,
                matureGeneration: 10,
                sizeScale: 1,
            },
            variability: 0.06,
        }),
        vegetable: {
            enabled: true,
            type: 'onion',
            baseSize: 0.22,
        },
    }),
    garlic: createPlant('garlic', {
        ...alliumBase,
        name: 'Češnjak',
        development: createDevelopmentProgram('clump', {
            axes: { spread: 0.28 },
            foliage: {
                count: 9,
                emergenceInterval: 0.66,
                pitchRangeDegrees: [8, 22],
                sizeRange: [0.68, 1.02],
            },
            phenology: { maturityGeneration: 10 },
            storage: {
                aboveSoilFraction: 0.28,
                birthGeneration: 1.5,
                matureGeneration: 10,
                sizeScale: 1,
            },
            variability: 0.06,
        }),
        height: 0.92,
        stem: {
            ...alliumBase.stem,
            color: '#719f52',
        },
        leaf: {
            ...alliumBase.leaf,
            color: '#719f52',
            size: 0.28,
            type: 'strap',
        },
        vegetable: {
            enabled: true,
            type: 'garlic',
            baseSize: 0.18,
        },
    }),
    leek: createPlant('leek', {
        ...alliumBase,
        name: 'Poriluk',
        development: createDevelopmentProgram('clump', {
            axes: { spread: 0.3 },
            foliage: {
                count: 14,
                emergenceInterval: 0.48,
                pitchRangeDegrees: [8, 25],
                sizeRange: [0.68, 1.06],
            },
            phenology: { maturityGeneration: 11 },
            storage: {
                aboveSoilFraction: 0.48,
                birthGeneration: 2,
                matureGeneration: 11,
                sizeScale: 1,
            },
            variability: 0.06,
        }),
        height: 1.1,
        stem: {
            ...alliumBase.stem,
            color: '#648f42',
            radius: 0.018,
            minRadius: 0.01,
        },
        leaf: {
            ...alliumBase.leaf,
            color: '#648f42',
            size: 0.34,
            type: 'strap',
        },
        vegetable: {
            enabled: true,
            type: 'leek',
            baseSize: 0.24,
        },
    }),
    chives: createPlant('chives', {
        ...alliumBase,
        name: 'Luk vlasac',
        development: createDevelopmentProgram('clump', {
            axes: { spread: 0.58 },
            foliage: {
                count: 28,
                emergenceInterval: 0.25,
                pitchRangeDegrees: [5, 20],
                sizeRange: [0.58, 1.05],
            },
            phenology: { maturityGeneration: 9.5 },
            reproduction: {
                flowerStart: 8,
                flowersPerSite: 1,
                form: 'pom-pom',
                produceCount: 0,
                site: 'umbel',
                siteCount: 3,
            },
            variability: 0.1,
        }),
        height: 0.74,
        stem: {
            ...alliumBase.stem,
            color: '#5c9c49',
            radius: 0.01,
            minRadius: 0.004,
        },
        leaf: {
            ...alliumBase.leaf,
            color: '#5c9c49',
            size: 0.22,
        },
        flower: {
            enabled: true,
            color: '#bf9cff',
            size: 0.065,
        },
        vegetable: {
            enabled: false,
            type: 'onion',
            baseSize: 0.12,
        },
    }),
};
