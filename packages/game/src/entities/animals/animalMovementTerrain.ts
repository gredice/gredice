import type { BlockData } from '@gredice/client';
import type { Stack } from '../../types/Stack';
import { getStackHeight } from '../../utils/getStackHeight';
import { getWaterBlockColumnSurfaceY } from '../waterBlockDepth';
import { waterBlockName } from '../waterBlockFoam';

export type AnimalMovementCell = {
    x: number;
    z: number;
};

export type AnimalMovementSurface = AnimalMovementCell & {
    kind: 'ground' | 'water';
    y: number;
};

const movementSurfaceHalfSize = 0.5;
const movementSurfaceEpsilon = 0.001;

const groundBlockNames = new Set([
    'Block_Ground',
    'Block_Ground_Angle',
    'Block_Ground_Corner',
    'Block_Ground_Reverse_Corner',
    'Block_Grass',
    'Block_Grass_Angle',
    'Block_Grass_Corner',
    'Block_Grass_Reverse_Corner',
    'Block_Sand',
    'Block_Sand_Angle',
    'Block_Sand_Corner',
    'Block_Sand_Reverse_Corner',
    'Block_Snow',
    'Block_Snow_Angle',
    'Block_Snow_Corner',
    'Block_Snow_Reverse_Corner',
    'Block_Snow_Falling',
]);

export function isAnimalGroundBlockName(name: string) {
    return groundBlockNames.has(name);
}

export function isAnimalWaterBlockName(name: string) {
    return name === waterBlockName;
}

function getGroundSurfaceY({
    blockData,
    groundLift,
    stack,
}: {
    blockData: BlockData[] | null | undefined;
    groundLift: number;
    stack: Stack;
}) {
    const firstNonGroundBlock = stack.blocks.find(
        (block) => !isAnimalGroundBlockName(block.name),
    );
    const firstBlock = stack.blocks[0];

    if (!firstBlock || !isAnimalGroundBlockName(firstBlock.name)) {
        return null;
    }

    const height = getStackHeight(blockData, stack, firstNonGroundBlock);
    return height > 0 ? height + groundLift : 0;
}

export function createAnimalMovementSurfaces({
    blockData,
    groundLift,
    stacks,
    swimDepth,
}: {
    blockData: BlockData[] | null | undefined;
    groundLift: number;
    stacks: Stack[] | undefined;
    swimDepth: number;
}) {
    const surfaces: AnimalMovementSurface[] = [];

    for (const stack of stacks ?? []) {
        const topBlock = stack.blocks.at(-1);
        if (!topBlock) {
            continue;
        }

        if (isAnimalWaterBlockName(topBlock.name)) {
            surfaces.push({
                kind: 'water',
                x: stack.position.x,
                y: Math.max(
                    0,
                    getWaterBlockColumnSurfaceY({
                        block: topBlock,
                        blockData,
                        stack,
                    }) - swimDepth,
                ),
                z: stack.position.z,
            });
            continue;
        }

        const y = getGroundSurfaceY({ blockData, groundLift, stack });
        if (y !== null) {
            surfaces.push({
                kind: 'ground',
                x: stack.position.x,
                y,
                z: stack.position.z,
            });
        }
    }

    return surfaces;
}

export function createAnimalBlockedCells(stacks: Stack[] | undefined) {
    const blockedCells: AnimalMovementCell[] = [];

    for (const stack of stacks ?? []) {
        const topBlock = stack.blocks.at(-1);
        if (
            !topBlock ||
            isAnimalGroundBlockName(topBlock.name) ||
            isAnimalWaterBlockName(topBlock.name)
        ) {
            continue;
        }

        blockedCells.push({
            x: Math.round(stack.position.x),
            z: Math.round(stack.position.z),
        });
    }

    return blockedCells;
}

export function getAnimalMovementSurfaceAt(
    position: AnimalMovementCell,
    surfaces: AnimalMovementSurface[],
) {
    let selectedSurface: AnimalMovementSurface | null = null;

    for (const surface of surfaces) {
        const insideSurface =
            Math.abs(position.x - surface.x) <=
                movementSurfaceHalfSize + movementSurfaceEpsilon &&
            Math.abs(position.z - surface.z) <=
                movementSurfaceHalfSize + movementSurfaceEpsilon;

        if (
            insideSurface &&
            (!selectedSurface || surface.y > selectedSurface.y)
        ) {
            selectedSurface = surface;
        }
    }

    return selectedSurface;
}

export function getAnimalMovementYAt(
    position: AnimalMovementCell,
    surfaces: AnimalMovementSurface[],
) {
    return getAnimalMovementSurfaceAt(position, surfaces)?.y ?? 0;
}

export function canAnimalSettleAt(
    position: AnimalMovementCell,
    surfaces: AnimalMovementSurface[],
) {
    return getAnimalMovementSurfaceAt(position, surfaces)?.kind !== 'water';
}

export function isAnimalSwimmingAt(
    position: AnimalMovementCell,
    surfaces: AnimalMovementSurface[],
) {
    return getAnimalMovementSurfaceAt(position, surfaces)?.kind === 'water';
}
