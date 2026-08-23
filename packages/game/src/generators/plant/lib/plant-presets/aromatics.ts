import { createDevelopmentProgram, createPlant } from './helpers';

export const aromaticPlants = {
    fennel: createPlant('fennel', {
        name: 'Komorač',
        development: createDevelopmentProgram('upright', {
            axes: {
                axisCount: 4,
                branchCount: 4,
                branchLengthScale: 0.5,
                branchNodeCount: 3,
                branchPitchDegrees: 36,
                branchingPattern: 'multi-stem',
                habit: 'basal',
                nodeCount: 8,
                spread: 0.36,
            },
            foliage: {
                arrangement: 'fan',
                count: 14,
                emergenceInterval: 0.54,
                petioleLengthScale: 0.62,
                pitchRangeDegrees: [40, 72],
                sizeRange: [0.74, 1.08],
            },
            phenology: { maturityGeneration: 10.5 },
            reproduction: {
                flowerStart: 8,
                flowersPerSite: 1,
                form: 'umbel',
                fruitStart: 6,
                produceCount: 1,
                site: 'terminal',
                siteCount: 1,
            },
            storage: {
                aboveSoilFraction: 0.62,
                birthGeneration: 1.5,
                matureGeneration: 8.5,
                sizeScale: 1,
            },
            variability: 0.08,
        }),
        height: 0.86,
        stem: {
            color: '#7aa24d',
            radius: 0.018,
            radiusDecay: 0.55,
            minRadius: 0.006,
        },
        leaf: {
            color: '#92b95d',
            size: 0.14,
            type: 'feathery',
        },
        flower: {
            enabled: false,
            color: '#ffffff',
            size: 0,
        },
        vegetable: {
            enabled: true,
            type: 'fennel',
            baseSize: 0.24,
        },
    }),
};
