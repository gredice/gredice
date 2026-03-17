import type { PlantDefinition } from '../plant-definition-types';
import { createPlant } from './helpers';

const fennelBase: PlantDefinition = {
    name: 'Komorač',
    axiom: 'P(1.02)[^(72)F(1.08,1.04)][^(36)F(0.94,0.96)]',
    rules: {
        F: [
            {
                rule: 'F(1.06,1.02)[+(14)L(0.98)][-(14)L(0.98)][^(10)L(0.92)]',
                weight: 2,
            },
            {
                rule: 'F(0.94,0.98)[^(12)L(0.9)][&(12)L(0.9)]',
                weight: 1,
            },
        ],
        L: [
            {
                left: ['F'],
                rule: '[+(12)F(0.78,0.82)L(0.92)][-(12)F(0.78,0.82)L(0.92)]F(0.86,0.88)L(0.96)',
                weight: 2,
            },
            {
                rule: '[+(10)F(0.74,0.78)^(10)L(0.88)][-(10)F(0.74,0.78)&(10)L(0.88)]F(0.82,0.86)L(0.92)',
                weight: 1,
            },
        ],
    },
    angle: 16,
    height: 0.86,
    branching: 0.52,
    directionVariability: 0.06,
    stem: {
        color: '#7aa24d',
        radius: 0.018,
        length: 0.11,
        radiusDecay: 0.55,
        minRadius: 0.003,
    },
    leaf: {
        color: '#92b95d',
        size: 0.12,
        type: 'compound',
        density: 3,
        hangAngle: 12,
        hangAngleRandomness: 8,
        sizeDecay: 0.5,
    },
    flower: {
        enabled: false,
        ageStart: 0,
        color: '#ffffff',
        size: 0,
    },
    vegetable: {
        enabled: true,
        ageStart: 6,
        type: 'fennel',
        yield: 1,
        baseSize: 0.24,
    },
};

export const aromaticPlants = {
    fennel: createPlant(fennelBase),
};
