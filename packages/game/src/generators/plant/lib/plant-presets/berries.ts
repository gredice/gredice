import type { PlantDefinition } from '../plant-definition-types';
import { createDevelopmentProgram, createPlant } from './helpers';

const berryShrubAppearance = {
    height: 0.74,
    stem: {
        color: '#6f7d46',
        radius: 0.03,
        radiusDecay: 0.56,
        minRadius: 0.004,
    },
    leaf: {
        color: '#587b37',
        size: 0.18,
        type: 'oval',
    },
    flower: {
        enabled: true,
        color: '#fff8ef',
        size: 0.05,
    },
} satisfies Pick<PlantDefinition, 'flower' | 'height' | 'leaf' | 'stem'>;

const strawberryAppearance = {
    height: 0.34,
    stem: {
        color: '#7a8f4c',
        radius: 0.018,
        radiusDecay: 0.7,
        minRadius: 0.003,
    },
    leaf: {
        color: '#5c8a3d',
        size: 0.24,
        type: 'serrated',
    },
    flower: {
        enabled: true,
        color: '#fff6de',
        size: 0.06,
    },
} satisfies Pick<PlantDefinition, 'flower' | 'height' | 'leaf' | 'stem'>;

export const berryPlants = {
    strawberry: createPlant('strawberry', {
        ...strawberryAppearance,
        name: 'Jagoda',
        development: createDevelopmentProgram('rosette', {
            axes: { spread: 0.82 },
            foliage: {
                count: 12,
                emergenceInterval: 0.58,
                maturityDuration: 1.8,
                petioleLengthScale: 0.42,
                pitchRangeDegrees: [32, 68],
                sizeRange: [0.74, 1.08],
            },
            phenology: {
                emergenceStart: 0.3,
                maturityGeneration: 9.5,
            },
            reproduction: {
                flowerStart: 4.5,
                flowersPerSite: 1,
                form: 'star',
                fruitStart: 6.5,
                produceCount: 6,
                site: 'terminal',
                siteCount: 2,
            },
            special: { runnerCount: 3 },
            variability: 0.12,
        }),
        vegetable: {
            enabled: true,
            type: 'strawberry',
            baseSize: 0.13,
        },
    }),
    blueberry: createPlant('blueberry', {
        ...berryShrubAppearance,
        name: 'Borovnica',
        height: 0.72,
        development: createDevelopmentProgram('shrub', {
            axes: {
                axisCount: 4,
                branchCount: 5,
                branchLengthScale: 0.4,
                branchNodeCount: 3,
                spread: 0.38,
            },
            foliage: {
                count: 36,
                emergenceInterval: 0.24,
                maturityDuration: 1.7,
                petioleLengthScale: 0.25,
                sizeRange: [0.74, 1.03],
            },
            phenology: {
                emergenceStart: 0.35,
                maturityGeneration: 10.5,
            },
            reproduction: {
                flowerStart: 6.25,
                flowersPerSite: 1,
                form: 'cluster',
                fruitStart: 8,
                produceCount: 6,
                site: 'axillary',
                siteCount: 6,
            },
            variability: 0.1,
        }),
        stem: {
            ...berryShrubAppearance.stem,
            color: '#7f6e58',
            radius: 0.028,
        },
        leaf: {
            ...berryShrubAppearance.leaf,
            color: '#668743',
            size: 0.16,
        },
        flower: {
            ...berryShrubAppearance.flower,
            color: '#f2efe8',
        },
        vegetable: {
            enabled: true,
            type: 'blueberry',
            baseSize: 0.14,
        },
    }),
    raspberry: createPlant('raspberry', {
        ...berryShrubAppearance,
        name: 'Malina',
        height: 0.94,
        development: createDevelopmentProgram('shrub', {
            axes: {
                axisCount: 5,
                branchCount: 3,
                branchLengthScale: 0.48,
                branchNodeCount: 3,
                branchPitchDegrees: 34,
                branchingPattern: 'multi-stem',
                nodeCount: 8,
                spread: 0.28,
            },
            foliage: {
                count: 30,
                emergenceInterval: 0.28,
                maturityDuration: 1.65,
                petioleLengthScale: 0.34,
                sizeRange: [0.7, 1.06],
            },
            phenology: {
                emergenceStart: 0.35,
                maturityGeneration: 10.5,
            },
            reproduction: {
                flowerStart: 5.5,
                flowersPerSite: 1,
                form: 'cluster',
                fruitStart: 7.5,
                produceCount: 8,
                site: 'axillary',
                siteCount: 2,
            },
            special: { thornCount: 20 },
            variability: 0.14,
        }),
        stem: {
            ...berryShrubAppearance.stem,
            color: '#7e684c',
            radius: 0.024,
            minRadius: 0.003,
        },
        leaf: {
            ...berryShrubAppearance.leaf,
            color: '#55762f',
            size: 0.22,
            type: 'serrated',
        },
        flower: {
            ...berryShrubAppearance.flower,
            size: 0.055,
        },
        vegetable: {
            enabled: true,
            type: 'raspberry',
            baseSize: 0.17,
        },
        thorn: {
            enabled: true,
            color: '#8f6f48',
            size: 0.07,
            density: 3,
        },
    }),
};
