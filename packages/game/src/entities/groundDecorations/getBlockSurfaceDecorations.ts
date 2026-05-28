import { SeededRNG } from '../../generators/plant/lib/rng';
import type { Block } from '../../types/Block';
import {
    type GroundDecorationSurface,
    getGroundDecorationSprites,
    groundDecorationOptions,
} from './groundDecorationConfig';

export type BlockSurfaceSpriteDecorationPlacement = {
    kind: 'sprite';
    height: number;
    opacity: number;
    position: [number, number, number];
    spriteName: string;
};

export type BlockSurfaceFlowerDecorationPlacement = {
    color: string;
    kind: 'flower';
    position: [number, number, number];
    rotation: number;
    scale: number;
};

export type BlockSurfaceDecorationPlacement =
    | BlockSurfaceSpriteDecorationPlacement
    | BlockSurfaceFlowerDecorationPlacement;

const angledBlockHighEdgeX = 0.5;

function resolveDecorationBaseY(
    block: Block,
    options: (typeof groundDecorationOptions)[GroundDecorationSurface],
    x: number,
    z: number,
) {
    if (block.name.endsWith('_Reverse_Corner')) {
        return (
            options.baseY +
            (Math.max(x, z) - angledBlockHighEdgeX) * options.angleLiftPerUnit
        );
    }

    if (block.name.endsWith('_Corner')) {
        return (
            options.baseY +
            (Math.min(x, z) - angledBlockHighEdgeX) * options.angleLiftPerUnit
        );
    }

    if (!block.name.endsWith('_Angle')) {
        return options.baseY;
    }

    // baseY is tuned for the raised local +X edge of angled block meshes.
    return (
        options.baseY + (x - angledBlockHighEdgeX) * options.angleLiftPerUnit
    );
}

function getDecorationCount(
    rng: SeededRNG,
    options: (typeof groundDecorationOptions)[GroundDecorationSurface],
) {
    if (rng.nextFloat() > options.spawnChance) {
        return 0;
    }

    let count = 1;
    while (
        count < options.maxCount &&
        rng.nextFloat() < options.clusterChance
    ) {
        count += 1;
    }

    return count;
}

function pickSpriteName(rng: SeededRNG, surface: GroundDecorationSurface) {
    const sprites = getGroundDecorationSprites(surface);
    const spriteIndex = Math.min(
        sprites.length - 1,
        Math.floor(rng.nextFloat() * sprites.length),
    );

    return sprites[spriteIndex] ?? sprites[0];
}

function pickFlowerColor(
    rng: SeededRNG,
    colors: readonly string[],
): string | undefined {
    const colorIndex = Math.min(
        colors.length - 1,
        Math.floor(rng.nextFloat() * colors.length),
    );

    return colors[colorIndex];
}

function findDecorationPosition(
    rng: SeededRNG,
    options: (typeof groundDecorationOptions)[GroundDecorationSurface],
    placements: BlockSurfaceDecorationPlacement[],
) {
    let x = 0;
    let z = 0;

    for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidateX = rng.nextRange(
            -options.positionRange,
            options.positionRange,
        );
        const candidateZ = rng.nextRange(
            -options.positionRange,
            options.positionRange,
        );
        const isTooClose = placements.some((placement) => {
            if (placement.kind !== 'sprite') {
                return false;
            }

            const distanceX = placement.position[0] - candidateX;
            const distanceZ = placement.position[2] - candidateZ;

            return Math.hypot(distanceX, distanceZ) < options.minDistance;
        });

        x = candidateX;
        z = candidateZ;

        if (!isTooClose) {
            break;
        }
    }

    return { x, z };
}

function getFlowerCount(
    rng: SeededRNG,
    flowerOptions: NonNullable<
        (typeof groundDecorationOptions)[GroundDecorationSurface]['flowers']
    >,
) {
    if (rng.nextFloat() > flowerOptions.spawnChance) {
        return 0;
    }

    let count = 1;
    while (
        count < flowerOptions.maxCount &&
        rng.nextFloat() < flowerOptions.clusterChance
    ) {
        count += 1;
    }

    return count;
}

function clampToPositionRange(
    value: number,
    decorationOptions: (typeof groundDecorationOptions)[GroundDecorationSurface],
) {
    return Math.max(
        -decorationOptions.positionRange,
        Math.min(decorationOptions.positionRange, value),
    );
}

