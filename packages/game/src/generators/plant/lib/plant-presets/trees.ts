import type { PlantDefinition } from '../plant-definition-types';
import { createPlant } from './helpers';

const treeRules: PlantDefinition['rules'] = {
    F: [
        {
            rule: 'F(1.08,1.06)S(1,0.94)[+(24)S(0.86,0.8)][-(22)S(0.86,0.8)]',
            weight: 3,
        },
        {
            rule: 'F(1.04,1.02)S(0.94,0.9)[^(20)S(0.82,0.76)][&(18)S(0.82,0.76)]',
            weight: 2,
        },
        { rule: 'F(0.98,0.98)S(0.9,0.88)', weight: 1 },
    ],
    S: [
        {
            right: ['L'],
            rule: 'F(0.9,0.82)S(0.78,0.72)[+(18)L(0.92)][-(18)L(0.88)]',
            weight: 2,
        },
        {
            rule: 'F(0.88,0.8)S(0.74,0.7)[+(26)L(1.02)][-(24)L(0.96)]',
            weight: 3,
        },
        { rule: 'F(0.78,0.72)[+(18)L(0.86)][-(16)L(0.82)]', weight: 2 },
        { rule: 'F(0.72,0.68)L(0.76)', weight: 1 },
    ],
};

const treeBase: PlantDefinition = {
    name: 'Tree Base',
    axiom: 'F(1.24,1.36)',
    rules: treeRules,
    angle: 22,
    height: 1.58,
    branching: 0.92,
    directionVariability: 0.06,
    stem: {
        color: '#7c5b35',
        radius: 0.09,
        length: 0.14,
        radiusDecay: 0.34,
        minRadius: 0.008,
        surface: 'bark',
        detailColor: '#5a4022',
        detailStrength: 0.38,
        detailScale: 18,
    },
    leaf: {
        color: '#618637',
        size: 0.24,
        type: 'oval',
        density: 2,
        hangAngle: 24,
        hangAngleRandomness: 10,
        sizeDecay: 0.28,
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
        type: 'tomato',
        yield: 0,
        baseSize: 0.16,
    },
};

export const treePlants = {
    figtree: createPlant({
        ...treeBase,
        name: 'Smokva',
        height: 1.42,
        leaf: {
            ...treeBase.leaf,
            color: '#5b7f37',
            size: 0.3,
            type: 'heart',
            density: 2,
        },
    }),
    olivetree: createPlant({
        ...treeBase,
        name: 'Maslina',
        height: 1.2,
        branching: 0.82,
        stem: {
            ...treeBase.stem,
            color: '#84705a',
            detailColor: '#665542',
            detailScale: 22,
        },
        leaf: {
            ...treeBase.leaf,
            color: '#7b9360',
            size: 0.16,
            density: 3,
        },
    }),
    youngappletree: createPlant({
        ...treeBase,
        name: 'Mlada jabuka',
        height: 1.34,
        leaf: {
            ...treeBase.leaf,
            color: '#6b8f3a',
            type: 'serrated',
            size: 0.22,
        },
        flower: {
            enabled: true,
            ageStart: 7,
            color: '#f7e6ef',
            size: 0.06,
        },
    }),
};
