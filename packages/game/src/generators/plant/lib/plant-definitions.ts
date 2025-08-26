/**
 * This file defines the structure and presets for procedural plants.
 *
 * --- L-System Symbols ---
 * - F, S: Draw a stem segment.
 * - L: Draw a leaf.
 * - P: A potential point for producing a flower or vegetable.
 * - R: A root vegetable (special case, placed at origin).
 * - +,-: Yaw left/right.
 * - &,^: Pitch down/up.
 * - /,\: Roll right/left.
 * - [,]: Push/pop state (for branching).
 */

export type VegetableType =
    | 'tomato'
    | 'cucumber'
    | 'bellpepper'
    | 'carrot'
    | 'onion';
export type Rule = string | { rule: string; weight: number }[];

export interface PlantDefinition {
    name: string;
    axiom: string;
    rules: Record<string, Rule>;
    angle: number;
    height: number;
    branching: number;
    directionVariability: number;
    stem: {
        color: string;
        radius: number; // Max radius multiplier
        length: number;
        radiusDecay: number; // How quickly radius decreases with distance from root
        minRadius: number; // Minimum radius for any stem segment
    };
    leaf: {
        color: string;
        size: number; // Max size
        type: 'round' | 'oval' | 'heart' | 'serrated' | 'compound';
        density: number;
        hangAngle: number;
        hangAngleRandomness: number;
        sizeDecay: number; // How quickly leaf size decreases with distance from root
    };
    flower: {
        enabled: boolean;
        ageStart: number; // Generation when flowering starts
        color: string;
        size: number;
    };
    vegetable: {
        enabled: boolean;
        ageStart: number; // Generation when fruiting starts
        type: VegetableType;
        yield: number;
        baseSize: number;
    };
}

export const plantTypes: Record<string, PlantDefinition> = {
    tomato: {
        name: 'Tomato Plant',
        axiom: 'F',
        rules: {
            F: [
                { rule: 'S[+L][^P][-L][&P]', weight: 3 },
                { rule: 'S[++L][--L][^P]', weight: 2 },
                { rule: 'S[+F][-F]', weight: 2 },
                { rule: 'S[&F][^F]', weight: 1 },
                { rule: 'S', weight: 1 },
            ],
            S: [
                { rule: 'FS[+L]', weight: 2 },
                { rule: 'FS', weight: 1 },
                { rule: 'F[+S][-S]', weight: 1 },
            ],
        },
        angle: 25,
        height: 1.2,
        branching: 1.3,
        directionVariability: 0.15,
        stem: {
            color: '#5a6e2a',
            radius: 0.05,
            length: 0.08,
            radiusDecay: 0.5,
            minRadius: 0.005,
        },
        leaf: {
            color: '#3d5a1a',
            size: 0.25,
            type: 'compound',
            density: 1,
            hangAngle: 45,
            hangAngleRandomness: 25,
            sizeDecay: 0.3,
        },
        flower: { enabled: true, ageStart: 3, color: '#ffff00', size: 0.08 },
        vegetable: {
            enabled: true,
            ageStart: 5,
            type: 'tomato',
            yield: 0.8,
            baseSize: 0.15,
        },
    },
    cucumber: {
        name: 'Cucumber Vine',
        axiom: 'F',
        rules: {
            F: [
                { rule: 'F[+LP]F', weight: 3 },
                { rule: 'F[-LP]F', weight: 3 },
                { rule: '[&F]', weight: 1 },
            ],
        },
        angle: 35,
        height: 0.9,
        branching: 1.1,
        directionVariability: 0.25,
        stem: {
            color: '#3d5a1a',
            radius: 0.03,
            length: 0.15,
            radiusDecay: 0.4,
            minRadius: 0.004,
        },
        leaf: {
            color: '#4a7c23',
            size: 0.4,
            type: 'heart',
            density: 1,
            hangAngle: 30,
            hangAngleRandomness: 15,
            sizeDecay: 0.5,
        },
        flower: { enabled: true, ageStart: 2, color: '#f5e642', size: 0.1 },
        vegetable: {
            enabled: true,
            ageStart: 4,
            type: 'cucumber',
            yield: 0.5,
            baseSize: 0.3,
        },
    },
    bellpepper: {
        name: 'Bell Pepper Plant',
        axiom: 'F',
        rules: {
            F: [
                { rule: 'S[+FP][-FP]', weight: 4 },
                { rule: 'S[+L][-L]', weight: 1 },
            ],
            S: 'FS',
        },
        angle: 40,
        height: 0.8,
        branching: 0.8,
        directionVariability: 0.05,
        stem: {
            color: '#4f7a28',
            radius: 0.06,
            length: 0.12,
            radiusDecay: 0.6,
            minRadius: 0.006,
        },
        leaf: {
            color: '#3a591f',
            size: 0.3,
            type: 'oval',
            density: 1,
            hangAngle: 20,
            hangAngleRandomness: 10,
            sizeDecay: 0.4,
        },
        flower: { enabled: true, ageStart: 3, color: '#ffffff', size: 0.07 },
        vegetable: {
            enabled: true,
            ageStart: 5,
            type: 'bellpepper',
            yield: 0.6,
            baseSize: 0.2,
        },
    },
    carrot: {
        name: 'Carrot',
        axiom: 'R[^^^^F]',
        rules: {
            F: 'F[+L][-L]',
            L: [
                { rule: '[+FL][-FL]FL', weight: 2 },
                { rule: '[++FL][--FL]FL', weight: 1 },
            ],
        },
        angle: 22,
        height: 0.6,
        branching: 0.3,
        directionVariability: 0.05,
        stem: {
            color: '#2d4a0f',
            radius: 0.02,
            length: 0.08,
            radiusDecay: 0.8,
            minRadius: 0.002,
        },
        leaf: {
            color: '#3d6b1a',
            size: 0.15,
            type: 'serrated',
            density: 2,
            hangAngle: 15,
            hangAngleRandomness: 10,
            sizeDecay: 0.6,
        },
        flower: { enabled: false, ageStart: 0, color: '#ffffff', size: 0 },
        vegetable: {
            enabled: true,
            ageStart: 1,
            type: 'carrot',
            yield: 1,
            baseSize: 0.25,
        },
    },
    onion: {
        name: 'Onion',
        axiom: 'R[^^^^F]',
        rules: {
            F: [
                { rule: 'F[+F]', weight: 1 },
                { rule: 'F[-F]', weight: 1 },
                { rule: 'F', weight: 2 },
            ],
        },
        angle: 15,
        height: 1.2,
        branching: 0.5,
        directionVariability: 0.02,
        stem: {
            color: '#5b9239',
            radius: 0.015,
            length: 0.2,
            radiusDecay: 0.2,
            minRadius: 0.008,
        },
        leaf: {
            color: '#5b9239',
            size: 0,
            type: 'round',
            density: 0,
            hangAngle: 0,
            hangAngleRandomness: 0,
            sizeDecay: 0,
        },
        flower: { enabled: false, ageStart: 0, color: '#ffffff', size: 0 },
        vegetable: {
            enabled: true,
            ageStart: 1,
            type: 'onion',
            yield: 1,
            baseSize: 0.2,
        },
    },
};

export const plantNames = Object.keys(plantTypes);
