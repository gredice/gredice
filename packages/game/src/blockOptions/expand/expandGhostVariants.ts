import type { BlockData } from '@gredice/client';
import {
    type BufferGeometry,
    type Material,
    type Matrix4,
    Vector3,
    type Vector4,
} from 'three';
import { isFenceBlockName } from '../../entities/fenceConnections';
import { resolveEntityNeighbors } from '../../entities/helpers/useEntityNeighbors';
import { resolveFenceConnectionState } from '../../entities/helpers/useFenceConnectionState';
import { getWaterBlockDepthSamples } from '../../entities/waterBlockDepth';
import {
    resolveWaterFoamCorners,
    resolveWaterFoamEdges,
    resolveWaterRimExposure,
} from '../../entities/waterBlockFoam';
import {
    getWaterBlockCenterY,
    getWaterBlockVisualHeight,
} from '../../entities/waterBlockHeight';
import { isWaterBlockName } from '../../entities/waterBlockNames';
import { isWaterBlockTopSurfaceVisible } from '../../entities/waterBlockSurface';
import type { Block } from '../../types/Block';
import type { GardenStack, Stack } from '../../types/Stack';
import { getStackHeight } from '../../utils/stackHeightCore';
import {
    createExpandGhostWorld,
    type ExpandGhostCopy,
} from './expandGhostWorld';
import type { ExpandCell } from './expandPointer';
import type { GhostTemplateCollection } from './ghostTemplateParts';

/**
 * Blocks whose look follows their neighbours once placed: a fence joins the
 * fences beside it (`useFenceConnectionState`), shade joins shade
 * (`useEntityNeighbors`) and water merges with water and opens its rim only
 * on exposed sides (`waterBlockFoam.ts`).
 */
export type ExpandGhostNeighbourKind = 'fence' | 'shade' | 'water';

export function getExpandGhostNeighbourKind(
    blockName: string,
): ExpandGhostNeighbourKind | null {
    if (isFenceBlockName(blockName)) {
        return 'fence';
    }
    if (blockName === 'Shade') {
        return 'shade';
    }
    if (isWaterBlockName(blockName)) {
        return 'water';
    }
    return null;
}

/** The key of the template drawn for a block that ignores its neighbours. */
export const loneExpandGhostVariantKey = 'lone';

/**
 * At most this many differently shaped templates per rectangle. A
 * rectangle of up to 10 × 10 in an open field needs nine (corners, sides
 * and the middle); only a very ragged garden around it reaches the cap.
 */
export const maxExpandGhostVariants = 32;

/**
 * What one ghost template draws: a block on a stack, reading `stacks` as
 * the garden around it (`EntityNeighborStacksContext` and the entity's
 * `stacks`). The stack stands at x 0, z 0.
 */
export type ExpandGhostVariantTemplate = {
    block: Block;
    stack: Stack;
    stacks: Stack[];
    /**
     * The height the block stands on in `stack`. The template is lowered by
     * it, so its parts start at y 0 as a lone template's do and every copy
     * is lifted to its cell's surface.
     */
    baseHeight: number;
};

/** One template and the copy cells that draw it. */
export type ExpandGhostVariant = {
    key: string;
    cells: ExpandCell[];
    template: ExpandGhostVariantTemplate;
};

/** A template of the block alone, with no neighbours and no garden. */
export function createLoneExpandGhostTemplate(
    blockName: string,
    rotation: number,
): ExpandGhostVariantTemplate {
    const block: Block = {
        id: `block-expand-template:${blockName}`,
        name: blockName,
        rotation,
    };
    const stack: Stack = { blocks: [block], position: new Vector3() };
    return { baseHeight: 0, block, stack, stacks: [stack] };
}

function formatNumber(value: number) {
    return Number.isFinite(value) ? value.toFixed(4) : String(value);
}

function formatVector(vector: Vector4) {
    return [vector.x, vector.y, vector.z, vector.w].map(formatNumber).join(',');
}

/**
 * What the entity reads from its neighbours, as a key: two copies with the
 * same key draw the same. It is built from the resolvers the entity itself
 * uses (`Fence`, `Shade`, `BlockWater`).
 */
function getNeighbourShapeKey(
    kind: ExpandGhostNeighbourKind,
    copy: ExpandGhostCopy,
    stacks: Stack[],
    blockData: BlockData[] | null | undefined,
) {
    const { block, stack } = copy;
    if (kind === 'fence') {
        const state = resolveFenceConnectionState(
            stacks,
            stack,
            block,
            block.rotation,
        );
        return [
            state.connection.shape,
            state.connection.rotation,
            state.extensionRotations.join(','),
            state.hasAdjacentFence ? 1 : 0,
        ].join('|');
    }
    if (kind === 'shade') {
        const neighbours = resolveEntityNeighbors(stacks, stack, block);
        return [neighbours.n, neighbours.e, neighbours.s, neighbours.w]
            .map((connected) => (connected ? 1 : 0))
            .join('');
    }

    const input = { block, blockData, stack, stacks };
    const rim = resolveWaterRimExposure(input);
    const baseHeight = getStackHeight(blockData, stack, block);
    return [
        formatVector(resolveWaterFoamEdges(input)),
        formatVector(resolveWaterFoamCorners(input)),
        formatVector(rim.edges),
        formatVector(rim.corners),
        formatNumber(getWaterBlockVisualHeight(input)),
        formatNumber(getWaterBlockCenterY(input) - baseHeight),
        isWaterBlockTopSurfaceVisible(input) ? 1 : 0,
        formatNumber(Math.max(...getWaterBlockDepthSamples(input))),
    ].join('|');
}

