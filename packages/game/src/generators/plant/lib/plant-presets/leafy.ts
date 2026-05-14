import type { PlantDefinition } from '../plant-definition-types';
import { createPlant } from './helpers';

const leafyRules: PlantDefinition['rules'] = {
    F: [
        {
            rule: 'S(0.96,1.04)[+(18)L(1.12)][-(18)L(1.12)][^(12)L(1.02)]',
            weight: 3,
        },
        {
            rule: 'S(0.9,1.02)[+(14)L(1.16)][&(10)L(1.04)]',
            weight: 2,
        },
        { rule: 'S(0.82,0.98)[L(1.22)]', weight: 1 },
    ],
    S: [
        {
            right: ['L'],
            rule: 'F(0.74,0.88)[+(10)L(1.18)][-(10)L(1.18)]',
            weight: 3,
        },
        { rule: 'F(0.88,0.92)[+(14)L(1.04)]', weight: 2 },
        { rule: 'F(0.88,0.92)[-(14)L(1.04)]', weight: 1 },
        { rule: 'F(0.84,0.9)', weight: 1 },
    ],
};

const leafyBase: PlantDefinition = {
    name: 'Leafy Base',
    axiom: 'F',
    rules: leafyRules,
    angle: 28,
    height: 0.52,
    branching: 1.2,
    directionVariability: 0.14,
    stem: {
        color: '#5b7c38',
        radius: 0.018,
        length: 0.06,
        radiusDecay: 0.7,
        minRadius: 0.002,
    },
    leaf: {
        color: '#74a23f',
        size: 0.22,
        type: 'oval',
        density: 2,
        hangAngle: 35,
        hangAngleRandomness: 15,
        sizeDecay: 0.55,
    },
    flower: {
        enabled: false,
        ageStart: 0,
        color: '#ffffff',
        size: 0,
    },
    vegetable: {
        enabled: false,
        ageStart: 0,
        type: 'cabbage',
        yield: 0,
        baseSize: 0.18,
    },
};

export const leafyPlants = {
    swisschard: createPlant({
        ...leafyBase,
        name: 'Blitva',
        height: 0.6,
        stem: {
            ...leafyBase.stem,
            color: '#935f42',
            radius: 0.02,
            length: 0.07,
        },
        leaf: {
            ...leafyBase.leaf,
            color: '#6ca63c',
            size: 0.25,
            type: 'heart',
        },
    }),
    celery: createPlant({
        ...leafyBase,
        name: 'Celer',
        height: 0.78,
        branching: 1.05,
        stem: {
            ...leafyBase.stem,
            color: '#6f9154',
            radius: 0.022,
            length: 0.085,
        },
        leaf: {
            ...leafyBase.leaf,
            color: '#5e8d38',
            size: 0.16,
            type: 'compound',
            density: 2,
        },
    }),
    lettuce: createPlant({
        ...leafyBase,
        name: 'Salata',
        height: 0.34,
        branching: 1.45,
        stem: {
            ...leafyBase.stem,
            radius: 0.012,
            length: 0.04,
        },
        leaf: {
            ...leafyBase.leaf,
            color: '#8abc52',
            size: 0.26,
            type: 'round',
            density: 3,
            hangAngle: 55,
            hangAngleRandomness: 12,
        },
    }),
    spinach: createPlant({
        ...leafyBase,
        name: 'Špinat',
        height: 0.38,
        leaf: {
            ...leafyBase.leaf,
            color: '#5f9436',
            size: 0.18,
            type: 'oval',
            density: 2,
        },
    }),
    arugula: createPlant({
        ...leafyBase,
        name: 'Rukola',
        height: 0.36,
        branching: 1.32,
        leaf: {
            ...leafyBase.leaf,
            color: '#679d3b',
            size: 0.18,
            type: 'serrated',
            density: 3,
        },
    }),
    mache: createPlant({
        ...leafyBase,
        name: 'Matovilac',
        height: 0.28,
        branching: 1.38,
        stem: {
            ...leafyBase.stem,
            radius: 0.012,
            length: 0.035,
        },
        leaf: {
            ...leafyBase.leaf,
            color: '#7eae49',
            size: 0.15,
            type: 'round',
            density: 3,
            hangAngle: 50,
        },
    }),
};
