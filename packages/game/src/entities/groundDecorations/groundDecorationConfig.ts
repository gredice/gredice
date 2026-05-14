export type GroundDecorationSurface = 'grass' | 'sand';

type GroundDecorationOptions = {
    angleLiftPerUnit: number;
    baseY: number;
    clusterChance: number;
    heightRange: [number, number];
    maxCount: number;
    minDistance: number;
    opacityRange: [number, number];
    positionRange: number;
    spawnChance: number;
};

const spriteNumbers = Array.from({ length: 8 }, (_, index) =>
    String(index + 1).padStart(2, '0'),
);

export const groundDecorationAtlasBasePath =
    '/assets/sprites/decorations/ground-cover.atlas';

export const groundDecorationOptions: Record<
    GroundDecorationSurface,
    GroundDecorationOptions
> = {
    grass: {
        angleLiftPerUnit: 0.3,
        baseY: 0.16,
        clusterChance: 0.42,
        heightRange: [0.09, 0.14],
        maxCount: 5,
        minDistance: 0.17,
        opacityRange: [0.8, 0.9],
        positionRange: 0.25,
        spawnChance: 1,
    },
    sand: {
        angleLiftPerUnit: 0.3,
        baseY: 0.2,
        clusterChance: 0.1,
        heightRange: [0.09, 0.25],
        maxCount: 2,
        minDistance: 0.2,
        opacityRange: [0.8, 0.9],
        positionRange: 0.26,
        spawnChance: 1,
    },
};

const groundDecorationSprites = {
    grass: spriteNumbers.map((value) => `grass__${value}`),
    sand: spriteNumbers.map((value) => `desert__${value}`),
} satisfies Record<GroundDecorationSurface, string[]>;

export function getGroundDecorationSprites(surface: GroundDecorationSurface) {
    return groundDecorationSprites[surface];
}

export function resolveGroundDecorationSurface(
    blockName: string,
): GroundDecorationSurface | null {
    switch (blockName) {
        case 'Block_Grass':
        case 'Block_Grass_Angle':
            return 'grass';
        case 'Block_Sand':
        case 'Block_Sand_Angle':
            return 'sand';
        default:
            return null;
    }
}
