import type { PlantDefinition } from '../plant-definition-types';
import { createDevelopmentProgram, createPlant } from './helpers';

const grassFlower = {
    enabled: false,
    color: '#ffffff',
    size: 0,
};

const grassVegetable: PlantDefinition['vegetable'] = {
    enabled: false,
    type: 'tomato',
    baseSize: 0.12,
};

export const grassPlants = {
    lemongrass: createPlant('lemongrass', {
        name: 'Limunska trava',
        development: createDevelopmentProgram('clump', {
            axes: {
                spread: 0.82,
            },
            foliage: {
                count: 34,
                emergenceInterval: 0.24,
                pitchRangeDegrees: [8, 24],
                sizeRange: [0.76, 1.1],
            },
            phenology: { maturityGeneration: 9.5 },
            variability: 0.08,
        }),
        height: 0.92,
        stem: {
            color: '#79a44a',
            radius: 0.012,
            radiusDecay: 0.16,
            minRadius: 0.003,
        },
        leaf: {
            color: '#79a44a',
            size: 0.2,
            type: 'strap',
        },
        flower: grassFlower,
        vegetable: grassVegetable,
    }),
    wheatgrass: createPlant('wheatgrass', {
        name: 'Pšenična trava',
        development: createDevelopmentProgram('clump', {
            axes: {
                spread: 0.72,
            },
            foliage: {
                count: 44,
                emergenceInterval: 0.18,
                pitchRangeDegrees: [5, 17],
                sizeRange: [0.78, 1.08],
            },
            phenology: { maturityGeneration: 9 },
            variability: 0.06,
        }),
        height: 0.44,
        stem: {
            color: '#82ac4c',
            radius: 0.008,
            radiusDecay: 0.16,
            minRadius: 0.002,
        },
        leaf: {
            color: '#82ac4c',
            size: 0.11,
            type: 'strap',
        },
        flower: grassFlower,
        vegetable: grassVegetable,
    }),
    ornamentalgrass: createPlant('ornamentalgrass', {
        name: 'Ukrasna trava',
        development: createDevelopmentProgram('clump', {
            axes: {
                spread: 0.92,
            },
            foliage: {
                count: 40,
                emergenceInterval: 0.2,
                pitchRangeDegrees: [10, 28],
                sizeRange: [0.72, 1.12],
            },
            phenology: { maturityGeneration: 10 },
            variability: 0.11,
        }),
        height: 1.08,
        stem: {
            color: '#5f8740',
            radius: 0.011,
            radiusDecay: 0.16,
            minRadius: 0.003,
        },
        leaf: {
            color: '#5f8740',
            size: 0.22,
            type: 'strap',
        },
        flower: grassFlower,
        vegetable: grassVegetable,
    }),
};
