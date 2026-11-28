import { Vector3 } from 'three';
import type { Block } from '../../types/Block';
import type { GardenStack, Stack } from '../../types/Stack';
import type { ExpandCell } from './expandPointer';

/** The id of the copy Expand would place on `cell`. */
export function getExpandGhostBlockId(cell: ExpandCell) {
    return `block-expand-ghost:${cell.x}|${cell.z}`;
}

/** A copy Expand would place: its block, cell and stack in the world. */
export type ExpandGhostCopy = {
    block: Block;
    cell: ExpandCell;
    /** The copy's stack in `ExpandGhostWorld.stacks`, the copy on top. */
    stack: Stack;
};

/**
 * The garden around an Expand rectangle as it will be once the batch lands:
 * every copy on top of its cell's stack (a new stack on an empty cell).
 */
export type ExpandGhostWorld = {
    copies: ExpandGhostCopy[];
    /** The garden's stacks within `reach` of the rectangle, copies added. */
    stacks: Stack[];
};

/**
 * Builds the garden around the rectangle as it will be after the batch, for
 * the copies' looks that follow their neighbours (the shared terrain rim,
 * fences, shade and water). Only stacks within `reach` cells of the
 * rectangle are kept; they are new objects, the garden's are untouched.
 */
export function createExpandGhostWorld({
    blockName,
    cells,
    reach,
    rotation,
    stacks,
}: {
    blockName: string;
    /** Cells that get a copy (the plan's placements). */
    cells: readonly ExpandCell[];
    /** How many cells around the rectangle the world keeps. */
    reach: number;
    rotation: number;
    stacks: readonly GardenStack[] | null | undefined;
}): ExpandGhostWorld {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    const pending = new Map<string, { block: Block; cell: ExpandCell }>();
    for (const cell of cells) {
        minX = Math.min(minX, cell.x);
        maxX = Math.max(maxX, cell.x);
        minZ = Math.min(minZ, cell.z);
        maxZ = Math.max(maxZ, cell.z);
        pending.set(`${cell.x}|${cell.z}`, {
            block: {
                id: getExpandGhostBlockId(cell),
                name: blockName,
                rotation,
            },
            cell,
        });
    }

    const world: ExpandGhostWorld = { copies: [], stacks: [] };
    for (const stack of stacks ?? []) {
        const { x, y, z } = stack.position;
        if (
            x < minX - reach ||
            x > maxX + reach ||
            z < minZ - reach ||
            z > maxZ + reach
        ) {
            continue;
        }
        const key = `${x}|${z}`;
        const copy = pending.get(key);
        pending.delete(key);
        const areaStack: Stack = {
            position: new Vector3(x, y, z),
            blocks: copy ? [...stack.blocks, copy.block] : stack.blocks,
        };
        world.stacks.push(areaStack);
        if (copy) {
            world.copies.push({ ...copy, stack: areaStack });
        }
    }
    for (const copy of pending.values()) {
        const areaStack: Stack = {
            position: new Vector3(copy.cell.x, 0, copy.cell.z),
            blocks: [copy.block],
        };
        world.stacks.push(areaStack);
        world.copies.push({ ...copy, stack: areaStack });
    }
    return world;
}
