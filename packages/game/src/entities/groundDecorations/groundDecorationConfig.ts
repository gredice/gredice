export type GroundDecorationSurface = 'grass' | 'sand';

type GroundDecorationOptions = {
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
        baseY: 0.04,
        clusterChance: 0.22,
        heightRange: [0.32, 0.44],
        maxCount: 2,
        minDistance: 0.17,
        opacityRange: [0.92, 1],
        positionRange: 0.28,
        spawnChance: 0.8,
    },
    sand: {
        baseY: 0.035,
        clusterChance: 0.08,
        heightRange: [0.22, 0.32],
        maxCount: 2,
        minDistance: 0.2,
        opacityRange: [0.88, 0.98],
        positionRange: 0.26,
        spawnChance: 0.42,
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
