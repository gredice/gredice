import type { BlockData } from '@gredice/client';
import type { Stack } from '../../types/Stack';
import { getStackHeight } from '../../utils/getStackHeight';
import { getStackBlockHeight } from '../../utils/stackHeightCore';
import { isFenceGateBlockName } from '../fenceConnections';
import { isFenceGateOpen } from '../fenceGateState';
import { getSlopedGroundNormalizedHeight } from '../groundSurfaceHeight';
import { isTerrainStairBlockName } from '../terrainStairs';
import {
    getWalkwayVisualTopOffset,
    isWalkwayBlockName,
    isWaterCoveredByWalkway,
} from '../walkwayPlacement';
import { getWaterBlockColumnSurfaceY } from '../waterBlockDepth';
import { isWaterBlockName } from '../waterBlockNames';

export type AnimalMovementCell = {
    x: number;
    z: number;
};

export type AnimalMovementSurface = AnimalMovementCell & {
    bottomY?: number;
    halfDepth?: number;
    halfWidth?: number;
    kind: 'ground' | 'water';
    rotation?: number;
    slopeBlockName?: string;
    y: number;
};

const movementSurfaceHalfSize = 0.5;
const movementSurfaceEpsilon = 0.001;
const passThroughDecorationNames = new Set([
    'HazelLightArch',
    'StoneWalkway',
    'WoodenWalkway',
]);

const groundBlockNames = new Set([
    'Block_Ground',
    'Block_Ground_Angle',
    'Block_Ground_Corner',
    'Block_Ground_Reverse_Corner',
    'Block_Dry_Ground',
    'Block_Dry_Ground_Angle',
    'Block_Dry_Ground_Corner',
    'Block_Dry_Ground_Reverse_Corner',
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
    'Block_Gravel',
    'Block_Gravel_Angle',
    'Block_Polished_Stone',
    'Block_Polished_Stone_Angle',
    'Block_Polished_Stone_Stairs',
    'Block_Polished_Stone_Stairs_Corner',
    'Block_Stone',
    'Block_Stone_Angle',
    'Block_Stone_Stairs',
    'Block_Stone_Stairs_Corner',
    'Block_Stone_Stairs_Half',
    'Block_Swamp_Ground',
    'Block_Swamp_Ground_Angle',
]);

export function isAnimalGroundBlockName(name: string) {
    return groundBlockNames.has(name);
}

export function isAnimalWaterBlockName(name: string) {
    return isWaterBlockName(name);
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
    const firstBlockingBlock = stack.blocks.find(
        (block, blockIndex) =>
            !isAnimalGroundBlockName(block.name) &&
            !isWalkwayBlockName(block.name) &&
            !isWaterCoveredByWalkway(stack, blockIndex),
    );
    const firstBlock = stack.blocks[0];

    if (!firstBlock || !isAnimalGroundBlockName(firstBlock.name)) {
        return null;
    }

    const height = getStackHeight(blockData, stack, firstBlockingBlock);
    const firstBlockingIndex = firstBlockingBlock
        ? stack.blocks.indexOf(firstBlockingBlock)
        : stack.blocks.length;
    const topWalkway = stack.blocks
        .slice(0, firstBlockingIndex)
        .findLast((block) => isWalkwayBlockName(block.name));

    if (!topWalkway) {
        return height > 0 ? height + groundLift : 0;
    }

    const walkwayIndex = stack.blocks.indexOf(topWalkway);
    const walkwayMetadataHeight = getStackBlockHeight(
        blockData,
        stack,
        topWalkway,
        walkwayIndex,
    );
    const walkwaySurfaceHeight =
        height -
        walkwayMetadataHeight +
        getWalkwayVisualTopOffset(stack, topWalkway);

    return walkwaySurfaceHeight > 0 ? walkwaySurfaceHeight + groundLift : 0;
}

function createStairMovementSurfaces({
    blockData,
    groundLift,
    stack,
    y,
}: {
    blockData: BlockData[] | null | undefined;
    groundLift: number;
    stack: Stack;
    y: number;
}): AnimalMovementSurface[] | null {
    const topBlock = stack.blocks.at(-1);
    if (
        !topBlock ||
        !isTerrainStairBlockName(topBlock.name) ||
        !stack.blocks.every((block) => isAnimalGroundBlockName(block.name))
    ) {
        return null;
    }

    const bottomHeight = getStackHeight(blockData, stack, topBlock);
    const rotation = topBlock.rotation * (Math.PI / 2);

    return [
        {
            bottomY: bottomHeight + groundLift,
            halfDepth: 0.5,
            halfWidth: 0.5,
            kind: 'ground',
            rotation,
            slopeBlockName: topBlock.name,
            x: stack.position.x,
            y,
            z: stack.position.z,
        },
    ];
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
            const stairSurfaces = createStairMovementSurfaces({
                blockData,
                groundLift,
                stack,
                y,
            });
            if (stairSurfaces) {
                surfaces.push(...stairSurfaces);
                continue;
            }

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
            isAnimalWaterBlockName(topBlock.name) ||
            passThroughDecorationNames.has(topBlock.name) ||
            (isFenceGateBlockName(topBlock.name) && isFenceGateOpen(topBlock))
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
        const rotation = surface.rotation ?? 0;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const dx = position.x - surface.x;
        const dz = position.z - surface.z;
        const localX = dx * cos - dz * sin;
        const localZ = dx * sin + dz * cos;
        const insideSurface =
            Math.abs(localX) <=
                (surface.halfWidth ?? movementSurfaceHalfSize) +
                    movementSurfaceEpsilon &&
            Math.abs(localZ) <=
                (surface.halfDepth ?? movementSurfaceHalfSize) +
                    movementSurfaceEpsilon;

        const normalizedHeight = surface.slopeBlockName
            ? getSlopedGroundNormalizedHeight(
                  surface.slopeBlockName,
                  localX,
                  localZ,
              )
            : null;
        const surfaceY =
            normalizedHeight === null || surface.bottomY === undefined
                ? surface.y
                : surface.bottomY +
                  (surface.y - surface.bottomY) * normalizedHeight;

        if (
            insideSurface &&
            (!selectedSurface || surfaceY > selectedSurface.y)
        ) {
            selectedSurface =
                surfaceY === surface.y ? surface : { ...surface, y: surfaceY };
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
    return getAnimalMovementSurfaceAt(position, surfaces)?.kind === 'ground';
}

export function isAnimalSwimmingAt(
    position: AnimalMovementCell,
    surfaces: AnimalMovementSurface[],
) {
    return getAnimalMovementSurfaceAt(position, surfaces)?.kind === 'water';
}
