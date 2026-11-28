import type { BlockData } from '@gredice/client';
import {
    type ActiveDragPreviewTransform,
    activeDragPreviewLift,
    createActiveDragPreviewTarget,
    getActiveDragPreviewTargetPositionOffset,
} from '../../dragPreviewIdentity';
import type { GardenStack } from '../../types/Stack';
import { getStackHeight } from '../../utils/stackHeightCore';
import {
    resolveTerrainRimPlacements,
    type TerrainRimPlacement,
} from './terrainRimPlacements';

export type TerrainRimOffset = {
    x: number;
    y: number;
    z: number;
};

/**
 * A rim piece of a block lifted off the garden. `top` is where the piece
 * rests; `offset` carries it with the lifted block, as the drag preview
 * carries the block itself.
 */
export type TerrainRimLiftedPlacement<
    TStack extends GardenStack = GardenStack,
> = TerrainRimPlacement<TStack> & { offset: TerrainRimOffset };

type LiftedSegment<TStack extends GardenStack> = {
    /** Indices of the lifted blocks in the source stack, bottom first. */
    indices: number[];
    offset: TerrainRimOffset;
    source: TStack;
};

/** Ground, paving and water: the blocks the rim and verge are worked out from. */
function isTerrainBlockName(name: string) {
    return name.startsWith('Block_');
}

function terrainTargetKey(
    x: number,
    z: number,
    blockId: string,
    blockIndex: number,
) {
    return `${x}|${z}|${blockId}|${blockIndex}`;
}

/** Keys of every terrain block, to tell cheaply whether a drag lifts one. */
export function createTerrainDragTargetKeys(
    stacks: readonly GardenStack[] | undefined,
): ReadonlySet<string> {
    const keys = new Set<string>();
    for (const stack of stacks ?? []) {
        stack.blocks.forEach((block, blockIndex) => {
            if (isTerrainBlockName(block.name)) {
                keys.add(
                    terrainTargetKey(
                        stack.position.x,
                        stack.position.z,
                        block.id,
                        blockIndex,
                    ),
                );
            }
        });
    }
    return keys;
}

/** Whether the drag lifts any terrain block, so the rim has to follow it. */
export function dragPreviewLiftsTerrain(
    preview: ActiveDragPreviewTransform | null | undefined,
    terrainTargetKeys: ReadonlySet<string>,
) {
    return Boolean(
        preview?.targets?.some((target) =>
            terrainTargetKeys.has(
                terrainTargetKey(
                    target.stackPosition.x,
                    target.stackPosition.z,
                    target.blockId,
                    target.blockIndex,
                ),
            ),
        ),
    );
}

function collectLiftedSegments<TStack extends GardenStack>(
    stacks: readonly TStack[],
    preview: ActiveDragPreviewTransform | null | undefined,
    lift: number,
) {
    const segments = new Map<TStack, LiftedSegment<TStack>>();
    const targets = preview?.targets;
    if (!targets?.length) return segments;

    const targetStacks = new Set(
        targets.map(
            ({ stackPosition }) => `${stackPosition.x}|${stackPosition.z}`,
        ),
    );
    for (const stack of stacks) {
        if (!targetStacks.has(`${stack.position.x}|${stack.position.z}`)) {
            continue;
        }
        stack.blocks.forEach((block, blockIndex) => {
            const offset = getActiveDragPreviewTargetPositionOffset(
                createActiveDragPreviewTarget({
                    blockId: block.id,
                    blockIndex,
                    stackPosition: stack.position,
                }),
                preview,
                lift,
            );
            if (!offset) return;
            const segment = segments.get(stack);
            if (segment) segment.indices.push(blockIndex);
            else
                segments.set(stack, {
                    indices: [blockIndex],
                    offset,
                    source: stack,
                });
        });
    }
    return segments;
}

function withoutLiftedBlocks<TStack extends GardenStack>(
    stacks: readonly TStack[],
    segments: ReadonlyMap<TStack, LiftedSegment<TStack>>,
) {
    const sourceByResting = new Map<
        GardenStack,
        { indices: number[]; source: TStack }
    >();
    const resting = stacks.map((stack) => {
        const segment = segments.get(stack);
        if (!segment) return stack;
        const lifted = new Set(segment.indices);
        const indices = stack.blocks
            .map((_, blockIndex) => blockIndex)
            .filter((blockIndex) => !lifted.has(blockIndex));
        const restingStack = {
            ...stack,
            blocks: indices.map((blockIndex) => stack.blocks[blockIndex]),
        };
        sourceByResting.set(restingStack, { indices, source: stack });
        return restingStack;
    });
    return { resting, sourceByResting };
}

