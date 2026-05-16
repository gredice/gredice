import type { PlantDefinition } from '../plant-definition-types';
import { createPlant } from './helpers';

const brassicaRules: PlantDefinition['rules'] = {
    F: [
        {
            rule: 'S(1.02,1.06)[+(18)L(1.08)][-(18)L(1.08)][^(14)L(1)]',
            weight: 3,
        },
        {
            rule: 'S(0.94,1.08)[+(14)L(1.02)][-(14)L(1.02)][P(1.06)]',
            weight: 1,
        },
    ],
    S: [
        {
            right: ['P'],
            rule: 'F(0.72,0.92)S(0.68,0.96)[L(1.16)]',
            weight: 2,
        },
        {
            right: ['L'],
            rule: 'F(0.86,0.92)S(0.78,0.92)[L(1.08)]',
            weight: 2,
        },
        { rule: 'F(0.94,0.94)S(0.88,0.9)[L(1)]', weight: 2 },
        { rule: 'F(0.88,0.92)S(0.8,0.88)', weight: 1 },
    ],
};

const brassicaBase: PlantDefinition = {
    name: 'Brassica Base',
    axiom: 'F',
    rules: brassicaRules,
    angle: 26,
    height: 0.68,
    branching: 0.8,
    directionVariability: 0.08,
    stem: {
        color: '#62853a',
        radius: 0.03,
        length: 0.08,
        radiusDecay: 0.6,
        minRadius: 0.003,
    },
    leaf: {
        color: '#6d983e',
        size: 0.24,
        type: 'oval',
        density: 2,
        hangAngle: 30,
        hangAngleRandomness: 14,
        sizeDecay: 0.45,
    },
    flower: {
        enabled: false,
        ageStart: 0,
        color: '#ffffff',
        size: 0,
    },
    vegetable: {
        enabled: true,
        ageStart: 8,
        type: 'broccoli',
        yield: 1,
        baseSize: 0.24,
    },
};

const basalBulbBase: PlantDefinition = {
    name: 'Basal Bulb Base',
    axiom: 'P[^^^^F][^^F]',
    rules: {
        F: [
            {
                rule: 'F(1.04,1)[+(16)J(1.04)][-(16)J(1.04)]',
                weight: 2,
            },
            {
                rule: 'F(0.96,0.98)[^(12)J(0.96)][&(12)J(0.96)]',
                weight: 1,
            },
        ],
    },
    angle: 18,
    height: 0.66,
    branching: 0.4,
    directionVariability: 0.06,
    stem: {
        color: '#5f8436',
        radius: 0.02,
        length: 0.09,
        radiusDecay: 0.7,
        minRadius: 0.002,
    },
    leaf: {
        color: '#7ba444',
        size: 0.18,
        type: 'oval',
        density: 2,
        hangAngle: 18,
        hangAngleRandomness: 10,
        sizeDecay: 0.55,
    },
    flower: {
        enabled: false,
        ageStart: 0,
        color: '#ffffff',
        size: 0,
    },
    vegetable: {
        enabled: true,
        ageStart: 6,
        type: 'kohlrabi',
        yield: 1,
        baseSize: 0.24,
    },
};

export const brassicaPlants = {
    broccoli: createPlant({
        ...brassicaBase,
        name: 'Brokula',
        vegetable: {
            ...brassicaBase.vegetable,
            type: 'broccoli',
            baseSize: 0.22,
        },
    }),
    cauliflower: createPlant({
        ...brassicaBase,
        name: 'Cvjetača',
        leaf: {
            ...brassicaBase.leaf,
            color: '#739943',
            size: 0.25,
        },
        vegetable: {
            ...brassicaBase.vegetable,
            type: 'cauliflower',
            baseSize: 0.24,
        },
    }),
    kale: createPlant({
        ...brassicaBase,
        name: 'Kelj',
        height: 0.74,
        branching: 0.96,
        leaf: {
            ...brassicaBase.leaf,
            type: 'serrated',
            density: 3,
        },
        vegetable: {
            ...brassicaBase.vegetable,
            enabled: false,
            yield: 0,
        },
    }),
    kohlrabi: createPlant({
        ...basalBulbBase,
        name: 'Koraba',
        leaf: {
            ...basalBulbBase.leaf,
            size: 0.2,
        },
        vegetable: {
            ...basalBulbBase.vegetable,
            type: 'kohlrabi',
            baseSize: 0.24,
        },
    }),
    cabbage: createPlant({
        ...brassicaBase,
        name: 'Kupus',
        height: 0.46,
        branching: 0.56,
        leaf: {
            ...brassicaBase.leaf,
            color: '#84a850',
            size: 0.28,
            type: 'round',
            density: 3,
            hangAngle: 45,
        },
        vegetable: {
            ...brassicaBase.vegetable,
            type: 'cabbage',
            baseSize: 0.3,
        },
    }),
    collard: createPlant({
        ...brassicaBase,
        name: 'Raštika',
        height: 0.78,
        branching: 0.92,
        leaf: {
            ...brassicaBase.leaf,
            color: '#67883d',
            size: 0.27,
            density: 2,
        },
        vegetable: {
            ...brassicaBase.vegetable,
            enabled: false,
            yield: 0,
        },
    }),
};
