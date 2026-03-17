import type { PlantDefinition } from '../plant-definition-types';
import { createPlant } from './helpers';

const berryShrubRules: PlantDefinition['rules'] = {
    F: [
        {
            rule: 'S(1.04,1)[+(24)L(1.02)][-(22)L(0.98)][^(16)P(0.78)]',
            weight: 2,
        },
        {
            rule: 'S(0.96,0.98)[+(18)L(1.04)][-(18)L(1.04)]',
            weight: 2,
        },
        {
            rule: 'S(0.92,0.96)[+(28)F(0.82,0.84)][-(24)F(0.78,0.82)]',
            weight: 1,
        },
        {
            rule: 'S(0.88,0.94)[P(0.84)]',
            weight: 1,
        },
    ],
    S: [
        {
            right: ['P'],
            rule: 'F(0.76,0.86)[+(12)L(0.8)]',
            weight: 3,
        },
        {
            right: ['L'],
            rule: 'F(0.92,0.9)S(0.82,0.84)[+(14)L(0.88)]',
            weight: 2,
        },
        {
            rule: 'F(0.94,0.9)S(0.86,0.86)',
            weight: 1,
        },
    ],
};

const caneBerryRules: PlantDefinition['rules'] = {
    F: [
        {
            rule: 'S(1.08,1.02)T(1.05)[+(24)L(1.02)][-(22)L(0.98)][^(14)P(0.82)]',
            weight: 2,
        },
        {
            rule: 'S(0.98,1)T(0.96)[+(18)L(1.04)][-(18)L(1.04)]',
            weight: 2,
        },
        {
            rule: 'S(0.92,0.98)T(0.88)[+(30)F(0.84,0.86)][-(26)F(0.8,0.82)]',
            weight: 1,
        },
    ],
    S: [
        {
            right: ['P'],
            rule: 'F(0.78,0.88)T(0.92)[+(12)L(0.82)]',
            weight: 2,
        },
        {
            right: ['L'],
            rule: 'F(0.94,0.92)S(0.84,0.86)T(0.84)[+(14)L(0.88)]',
            weight: 2,
        },
        {
            rule: 'F(0.96,0.92)S(0.88,0.88)T(0.8)',
            weight: 1,
        },
    ],
};

const berryShrubBase: Omit<PlantDefinition, 'name' | 'vegetable'> = {
    axiom: 'F',
    rules: berryShrubRules,
    angle: 22,
    height: 0.74,
    branching: 1.04,
    directionVariability: 0.1,
    stem: {
        color: '#6f7d46',
        radius: 0.03,
        length: 0.078,
        radiusDecay: 0.56,
        minRadius: 0.004,
    },
    leaf: {
        color: '#587b37',
        size: 0.18,
        type: 'oval',
        density: 2,
        hangAngle: 26,
        hangAngleRandomness: 14,
        sizeDecay: 0.4,
    },
    flower: {
        enabled: true,
        ageStart: 6,
        color: '#fff8ef',
        size: 0.05,
    },
};

const strawberryRules: PlantDefinition['rules'] = {
    F: [
        {
            rule: 'S(0.86,1)[+(24)L(1.18)][-(24)L(1.18)][P(0.76)]',
            weight: 3,
        },
        {
            rule: 'S(0.8,0.96)[+(18)L(1.14)][-(18)L(1.14)][+(12)F(0.72,0.78)]',
            weight: 2,
        },
        {
            rule: 'S(0.74,0.94)[L(1.24)]',
            weight: 1,
        },
    ],
    S: [
        {
            right: ['P'],
            rule: 'F(0.62,0.82)[L(1.1)]',
            weight: 2,
        },
        {
            right: ['L'],
            rule: 'F(0.7,0.84)S(0.64,0.8)[+(12)L(1.04)]',
            weight: 2,
        },
        {
            rule: 'F(0.74,0.86)S(0.68,0.82)',
            weight: 1,
        },
    ],
};

const strawberryBase: Omit<PlantDefinition, 'name' | 'vegetable'> = {
    axiom: 'F',
    rules: strawberryRules,
    angle: 18,
    height: 0.34,
    branching: 1.3,
    directionVariability: 0.1,
    stem: {
        color: '#7a8f4c',
        radius: 0.018,
        length: 0.052,
        radiusDecay: 0.7,
        minRadius: 0.003,
    },
    leaf: {
        color: '#5c8a3d',
        size: 0.22,
        type: 'heart',
        density: 2,
        hangAngle: 40,
        hangAngleRandomness: 14,
        sizeDecay: 0.52,
    },
    flower: {
        enabled: true,
        ageStart: 4,
        color: '#fffdf7',
        size: 0.06,
    },
};

export const berryPlants = {
    strawberry: createPlant({
        ...strawberryBase,
        name: 'Jagoda',
        leaf: {
            ...strawberryBase.leaf,
            type: 'serrated',
            size: 0.24,
        },
        flower: {
            ...strawberryBase.flower,
            color: '#fff6de',
        },
        vegetable: {
            enabled: true,
            ageStart: 6,
            type: 'strawberry',
            yield: 0.8,
            baseSize: 0.13,
        },
    }),
    blueberry: createPlant({
        ...berryShrubBase,
        name: 'Borovnica',
        height: 0.72,
        stem: {
            ...berryShrubBase.stem,
            color: '#7f6e58',
            radius: 0.028,
        },
        leaf: {
            ...berryShrubBase.leaf,
            color: '#668743',
            size: 0.16,
        },
        flower: {
            ...berryShrubBase.flower,
            color: '#f2efe8',
        },
        vegetable: {
            enabled: true,
            ageStart: 7,
            type: 'blueberry',
            yield: 0.82,
            baseSize: 0.14,
        },
    }),
    raspberry: createPlant({
        ...berryShrubBase,
        name: 'Malina',
        rules: caneBerryRules,
        height: 0.94,
        branching: 1.12,
        directionVariability: 0.14,
        stem: {
            ...berryShrubBase.stem,
            color: '#7e684c',
            radius: 0.024,
            length: 0.094,
            minRadius: 0.003,
        },
        leaf: {
            ...berryShrubBase.leaf,
            color: '#55762f',
            size: 0.22,
            type: 'serrated',
            density: 2,
        },
        flower: {
            ...berryShrubBase.flower,
            ageStart: 5,
            size: 0.055,
        },
        vegetable: {
            enabled: true,
            ageStart: 7,
            type: 'raspberry',
            yield: 0.88,
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