/**
 * The garden as it stands while the drag holds its blocks up: every lifted
 * block is taken out of its stack. Without lifted blocks it returns `stacks`
 * itself, and stacks the drag does not touch keep their identity.
 */
export function removeLiftedTerrainBlocks<TStack extends GardenStack>(
    stacks: readonly TStack[] | undefined,
    preview: ActiveDragPreviewTransform | null | undefined,
): readonly TStack[] | undefined {
    if (!stacks) return stacks;
    const segments = collectLiftedSegments(stacks, preview, 0);
    if (!segments.size) return stacks;
    return withoutLiftedBlocks(stacks, segments).resting;
}

/**
 * The rim of blocks held up by a drag. Each lifted run is rimmed as an
 * island of its own, just as it reads in the air: a lone block gets its lip
 * and body on all four sides, and blocks lifted together share theirs. The
 * pieces keep the source stack and block index, so they follow the block
 * through the same drag offset.
 */
export function resolveLiftedTerrainRimPlacements<TStack extends GardenStack>(
    blockData: BlockData[] | null | undefined,
    stacks: readonly TStack[] | undefined,
    preview: ActiveDragPreviewTransform | null | undefined,
    lift = activeDragPreviewLift,
): TerrainRimLiftedPlacement<TStack>[] {
    if (!blockData || !stacks?.length) return [];
    const segments = collectLiftedSegments(stacks, preview, lift);
    return resolveSegmentPlacements(blockData, segments);
}

function resolveSegmentPlacements<TStack extends GardenStack>(
    blockData: BlockData[],
    segments: ReadonlyMap<TStack, LiftedSegment<TStack>>,
): TerrainRimLiftedPlacement<TStack>[] {
    if (!segments.size) return [];
    const segmentByLifted = new Map<
        GardenStack,
        LiftedSegment<TStack> & { base: number }
    >();
    const liftedStacks = [...segments.values()].map((segment) => {
        const liftedStack = {
            ...segment.source,
            blocks: segment.indices.map(
                (blockIndex) => segment.source.blocks[blockIndex],
            ),
        };
        const firstIndex = segment.indices[0] ?? 0;
        segmentByLifted.set(liftedStack, {
            ...segment,
            base: getStackHeight(
                blockData,
                segment.source,
                segment.source.blocks[firstIndex],
            ),
        });
        return liftedStack;
    });
    return resolveTerrainRimPlacements(blockData, liftedStacks).flatMap(
        (placement) => {
            const segment = segmentByLifted.get(placement.stack);
            const blockIndex = segment?.indices[placement.blockIndex];
            if (!segment || blockIndex === undefined) return [];
            return [
                {
                    ...placement,
                    blockIndex,
                    offset: segment.offset,
                    stack: segment.source,
                    top: segment.base + placement.top,
                },
            ];
        },
    );
}

/**
 * Splits the rim while a drag holds terrain blocks up. `resting` is the rim
 * of the garden with the lifted blocks taken out, so the hole they leave is
 * walled by its neighbours instead of keeping a lip in mid-air. `lifted` is
 * the rim the lifted blocks carry (see `resolveLiftedTerrainRimPlacements`).
 */
export function resolveTerrainRimDragPlacements<TStack extends GardenStack>(
    blockData: BlockData[] | null | undefined,
    stacks: readonly TStack[] | undefined,
    preview: ActiveDragPreviewTransform | null | undefined,
    lift = activeDragPreviewLift,
): {
    lifted: TerrainRimLiftedPlacement<TStack>[];
    resting: TerrainRimPlacement<TStack>[];
} {
    if (!blockData || !stacks?.length) return { lifted: [], resting: [] };
    const segments = collectLiftedSegments(stacks, preview, lift);
    if (!segments.size) {
        return {
            lifted: [],
            resting: resolveTerrainRimPlacements(blockData, stacks),
        };
    }
    const { resting, sourceByResting } = withoutLiftedBlocks(stacks, segments);
    return {
        lifted: resolveSegmentPlacements(blockData, segments),
        resting: resolveTerrainRimPlacements(blockData, resting).map(
            (placement) => {
                const source = sourceByResting.get(placement.stack);
                const blockIndex = source?.indices[placement.blockIndex];
                return source && blockIndex !== undefined
                    ? { ...placement, blockIndex, stack: source.source }
                    : placement;
            },
        ),
    };
}
