export const arrowSignDirections = ['Left', 'Right', 'Up', 'Down'] as const;
export const arrowSignColors = ['White', 'Red', 'Blue', 'Green'] as const;

export type ArrowSignDirection = (typeof arrowSignDirections)[number];
export type ArrowSignColor = (typeof arrowSignColors)[number];

export type ArrowSignConfig = {
    color: ArrowSignColor;
    colorHex: string;
    direction: ArrowSignDirection;
    faceRotation: number;
    name: string;
};

const arrowSignColorHex = {
    White: '#f4ead7',
    Red: '#c9574d',
    Blue: '#4f83a6',
    Green: '#548460',
} satisfies Record<ArrowSignColor, string>;

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
    'ArrowSignWhiteRight',
    'ArrowSignRedRight',
    'ArrowSignBlueRight',
    'ArrowSignGreenRight',
    'ArrowSignWhiteUp',
    'ArrowSignRedUp',
    'ArrowSignBlueUp',
    'ArrowSignGreenUp',
    'ArrowSignWhiteDown',
    'ArrowSignRedDown',
    'ArrowSignBlueDown',
    'ArrowSignGreenDown',
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
    createArrowSignConfig('ArrowSignWhiteRight', 'White', 'Right'),
    createArrowSignConfig('ArrowSignRedRight', 'Red', 'Right'),
    createArrowSignConfig('ArrowSignBlueRight', 'Blue', 'Right'),
    createArrowSignConfig('ArrowSignGreenRight', 'Green', 'Right'),
    createArrowSignConfig('ArrowSignWhiteUp', 'White', 'Up'),
    createArrowSignConfig('ArrowSignRedUp', 'Red', 'Up'),
    createArrowSignConfig('ArrowSignBlueUp', 'Blue', 'Up'),
    createArrowSignConfig('ArrowSignGreenUp', 'Green', 'Up'),
    createArrowSignConfig('ArrowSignWhiteDown', 'White', 'Down'),
    createArrowSignConfig('ArrowSignRedDown', 'Red', 'Down'),
    createArrowSignConfig('ArrowSignBlueDown', 'Blue', 'Down'),
    createArrowSignConfig('ArrowSignGreenDown', 'Green', 'Down'),
] satisfies ArrowSignConfig[];

const arrowSignConfigByName: ReadonlyMap<string, ArrowSignConfig> = new Map(
    arrowSignConfigs.map((config) => [config.name, config]),
);

export function getArrowSignConfig(name: string) {
    return arrowSignConfigByName.get(name) ?? null;
}
