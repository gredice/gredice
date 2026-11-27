import { defaultGameWoodColor } from './woodPalette';

export const arrowSignDirections = ['Left', 'Right', 'Up', 'Down'] as const;
export const arrowSignColors = [
    'White',
    'Red',
    'Blue',
    'Green',
    'Wood',
] as const;

export type ArrowSignDirection = (typeof arrowSignDirections)[number];
export type ArrowSignColor = (typeof arrowSignColors)[number];

export type ArrowSignConfig = {
    color: ArrowSignColor;
    colorHex: string;
    direction: ArrowSignDirection;
    faceRotation: number;
    name: string;
};

// Albedo, not the colour players see: a sunlit face shows about 3.2 times
// it after tone mapping (GAME_ART.md). The comments give the on-screen colour.
const arrowSignColorHex = {
    // Warm off-white paint, #f6e5c4 by the formula, the same as the white
    // fences. Authored this warm because the cool sky fill desaturates it.
    White: '#aa9e86',
    // Ripe red role, #f23b2c on screen.
    Red: '#9c241b',
    // Clear blue, #3d9df0 on screen.
    Blue: '#2b6498',
    // Canopy green role, #43b93a on screen.
    Green: '#30712c',
    Wood: defaultGameWoodColor,
} satisfies Record<ArrowSignColor, string>;

export const arrowSignFallbackColorHex = arrowSignColorHex.White;
// Painted plaques sit in the satin band.
export const arrowSignPaintRoughness = 0.55;

const arrowSignFaceRotation = {
    Left: Math.PI,
    Right: 0,
    Up: Math.PI / 2,
    Down: -Math.PI / 2,
} satisfies Record<ArrowSignDirection, number>;

export const arrowSignNames = [
    'ArrowSignWhiteLeft',
    'ArrowSignRedLeft',
    'ArrowSignBlueLeft',
    'ArrowSignGreenLeft',
    'ArrowSignWoodLeft',
    'ArrowSignWhiteRight',
    'ArrowSignRedRight',
    'ArrowSignBlueRight',
    'ArrowSignGreenRight',
    'ArrowSignWoodRight',
    'ArrowSignWhiteUp',
    'ArrowSignRedUp',
    'ArrowSignBlueUp',
    'ArrowSignGreenUp',
    'ArrowSignWoodUp',
    'ArrowSignWhiteDown',
    'ArrowSignRedDown',
    'ArrowSignBlueDown',
    'ArrowSignGreenDown',
    'ArrowSignWoodDown',
] as const;

export type ArrowSignName = (typeof arrowSignNames)[number];

function createArrowSignConfig(
    name: ArrowSignName,
    color: ArrowSignColor,
    direction: ArrowSignDirection,
): ArrowSignConfig {
    return {
        color,
        colorHex: arrowSignColorHex[color],
        direction,
        faceRotation: arrowSignFaceRotation[direction],
        name,
    };
}

export const arrowSignConfigs = [
    createArrowSignConfig('ArrowSignWhiteLeft', 'White', 'Left'),
    createArrowSignConfig('ArrowSignRedLeft', 'Red', 'Left'),
    createArrowSignConfig('ArrowSignBlueLeft', 'Blue', 'Left'),
    createArrowSignConfig('ArrowSignGreenLeft', 'Green', 'Left'),
    createArrowSignConfig('ArrowSignWoodLeft', 'Wood', 'Left'),
    createArrowSignConfig('ArrowSignWhiteRight', 'White', 'Right'),
    createArrowSignConfig('ArrowSignRedRight', 'Red', 'Right'),
    createArrowSignConfig('ArrowSignBlueRight', 'Blue', 'Right'),
    createArrowSignConfig('ArrowSignGreenRight', 'Green', 'Right'),
    createArrowSignConfig('ArrowSignWoodRight', 'Wood', 'Right'),
    createArrowSignConfig('ArrowSignWhiteUp', 'White', 'Up'),
    createArrowSignConfig('ArrowSignRedUp', 'Red', 'Up'),
    createArrowSignConfig('ArrowSignBlueUp', 'Blue', 'Up'),
    createArrowSignConfig('ArrowSignGreenUp', 'Green', 'Up'),
    createArrowSignConfig('ArrowSignWoodUp', 'Wood', 'Up'),
    createArrowSignConfig('ArrowSignWhiteDown', 'White', 'Down'),
    createArrowSignConfig('ArrowSignRedDown', 'Red', 'Down'),
    createArrowSignConfig('ArrowSignBlueDown', 'Blue', 'Down'),
    createArrowSignConfig('ArrowSignGreenDown', 'Green', 'Down'),
    createArrowSignConfig('ArrowSignWoodDown', 'Wood', 'Down'),
] satisfies ArrowSignConfig[];

const arrowSignConfigByName: ReadonlyMap<string, ArrowSignConfig> = new Map(
    arrowSignConfigs.map((config) => [config.name, config]),
);

export function getArrowSignConfig(name: string) {
    return arrowSignConfigByName.get(name) ?? null;
}