function getFlowerPlacements({
    block,
    decorationIndex,
    decorationOptions,
    rng,
    x,
    z,
}: {
    block: Block;
    decorationIndex: number;
    decorationOptions: (typeof groundDecorationOptions)[GroundDecorationSurface];
    rng: SeededRNG;
    x: number;
    z: number;
}): BlockSurfaceFlowerDecorationPlacement[] {
    const flowerOptions = decorationOptions.flowers;
    if (!flowerOptions) {
        return [];
    }

    const count = getFlowerCount(rng, flowerOptions);
    if (count < 1) {
        return [];
    }

    const flowers: BlockSurfaceFlowerDecorationPlacement[] = [];

    for (let index = 0; index < count; index += 1) {
        let flowerX = x;
        let flowerZ = z;

        for (let attempt = 0; attempt < 8; attempt += 1) {
            const candidateX = clampToPositionRange(
                x + rng.nextRange(-flowerOptions.spread, flowerOptions.spread),
                decorationOptions,
            );
            const candidateZ = clampToPositionRange(
                z + rng.nextRange(-flowerOptions.spread, flowerOptions.spread),
                decorationOptions,
            );
            const isTooClose = flowers.some((flower) => {
                const distanceX = flower.position[0] - candidateX;
                const distanceZ = flower.position[2] - candidateZ;

                return (
                    Math.hypot(distanceX, distanceZ) < flowerOptions.minDistance
                );
            });

            flowerX = candidateX;
            flowerZ = candidateZ;

            if (!isTooClose) {
                break;
            }
        }

        const color = pickFlowerColor(rng, flowerOptions.colors);
        if (!color) {
            continue;
        }

        flowers.push({
            color,
            kind: 'flower',
            position: [
                flowerX,
                resolveDecorationBaseY(
                    block,
                    decorationOptions,
                    flowerX,
                    flowerZ,
                ) +
                    decorationIndex * 0.002 +
                    0.01 +
                    index * 0.001,
                flowerZ,
            ],
            rotation: rng.nextRange(0, Math.PI * 2),
            scale: rng.nextRange(
                flowerOptions.scaleRange[0],
                flowerOptions.scaleRange[1],
            ),
        });
    }

    return flowers;
}

export function getBlockSurfaceDecorations(options: {
    block: Block;
    density?: number;
    gardenId: number | null | undefined;
    surface: GroundDecorationSurface;
}) {
    const { block, density = 1, gardenId, surface } = options;
    if (density <= 0) {
        return [] as BlockSurfaceDecorationPlacement[];
    }

    const decorationOptions = groundDecorationOptions[surface];
    const rng = new SeededRNG(`${gardenId ?? 'garden'}:${block.id}:${surface}`);
    const baseCount = getDecorationCount(rng, decorationOptions);
    const count =
        baseCount > 0
            ? Math.max(1, Math.min(baseCount, Math.floor(baseCount * density)))
            : 0;

    if (count < 1) {
        return [] as BlockSurfaceDecorationPlacement[];
    }

    const placements: BlockSurfaceDecorationPlacement[] = [];

    for (let index = 0; index < count; index += 1) {
        const { x, z } = findDecorationPosition(
            rng,
            decorationOptions,
            placements,
        );
        const height = rng.nextRange(
            decorationOptions.heightRange[0],
            decorationOptions.heightRange[1],
        );
        const opacity = rng.nextRange(
            decorationOptions.opacityRange[0],
            decorationOptions.opacityRange[1],
        );
        const position: [number, number, number] = [
            x,
            resolveDecorationBaseY(block, decorationOptions, x, z) +
                index * 0.002,
            z,
        ];
        const spriteName = pickSpriteName(rng, surface);
        const flowerRng = new SeededRNG(
            `${gardenId ?? 'garden'}:${block.id}:${surface}:flowers:${index}:${x.toFixed(3)}:${z.toFixed(3)}`,
        );

        placements.push({
            height,
            kind: 'sprite',
            opacity,
            position,
            spriteName,
        });
        placements.push(
            ...getFlowerPlacements({
                block,
                decorationIndex: index,
                decorationOptions,
                rng: flowerRng,
                x,
                z,
            }),
        );
    }

    return placements;
}