/**
 * A template for `copy`: its stack and the stacks around it, moved so the
 * copy's cell is at x 0, z 0. Heights stay as they are; the template is
 * lowered by the copy's base instead.
 */
function createNeighbourTemplate(
    copy: ExpandGhostCopy,
    stacks: Stack[],
    blockData: BlockData[] | null | undefined,
): ExpandGhostVariantTemplate {
    const { cell } = copy;
    let ownStack: Stack | null = null;
    const moved: Stack[] = [];
    for (const stack of stacks) {
        const { x, y, z } = stack.position;
        if (Math.abs(x - cell.x) > 1 || Math.abs(z - cell.z) > 1) {
            continue;
        }
        const next: Stack = {
            blocks: stack.blocks,
            position: new Vector3(x - cell.x, y, z - cell.z),
        };
        if (stack === copy.stack) {
            ownStack = next;
        }
        moved.push(next);
    }
    const stack = ownStack ?? {
        blocks: copy.stack.blocks,
        position: new Vector3(0, copy.stack.position.y, 0),
    };
    if (!ownStack) {
        moved.push(stack);
    }
    return {
        baseHeight: getStackHeight(blockData, stack, copy.block),
        block: copy.block,
        stack,
        stacks: moved,
    };
}

/**
 * The templates the Expand ghosts draw (spec §7.5) and the copy cells each
 * one covers.
 *
 * A block that ignores its neighbours is drawn from one lone template on
 * every cell, as before. A fence, shade or water copy takes the shape it
 * will have once placed: every copy is put on its cell's stack in the
 * garden as it will be after the batch (`createExpandGhostWorld`), its shape
 * is resolved there, and copies of the same shape share one template whose
 * stacks hold the neighbours of the first such copy. A rectangle of fences
 * therefore draws a joined fence, and water one slab. With no copies, the
 * lone template is kept, so the preview stays ready while the corner is on
 * the source.
 *
 * Past `maxExpandGhostVariants` shapes, the remaining copies draw the most
 * common shape.
 */
export function resolveExpandGhostVariants({
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
}): ExpandGhostVariant[] {
    const kind = getExpandGhostNeighbourKind(blockName);
    if (!kind || cells.length === 0) {
        return [
            {
                key: loneExpandGhostVariantKey,
                cells: [...cells],
                template: createLoneExpandGhostTemplate(blockName, rotation),
            },
        ];
    }

    const world = createExpandGhostWorld({
        blockName,
        cells,
        reach: 1,
        rotation,
        stacks,
    });
    const variants = new Map<string, ExpandGhostVariant>();
    const overflow: ExpandCell[] = [];
    for (const copy of world.copies) {
        const key = `${kind}:${getNeighbourShapeKey(kind, copy, world.stacks, blockData)}`;
        const variant = variants.get(key);
        if (variant) {
            variant.cells.push(copy.cell);
        } else if (variants.size < maxExpandGhostVariants) {
            variants.set(key, {
                key,
                cells: [copy.cell],
                template: createNeighbourTemplate(
                    copy,
                    world.stacks,
                    blockData,
                ),
            });
        } else {
            overflow.push(copy.cell);
        }
    }

    const resolved = [...variants.values()];
    if (overflow.length > 0) {
        const common = resolved.reduce((largest, variant) =>
            variant.cells.length > largest.cells.length ? variant : largest,
        );
        common.cells.push(...overflow);
    }
    return resolved;
}

/** One template's copies of a part: its matrices in the template, per cell. */
export type ExpandGhostPartGroup = {
    cells: readonly ExpandCell[];
    localMatrices: readonly Matrix4[];
};

/**
 * One part of the copies, merged over every template that draws it (the
 * same geometry and material): a fence's straight piece is one part
 * whichever way the copies turn it, so the draw calls stay at the pieces a
 * block is made of, however many shapes the copies take.
 */
export type ExpandGhostMergedPart = {
    geometry: BufferGeometry;
    material: Material | Material[];
    groups: ExpandGhostPartGroup[];
    /** Instances it draws: each group's cells times its matrices. */
    instanceCount: number;
};

function getPartMaterialKey(material: Material | Material[]) {
    return Array.isArray(material)
        ? material.map((entry) => entry.uuid).join(',')
        : material.uuid;
}

/**
 * The parts the copies draw: the parts of every collected template, merged
 * by geometry and material, each with the cells of the templates that draw
 * it. Templates not yet collected, or that fell back, add nothing.
 */
export function mergeExpandGhostParts(
    variants: readonly Pick<ExpandGhostVariant, 'cells' | 'key'>[],
    collections: ReadonlyMap<string, GhostTemplateCollection>,
): ExpandGhostMergedPart[] {
    const merged = new Map<string, ExpandGhostMergedPart>();
    for (const variant of variants) {
        const collection = collections.get(variant.key);
        if (collection?.kind !== 'parts') {
            continue;
        }
        for (const part of collection.parts) {
            const key = `${part.geometry.uuid}|${getPartMaterialKey(part.material)}`;
            const group: ExpandGhostPartGroup = {
                cells: variant.cells,
                localMatrices: part.localMatrices,
            };
            const instances = variant.cells.length * part.localMatrices.length;
            const existing = merged.get(key);
            if (existing) {
                existing.groups.push(group);
                existing.instanceCount += instances;
            } else {
                merged.set(key, {
                    geometry: part.geometry,
                    material: part.material,
                    groups: [group],
                    instanceCount: instances,
                });
            }
        }
    }
    return [...merged.values()];
}
