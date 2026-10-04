import type { PlantDefinition } from '../plant-definition-types';
import { createDevelopmentProgram, createPlant } from './helpers';

const treeVegetable: PlantDefinition['vegetable'] = {
    enabled: false,
    type: 'tomato',
    baseSize: 0.16,
};

export const treePlants = {
    figtree: createPlant('figtree', {
        name: 'Smokva',
        development: createDevelopmentProgram('tree', {
            axes: {
                branchCount: 7,
                branchLengthScale: 0.62,
                branchNodeCount: 3,
                branchPitchDegrees: 48,
                branchingPattern: 'forked',
                nodeCount: 5,
                spread: 0.5,
            },
            foliage: {
                count: 44,
                petioleLengthScale: 0.3,
                pitchRangeDegrees: [30, 58],
                sizeRange: [0.72, 1.08],
            },
            phenology: { maturityGeneration: 11 },
            variability: 0.1,
        }),
        height: 1.42,
        stem: {
            color: '#7c5b35',
            radius: 0.09,
            radiusDecay: 0.34,
            minRadius: 0.008,
            surface: 'bark',
            detailColor: '#5a4022',
            detailStrength: 0.38,
            detailScale: 18,
        },
        leaf: {
            color: '#5b7f37',
            size: 0.3,
            type: 'palmate',
        },
        flower: {
            enabled: false,
            color: '#ffffff',
            size: 0,
        },
        vegetable: treeVegetable,
    }),
    olivetree: createPlant('olivetree', {
        name: 'Maslina',
        development: createDevelopmentProgram('tree', {
            axes: {
                branchCount: 8,
                branchLengthScale: 0.56,
                branchNodeCount: 4,
                branchPitchDegrees: 52,
                branchingPattern: 'forked',
                nodeCount: 5,
                spread: 0.46,
            },
            foliage: {
                arrangement: 'opposite',
                count: 52,
                emergenceInterval: 0.17,
                petioleLengthScale: 0.12,
                pitchRangeDegrees: [24, 50],
                sizeRange: [0.7, 1.04],
            },
            phenology: { maturityGeneration: 11.5 },
            variability: 0.08,
        }),
        height: 1.2,
        stem: {
            color: '#84705a',
            radius: 0.09,
            radiusDecay: 0.34,
            minRadius: 0.008,
            surface: 'bark',
            detailColor: '#665542',
            detailStrength: 0.38,
            detailScale: 22,
        },
        leaf: {
            color: '#7b9360',
            size: 0.16,
            type: 'lanceolate',
        },
        flower: {
            enabled: false,
            color: '#ffffff',
            size: 0,
        },
        vegetable: treeVegetable,
    }),
    youngappletree: createPlant('youngappletree', {
        name: 'Mlada jabuka',
        development: createDevelopmentProgram('tree', {
            axes: {
                branchCount: 6,
                branchLengthScale: 0.58,
                branchNodeCount: 3,
                branchPitchDegrees: 50,
                branchingPattern: 'alternate',
                nodeCount: 5,
                spread: 0.44,
            },
            foliage: {
                count: 46,
                emergenceInterval: 0.19,
                petioleLengthScale: 0.24,
                pitchRangeDegrees: [28, 56],
                sizeRange: [0.72, 1.04],
            },
            phenology: { maturityGeneration: 11 },
            reproduction: {
                flowerStart: 7,
                flowersPerSite: 2,
                form: 'cluster',
                site: 'terminal',
                siteCount: 4,
            },
            variability: 0.09,
        }),
        height: 1.34,
        stem: {
            color: '#7c5b35',
            radius: 0.09,
            radiusDecay: 0.34,
            minRadius: 0.008,
            surface: 'bark',
            detailColor: '#5a4022',
            detailStrength: 0.38,
            detailScale: 18,
        },
        leaf: {
            color: '#6b8f3a',
            size: 0.22,
            type: 'serrated',
        },
        flower: {
            enabled: true,
            color: '#f7e6ef',
            size: 0.06,
        },
        vegetable: treeVegetable,
    }),
};
