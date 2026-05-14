import type { PlantDefinition } from '../plant-definition-types';
import { createPlant } from './helpers';

const herbRules: PlantDefinition['rules'] = {
    F: [
        {
            rule: 'S(1.02,1)[+(22)L(1.02)][-(22)L(1.02)][^(18)F(0.84,0.86)]',
            weight: 2,
        },
        {
            rule: 'S(0.94,0.98)[+(18)L(0.98)][&(14)L(0.96)][P(0.88)]',
            weight: 1,
        },
        {
            rule: 'S(0.96,0.98)[^(18)L(0.92)][&(18)L(0.92)]',
            weight: 2,
        },
    ],
    S: [
        {
            right: ['P'],
            rule: 'F(0.78,0.86)S(0.72,0.8)[+(12)L(0.78)]',
            weight: 2,
        },
        {
            right: ['L'],
            rule: 'F(0.92,0.9)S(0.86,0.86)[+(16)L(0.92)]',
            weight: 2,
        },
        { rule: 'F(0.96,0.92)[+(18)S(0.8,0.84)][-(18)S(0.8,0.84)]', weight: 1 },
        { rule: 'F(0.94,0.9)S(0.88,0.88)', weight: 1 },
    ],
};

const herbBase: PlantDefinition = {
    name: 'Herb Base',
    axiom: 'F',
    rules: herbRules,
    angle: 24,
    height: 0.62,
    branching: 1,
    directionVariability: 0.16,
    stem: {
        color: '#688741',
        radius: 0.017,
        length: 0.075,
        radiusDecay: 0.55,
        minRadius: 0.002,
    },
    leaf: {
        color: '#5f8a2f',
        size: 0.14,
        type: 'oval',
        density: 2,
        hangAngle: 25,
        hangAngleRandomness: 20,
        sizeDecay: 0.45,
    },
    flower: {
        enabled: true,
        ageStart: 8,
        color: '#f2ecd1',
        size: 0.05,
    },
    vegetable: {
        enabled: false,
        ageStart: 0,
        type: 'tomato',
        yield: 0,
        baseSize: 0.12,
    },
};

export const herbPlants = {
    basil: createPlant({
        ...herbBase,
        name: 'Bosiljak',
        height: 0.56,
        leaf: {
            ...herbBase.leaf,
            color: '#72a13d',
            size: 0.18,
            type: 'oval',
        },
        flower: {
            ...herbBase.flower,
            color: '#f6f2df',
        },
    }),
    dill: createPlant({
        ...herbBase,
        name: 'Kopar',
        height: 0.82,
        stem: {
            ...herbBase.stem,
            color: '#769b49',
            length: 0.09,
        },
        leaf: {
            ...herbBase.leaf,
            color: '#89b658',
            size: 0.12,
            type: 'compound',
            density: 3,
        },
        flower: {
            ...herbBase.flower,
            ageStart: 9,
            color: '#ecd75b',
        },
    }),
    coriander: createPlant({
        ...herbBase,
        name: 'Korijandar',
        height: 0.58,
        leaf: {
            ...herbBase.leaf,
            size: 0.15,
            type: 'compound',
        },
        flower: {
            ...herbBase.flower,
            color: '#ffffff',
        },
    }),
    lovage: createPlant({
        ...herbBase,
        name: 'Ljupčac',
        height: 0.92,
        stem: {
            ...herbBase.stem,
            length: 0.09,
            radius: 0.019,
        },
        leaf: {
            ...herbBase.leaf,
            size: 0.17,
            type: 'compound',
        },
        flower: {
            ...herbBase.flower,
            enabled: false,
            size: 0,
        },
    }),
    oregano: createPlant({
        ...herbBase,
        name: 'Origano',
        height: 0.42,
        branching: 1.2,
        leaf: {
            ...herbBase.leaf,
            size: 0.1,
            type: 'oval',
        },
        flower: {
            ...herbBase.flower,
            color: '#c6a2da',
        },
    }),
    parsley: createPlant({
        ...herbBase,
        name: 'Peršin',
        height: 0.5,
        leaf: {
            ...herbBase.leaf,
            size: 0.16,
            type: 'compound',
        },
        flower: {
            ...herbBase.flower,
            enabled: false,
            size: 0,
        },
    }),
    thyme: createPlant({
        ...herbBase,
        name: 'Timijan',
        height: 0.26,
        branching: 1.4,
        stem: {
            ...herbBase.stem,
            radius: 0.012,
            length: 0.05,
        },
        leaf: {
            ...herbBase.leaf,
            size: 0.08,
            type: 'round',
            density: 3,
        },
        flower: {
            ...herbBase.flower,
            ageStart: 9,
            color: '#b997de',
            size: 0.04,
        },
    }),
};
