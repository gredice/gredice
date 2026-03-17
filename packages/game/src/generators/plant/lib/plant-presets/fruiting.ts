import type { PlantDefinition } from '../plant-definition-types';
import { createPlant } from './helpers';

const fruitingRules: PlantDefinition['rules'] = {
    F: [
        {
            rule: 'S(1.12,1.06)[+(28)L(1.08)][^(18)P(0.92)][-(22)L(0.98)][&(16)P(0.82)]',
            weight: 3,
        },
        {
            rule: 'S(1.04,1)[+(36)L(1.04)][-(36)L(1.04)][^(24)P(0.84)]',
            weight: 2,
        },
        {
            rule: 'S(0.98,0.96)[+(24)F(0.84,0.84)][-(22)F(0.8,0.82)]',
            weight: 2,
        },
        {
            rule: 'S(0.92,0.94)[&(20)F(0.76,0.8)][^(20)F(0.76,0.8)]',
            weight: 1,
        },
        { rule: 'S(0.9,0.92)', weight: 1 },
    ],
    S: [
        {
            right: ['P'],
            rule: 'F(0.82,0.88)[+(18)L(0.82)]',
            weight: 3,
        },
        {
            right: ['L'],
            rule: 'F(0.96,0.94)S(0.88,0.88)[+(16)L(0.8)]',
            weight: 2,
        },
        { rule: 'F(1.02,0.96)S(0.94,0.92)[+(20)L(0.92)]', weight: 2 },
        { rule: 'F(0.94,0.9)S(0.88,0.88)', weight: 1 },
        {
            rule: 'F(0.9,0.88)[+(28)S(0.78,0.8)][-(24)S(0.74,0.78)]',
            weight: 1,
        },
    ],
};

const fruitingBase: Omit<PlantDefinition, 'name' | 'vegetable'> = {
    axiom: 'F',
    rules: fruitingRules,
    angle: 24,
    height: 1.02,
    branching: 1,
    directionVariability: 0.12,
    stem: {
        color: '#5f7631',
        radius: 0.046,
        length: 0.075,
        radiusDecay: 0.55,
        minRadius: 0.005,
    },
    leaf: {
        color: '#486724',
        size: 0.24,
        type: 'oval',
        density: 1,
        hangAngle: 35,
        hangAngleRandomness: 18,
        sizeDecay: 0.35,
    },
    flower: {
        enabled: true,
        ageStart: 6,
        color: '#f7ea72',
        size: 0.075,
    },
};

export const fruitingPlants = {
    tomato: createPlant({
        ...fruitingBase,
        name: 'Rajčica',
        height: 1.08,
        branching: 1.16,
        stem: {
            ...fruitingBase.stem,
            color: '#5a6e2a',
        },
        leaf: {
            ...fruitingBase.leaf,
            color: '#3d5a1a',
            type: 'compound',
            size: 0.23,
        },
        flower: {
            ...fruitingBase.flower,
            color: '#ffff00',
        },
        vegetable: {
            enabled: true,
            ageStart: 9,
            type: 'tomato',
            yield: 0.8,
            baseSize: 0.16,
        },
    }),
    bellpepper: createPlant({
        ...fruitingBase,
        name: 'Paprika',
        angle: 38,
        height: 0.86,
        branching: 0.8,
        directionVariability: 0.06,
        stem: {
            ...fruitingBase.stem,
            color: '#4f7a28',
            radius: 0.056,
            length: 0.1,
            radiusDecay: 0.6,
            minRadius: 0.006,
        },
        leaf: {
            ...fruitingBase.leaf,
            color: '#3a591f',
            size: 0.22,
            type: 'oval',
            hangAngle: 20,
            hangAngleRandomness: 10,
            sizeDecay: 0.4,
        },
        flower: {
            ...fruitingBase.flower,
            color: '#ffffff',
            size: 0.065,
        },
        vegetable: {
            enabled: true,
            ageStart: 9,
            type: 'bellpepper',
            yield: 0.6,
            baseSize: 0.21,
        },
    }),
    eggplant: createPlant({
        ...fruitingBase,
        name: 'Patliđan',
        angle: 30,
        height: 0.94,
        branching: 0.84,
        stem: {
            ...fruitingBase.stem,
            color: '#62783b',
            radius: 0.05,
            length: 0.085,
        },
        leaf: {
            ...fruitingBase.leaf,
            color: '#4f6b33',
            size: 0.27,
            type: 'oval',
            density: 2,
        },
        flower: {
            ...fruitingBase.flower,
            color: '#d8b6ff',
            size: 0.07,
        },
        vegetable: {
            enabled: true,
            ageStart: 9,
            type: 'eggplant',
            yield: 0.55,
            baseSize: 0.22,
        },
    }),
    artichoke: createPlant({
        ...fruitingBase,
        name: 'Artičoka',
        angle: 18,
        height: 0.82,
        branching: 0.62,
        directionVariability: 0.08,
        stem: {
            ...fruitingBase.stem,
            color: '#6e8450',
            radius: 0.06,
            length: 0.07,
        },
        leaf: {
            ...fruitingBase.leaf,
            color: '#718c56',
            size: 0.34,
            type: 'serrated',
            density: 2,
            hangAngle: 18,
            hangAngleRandomness: 8,
        },
        flower: {
            ...fruitingBase.flower,
            enabled: false,
            size: 0,
        },
        vegetable: {
            enabled: true,
            ageStart: 8,
            type: 'artichoke',
            yield: 0.35,
            baseSize: 0.28,
        },
    }),
    okra: createPlant({
        ...fruitingBase,
        name: 'Bamija',
        angle: 28,
        height: 0.96,
        branching: 0.9,
        stem: {
            ...fruitingBase.stem,
            color: '#56793d',
        },
        leaf: {
            ...fruitingBase.leaf,
            color: '#4f7d2f',
            size: 0.25,
            type: 'heart',
            density: 2,
        },
        flower: {
            ...fruitingBase.flower,
            color: '#fff0d7',
            size: 0.08,
        },
        vegetable: {
            enabled: true,
            ageStart: 8,
            type: 'okra',
            yield: 0.65,
            baseSize: 0.18,
        },
    }),
};
