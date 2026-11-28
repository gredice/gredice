import type { BlockData } from '@gredice/client';
import {
    isTerrainRimBlockName,
    resolveTerrainRimPlacements,
    type TerrainRimPlacement,
} from '../../entities/terrainRim/terrainRimPlacements';
import type { GardenStack, Stack } from '../../types/Stack';
import { createExpandGhostWorld } from './expandGhostWorld';
import type { ExpandCell } from './expandPointer';

export { getExpandGhostBlockId } from './expandGhostWorld';

/**
 * Garden cells this far around the rectangle shape the copies' rim: a copy
 * reads its neighbours' tops (diagonals included), and a neighbour's rim run
 * that meets a copy reads the neighbours on its own far side.
 */
export const expandGhostRimNeighbourhood = 2;

/**
 * The rim the Expand copies wear once placed (spec §7.5): every copy is put
 * on top of its cell's stack and the rim is resolved against the garden
 * around the rectangle, as the garden rim will be after the batch. Copies
 * merge with each other, with the source and with level terrain beside
 * them, so only the outer edge of the new area gets a lip and body; a hole
 * the copies fill gets none. Only the copies' own pieces are returned; the
 * garden keeps drawing its own rim until the batch lands.
 */
export function resolveExpandGhostRimPlacements({
    blockData,
    blockName,
    cells,
    rotation,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    blockName: string;
    /** Cells that get a copy (the plan's placements). */
    cells: readonly ExpandCell[];
    rotation: number;
    stacks: readonly GardenStack[] | null | undefined;
}): TerrainRimPlacement<Stack>[] {
    if (!blockData || cells.length === 0 || !isTerrainRimBlockName(blockName)) {
        return [];
    }

    const world = createExpandGhostWorld({
        blockName,
        cells,
        reach: expandGhostRimNeighbourhood,
        rotation,
        stacks,
    });
    const copyIds = new Set(world.copies.map(({ block }) => block.id));
    return resolveTerrainRimPlacements(blockData, world.stacks).filter(
        (placement) => copyIds.has(placement.block.id),
    );
}

/**
 * How many rim instances the copies draw: a body piece for every placement
 * and a lip for those that carry one. The ghost layer waits for this many
 * before it stops checking the rim for late (suspended) pieces.
 */
export function countExpandGhostRimInstances(
    placements: readonly TerrainRimPlacement<Stack>[],
) {
    let count = 0;
    for (const placement of placements) {
        count += placement.hasLip ? 2 : 1;
    }
    return count;
}

/**
 * Instance buffer size for a ghost rim part: grown in powers of two, so a
 * corner drag that adds a few pieces rewrites matrices instead of making a
 * new mesh.
 */
export function getExpandGhostRimCapacity(count: number) {
    let capacity = 16;
    while (capacity < count) {
        capacity *= 2;
    }
    return capacity;
}
