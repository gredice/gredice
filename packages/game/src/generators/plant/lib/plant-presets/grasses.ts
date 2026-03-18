import type { PlantDefinition } from '../plant-definition-types';
import { createPlant } from './helpers';

const grassRules: PlantDefinition['rules'] = {
    F: [
        { rule: 'F(1.06,1)[+(4)F(0.92,0.9)]', weight: 2 },
        { rule: 'F(1.04,0.98)[-(4)F(0.9,0.88)]', weight: 2 },
        { rule: 'F(1.02,0.96)', weight: 1 },
    ],
};

const grassBase: PlantDefinition = {
    name: 'Grass Base',
    axiom: '[^(76)F(1.18,1)][+(10)^(72)F(1.12,0.98)][-(10)^(72)F(1.12,0.98)][/(12)^(68)F(1.04,0.94)][\\(12)^(68)F(1.04,0.94)]',
    rules: grassRules,
    angle: 8,
    height: 0.76,
    branching: 0.56,
    directionVariability: 0.05,
    stem: {
        color: '#6b9442',
        radius: 0.01,
        length: 0.16,
        radiusDecay: 0.16,
        minRadius: 0.003,
    },
    leaf: {
        color: '#6f9a43',
        size: 0,
        type: 'oval',
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
    vegetable: {
        enabled: false,
        ageStart: 0,
        type: 'tomato',
        yield: 0,
        baseSize: 0.12,
    },
};

export const grassPlants = {
    lemongrass: createPlant({
        ...grassBase,
        name: 'Limunska trava',
        height: 0.92,
        angle: 10,
        stem: {
            ...grassBase.stem,
            color: '#79a44a',
            radius: 0.012,
            length: 0.2,
        },
    }),
    wheatgrass: createPlant({
        ...grassBase,
        name: 'Pšenična trava',
        height: 0.44,
        branching: 0.68,
        stem: {
            ...grassBase.stem,
            color: '#82ac4c',
            radius: 0.008,
            length: 0.11,
            minRadius: 0.002,
        },
    }),
    ornamentalgrass: createPlant({
        ...grassBase,
        name: 'Ukrasna trava',
        height: 1.08,
        angle: 12,
        directionVariability: 0.08,
        stem: {
            ...grassBase.stem,
            color: '#5f8740',
            radius: 0.011,
            length: 0.22,
        },
    }),
};
