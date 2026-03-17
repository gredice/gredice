import type { PlantDefinition } from '../plant-definition-types';
import { createPlant } from './helpers';

const cucurbitRules: PlantDefinition['rules'] = {
    F: [
        {
            left: ['P'],
            rule: 'F(0.78,0.82)[-(12)L(0.86)]',
            weight: 2,
        },
        {
            rule: 'F(1.18,1.02)[+(30)L(1.14)P(0.88)]F(1.04,0.96)',
            weight: 3,
        },
        {
            rule: 'F(1.18,1.02)[-(30)L(1.14)P(0.88)]F(1.04,0.96)',
            weight: 3,
        },
        {
            rule: 'F(1.08,1)[+(24)L(1.08)][-(24)L(1.08)]F(0.96,0.92)',
            weight: 2,
        },
        { rule: '[&(18)F(0.92,0.9)]', weight: 1 },
    ],
};

const cucurbitBase: Omit<PlantDefinition, 'name' | 'vegetable'> = {
    axiom: 'F',
    rules: cucurbitRules,
    angle: 30,
    height: 0.74,
    branching: 1,
    directionVariability: 0.18,
    stem: {
        color: '#4f7028',
        radius: 0.028,
        length: 0.12,
        radiusDecay: 0.42,
        minRadius: 0.004,
    },
    leaf: {
        color: '#567f2a',
        size: 0.38,
        type: 'heart',
        density: 1,
        hangAngle: 28,
        hangAngleRandomness: 18,
        sizeDecay: 0.5,
    },
    flower: {
        enabled: true,
        ageStart: 4,
        color: '#f5e642',
        size: 0.09,
    },
};

export const cucurbitPlants = {
    cucumber: createPlant({
        ...cucurbitBase,
        name: 'Krastavac',
        height: 0.82,
        support: {
            enabled: true,
            mode: 'trellis',
            color: '#8f764e',
            height: 1.18,
            radius: 0.026,
            width: 0.62,
            depth: 0.05,
            climbInfluence: 0.84,
            spiralTurns: 3.2,
        },
        vegetable: {
            enabled: true,
            ageStart: 6,
            type: 'cucumber',
            yield: 0.5,
            baseSize: 0.3,
        },
    }),
    zucchini: createPlant({
        ...cucurbitBase,
        name: 'Tikvice',
        height: 0.68,
        leaf: {
            ...cucurbitBase.leaf,
            size: 0.42,
            color: '#608a35',
        },
        vegetable: {
            enabled: true,
            ageStart: 7,
            type: 'zucchini',
            yield: 0.45,
            baseSize: 0.35,
        },
    }),
    pumpkin: createPlant({
        ...cucurbitBase,
        name: 'Tikva',
        height: 0.56,
        branching: 0.92,
        leaf: {
            ...cucurbitBase.leaf,
            size: 0.44,
            color: '#648930',
        },
        vegetable: {
            enabled: true,
            ageStart: 8,
            type: 'pumpkin',
            yield: 0.25,
            baseSize: 0.44,
        },
    }),
    melon: createPlant({
        ...cucurbitBase,
        name: 'Dinja',
        height: 0.58,
        leaf: {
            ...cucurbitBase.leaf,
            size: 0.4,
            color: '#6c933e',
        },
        vegetable: {
            enabled: true,
            ageStart: 8,
            type: 'melon',
            yield: 0.3,
            baseSize: 0.4,
        },
    }),
};
