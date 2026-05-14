import { SeededRNG } from '../../generators/plant/lib/rng';
import type { Block } from '../../types/Block';
import {
    type GroundDecorationSurface,
    getGroundDecorationSprites,
    groundDecorationOptions,
} from './groundDecorationConfig';

export type BlockSurfaceDecorationPlacement = {
    height: number;
    opacity: number;
    position: [number, number, number];
    spriteName: string;
};

function resolveDecorationBaseY(
    block: Block,
    options: (typeof groundDecorationOptions)[GroundDecorationSurface],
    z: number,
) {
    if (!block.name.endsWith('_Angle')) {
        return options.baseY;
    }

    return options.baseY + z * options.angleLiftPerUnit;
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
        let x = 0;
        let z = 0;

        for (let attempt = 0; attempt < 8; attempt += 1) {
            const candidateX = rng.nextRange(
                -decorationOptions.positionRange,
                decorationOptions.positionRange,
            );
            const candidateZ = rng.nextRange(
                -decorationOptions.positionRange,
                decorationOptions.positionRange,
            );
            const isTooClose = placements.some((placement) => {
                const distanceX = placement.position[0] - candidateX;
                const distanceZ = placement.position[2] - candidateZ;

                return (
                    Math.hypot(distanceX, distanceZ) <
                    decorationOptions.minDistance
                );
            });

            x = candidateX;
            z = candidateZ;

            if (!isTooClose) {
                break;
            }
        }

        placements.push({
            height: rng.nextRange(
                decorationOptions.heightRange[0],
                decorationOptions.heightRange[1],
            ),
            opacity: rng.nextRange(
                decorationOptions.opacityRange[0],
                decorationOptions.opacityRange[1],
            ),
            position: [
                x,
                resolveDecorationBaseY(block, decorationOptions, z) +
                    index * 0.002,
                z,
            ],
            spriteName: pickSpriteName(rng, surface),
        });
    }

    return placements;
}
