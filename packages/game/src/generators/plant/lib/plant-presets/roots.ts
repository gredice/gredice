import type { PlantDefinition } from '../plant-definition-types';
import { createPlant } from './helpers';

const rootRules: PlantDefinition['rules'] = {
    F: [
        {
            rule: 'F(1.06,1.02)[+(16)J(1.04)][-(16)J(1.04)][^(10)J(0.96)]',
            weight: 3,
        },
        {
            rule: 'F(1,1)[+(14)J(1.02)][-(14)J(1.02)]',
            weight: 2,
        },
        {
            rule: 'F(0.92,0.98)[^(12)J(0.94)][&(12)J(0.94)]',
            weight: 1,
        },
    ],
};

const rootBase: Omit<PlantDefinition, 'name' | 'vegetable'> = {
    axiom: 'R(1.08)[^(0)F(1.08,1.06)][^(54)F(0.96,0.98)]',
    rules: rootRules,
    angle: 18,
    height: 0.68,
    branching: 0.42,
    directionVariability: 0.07,
    stem: {
        color: '#426d1b',
        radius: 0.022,
        length: 0.085,
        radiusDecay: 0.8,
        minRadius: 0.002,
    },
    leaf: {
        color: '#4f8b29',
        size: 0.18,
        type: 'compound',
        density: 2,
        hangAngle: 15,
        hangAngleRandomness: 10,
        sizeDecay: 0.6,
    },
    flower: {
        enabled: false,
        ageStart: 0,
        color: '#ffffff',
        size: 0,
    },
};

export const rootPlants = {
    carrot: createPlant({
        ...rootBase,
        name: 'Mrkva',
        height: 0.72,
        branching: 0.45,
        directionVariability: 0.08,
        stem: {
            ...rootBase.stem,
            color: '#3b6718',
            radius: 0.024,
            length: 0.09,
        },
        leaf: {
            ...rootBase.leaf,
            density: 3,
        },
        vegetable: {
            enabled: true,
            ageStart: 5,
            type: 'carrot',
            yield: 1,
            baseSize: 0.2,
        },
    }),
    beet: createPlant({
        ...rootBase,
        name: 'Cikla',
        axiom: 'R(1.08)[^(72)F(1.04,1.04)][^(36)F(0.92,0.96)]',
        angle: 16,
        height: 0.62,
        stem: {
            ...rootBase.stem,
            color: '#7d3c47',
            radius: 0.024,
        },
        leaf: {
            ...rootBase.leaf,
            color: '#5b8a34',
            size: 0.21,
            type: 'heart',
            density: 2,
            hangAngle: 22,
        },
        vegetable: {
            enabled: true,
            ageStart: 4,
            type: 'beet',
            yield: 1,
            baseSize: 0.27,
        },
    }),
    radish: createPlant({
        ...rootBase,
        name: 'Rotkvica',
        axiom: 'R(1.04)[^(72)F(0.96,0.98)]',
        angle: 16,
        height: 0.46,
        branching: 0.35,
        stem: {
            ...rootBase.stem,
            color: '#4b6f20',
            radius: 0.018,
            length: 0.07,
        },
        leaf: {
            ...rootBase.leaf,
            size: 0.15,
            type: 'serrated',
            density: 2,
        },
        vegetable: {
            enabled: true,
            ageStart: 3,
            type: 'radish',
            yield: 1,
            baseSize: 0.18,
        },
    }),
    turnip: createPlant({
        ...rootBase,
        name: 'Repa',
        axiom: 'R(1.06)[^(72)F(1,1)][^(36)F(0.92,0.96)]',
        angle: 18,
        height: 0.58,
        branching: 0.38,
        leaf: {
            ...rootBase.leaf,
            size: 0.19,
            type: 'oval',
            density: 2,
        },
        vegetable: {
            enabled: true,
            ageStart: 5,
            type: 'turnip',
            yield: 1,
            baseSize: 0.25,
        },
    }),
};
