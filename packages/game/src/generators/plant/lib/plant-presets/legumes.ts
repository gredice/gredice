import type { PlantDefinition } from '../plant-definition-types';
import { createPlant } from './helpers';

const legumeRules: PlantDefinition['rules'] = {
    F: [
        {
            left: ['P'],
            rule: 'F(0.78,0.8)[+(14)L(0.76)]',
            weight: 2,
        },
        {
            left: ['L'],
            right: ['P'],
            rule: 'F(0.84,0.84)[+(12)P(0.74)]',
            weight: 1,
        },
        {
            rule: 'F(1.04,1.02)[+(24)L(0.92)P(0.88)]F(0.94,0.94)',
            weight: 3,
        },
        {
            rule: 'F(1.04,1.02)[-(24)L(0.92)P(0.88)]F(0.94,0.94)',
            weight: 3,
        },
        {
            rule: 'F(0.96,0.96)[+(18)L(0.84)][-(18)L(0.84)]P(0.82)',
            weight: 1,
        },
    ],
};

const legumeBase: Omit<PlantDefinition, 'name' | 'vegetable'> = {
    axiom: 'F',
    rules: legumeRules,
    angle: 26,
    height: 0.88,
    branching: 1.1,
    directionVariability: 0.18,
    stem: {
        color: '#5d7e36',
        radius: 0.024,
        length: 0.1,
        radiusDecay: 0.5,
        minRadius: 0.003,
    },
    leaf: {
        color: '#5e8a30',
        size: 0.18,
        type: 'compound',
        density: 2,
        hangAngle: 28,
        hangAngleRandomness: 16,
        sizeDecay: 0.45,
    },
    flower: {
        enabled: true,
        ageStart: 6,
        color: '#ffffff',
        size: 0.06,
    },
};

export const legumePlants = {
    broadbean: createPlant({
        ...legumeBase,
        name: 'Bob',
        height: 0.9,
        branching: 0.96,
        leaf: {
            ...legumeBase.leaf,
            size: 0.22,
            type: 'oval',
        },
        flower: {
            ...legumeBase.flower,
            color: '#f7f7f7',
        },
        vegetable: {
            enabled: true,
            ageStart: 8,
            type: 'beanpod',
            yield: 0.65,
            baseSize: 0.25,
        },
    }),
    bean: createPlant({
        ...legumeBase,
        name: 'Grah',
        height: 0.92,
        vegetable: {
            enabled: true,
            ageStart: 8,
            type: 'beanpod',
            yield: 0.7,
            baseSize: 0.22,
        },
    }),
    pea: createPlant({
        ...legumeBase,
        name: 'Grašak',
        height: 0.8,
        branching: 1.18,
        leaf: {
            ...legumeBase.leaf,
            size: 0.16,
        },
        flower: {
            ...legumeBase.flower,
            color: '#f2edf7',
        },
        vegetable: {
            enabled: true,
            ageStart: 7,
            type: 'peapod',
            yield: 0.8,
            baseSize: 0.19,
        },
    }),
    greenbean: createPlant({
        ...legumeBase,
        name: 'Mahuna',
        height: 0.84,
        vegetable: {
            enabled: true,
            ageStart: 7,
            type: 'beanpod',
            yield: 0.85,
            baseSize: 0.2,
        },
    }),
};
