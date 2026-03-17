import type { PlantDefinition } from '../plant-definition-types';
import { createPlant } from './helpers';

const alliumRules: PlantDefinition['rules'] = {
    F: [
        { rule: 'F(1.08,1.02)[+(8)F(0.82,0.86)]', weight: 1 },
        { rule: 'F(1.08,1.02)[-(8)F(0.82,0.86)]', weight: 1 },
        { rule: 'F(1.02,1)', weight: 2 },
    ],
};

const alliumBase: Omit<PlantDefinition, 'name' | 'vegetable'> = {
    axiom: 'R(1.04)[^(72)F(1.18,1.08)]',
    rules: alliumRules,
    angle: 15,
    height: 1.02,
    branching: 0.5,
    directionVariability: 0.02,
    stem: {
        color: '#5d9540',
        radius: 0.015,
        length: 0.19,
        radiusDecay: 0.24,
        minRadius: 0.008,
    },
    leaf: {
        color: '#5d9540',
        size: 0,
        type: 'round',
        density: 0,
        hangAngle: 0,
        hangAngleRandomness: 0,
        sizeDecay: 0,
    },
    flower: {
        enabled: false,
        ageStart: 0,
        color: '#ffffff',
        size: 0,
    },
};

export const alliumPlants = {
    onion: createPlant({
        ...alliumBase,
        name: 'Luk',
        vegetable: {
            enabled: true,
            ageStart: 5,
            type: 'onion',
            yield: 1,
            baseSize: 0.22,
        },
    }),
    garlic: createPlant({
        ...alliumBase,
        name: 'Češnjak',
        height: 0.92,
        stem: {
            ...alliumBase.stem,
            color: '#719f52',
        },
        vegetable: {
            enabled: true,
            ageStart: 5,
            type: 'garlic',
            yield: 1,
            baseSize: 0.18,
        },
    }),
    leek: createPlant({
        ...alliumBase,
        name: 'Poriluk',
        height: 1.1,
        stem: {
            ...alliumBase.stem,
            color: '#648f42',
            radius: 0.018,
            length: 0.21,
            minRadius: 0.01,
        },
        vegetable: {
            enabled: true,
            ageStart: 6,
            type: 'leek',
            yield: 1,
            baseSize: 0.24,
        },
    }),
    chives: createPlant({
        ...alliumBase,
        name: 'Luk vlasac',
        axiom: 'F(1.02,1)[+(12)F(0.92,0.94)][-(12)F(0.92,0.94)]',
        angle: 12,
        height: 0.74,
        branching: 0.76,
        stem: {
            ...alliumBase.stem,
            color: '#5c9c49',
            radius: 0.01,
            length: 0.16,
            minRadius: 0.004,
        },
        flower: {
            enabled: true,
            ageStart: 8,
            color: '#bf9cff',
            size: 0.065,
        },
        vegetable: {
            enabled: false,
            ageStart: 0,
            type: 'onion',
            yield: 0,
            baseSize: 0.12,
        },
    }),
};
