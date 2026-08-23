import { isWaterOrSwampBlockName } from '@gredice/js/gardenBlocks';
import type { Stack } from '../../types/Stack';

export type FishingBoatNavigationGrid = ReadonlySet<string>;

const boatHalfWidth = 0.34;
const boatHalfLength = 0.72;
const hullSamples = [
    { x: 0, z: 0 },
    { x: 0, z: -boatHalfLength },
    { x: 0, z: boatHalfLength },
    { x: -boatHalfWidth, z: -boatHalfLength * 0.72 },
    { x: boatHalfWidth, z: -boatHalfLength * 0.72 },
    { x: -boatHalfWidth, z: boatHalfLength * 0.72 },
    { x: boatHalfWidth, z: boatHalfLength * 0.72 },
] as const;

function cellKey(x: number, z: number) {
    return `${Math.round(x)}|${Math.round(z)}`;
}

export function createFishingBoatNavigationGrid(
    stacks: Stack[] | undefined,
): FishingBoatNavigationGrid {
    const navigableCells = new Set<string>();
    for (const stack of stacks ?? []) {
        if (stack.blocks.some((block) => isWaterOrSwampBlockName(block.name))) {
            navigableCells.add(cellKey(stack.position.x, stack.position.z));
        }
    }
    return navigableCells;
}

export function isFishingBoatNavigablePose({
    grid,
    x,
    yaw,
    z,
}: {
    grid: FishingBoatNavigationGrid;
    x: number;
    yaw: number;
    z: number;
}) {
    const cosine = Math.cos(yaw);
    const sine = Math.sin(yaw);
    return hullSamples.every((sample) => {
        const worldX = x + sample.x * cosine + sample.z * sine;
        const worldZ = z - sample.x * sine + sample.z * cosine;
        return grid.has(cellKey(worldX, worldZ));
    });
}

export function resolveFishingBoatNavigation({
    deltaX,
    deltaZ,
    grid,
    x,
    yaw,
    z,
}: {
    deltaX: number;
    deltaZ: number;
    grid: FishingBoatNavigationGrid;
    x: number;
    yaw: number;
    z: number;
}) {
    const nextX = x + deltaX;
    const nextZ = z + deltaZ;
    if (isFishingBoatNavigablePose({ grid, x: nextX, yaw, z: nextZ })) {
        return { moved: true, x: nextX, yaw, z: nextZ };
    }

    return { moved: false, x, yaw, z };
}

export function getFishingBoatPlacementCenter({
    rotation,
    x,
    z,
}: {
    rotation: number;
    x: number;
    z: number;
}) {
    const normalizedRotation = ((Math.round(rotation) % 2) + 2) % 2;
    return normalizedRotation === 0 ? { x, z: z + 0.5 } : { x: x + 0.5, z };
}
