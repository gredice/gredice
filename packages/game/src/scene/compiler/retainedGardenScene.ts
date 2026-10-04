import type { BlockData } from '@gredice/client';
import { getEffectiveGardenStackBlockHeight } from '@gredice/js/gardenBlocks';
import {
    type BlockInteractionLayerTarget,
    getBlockInteractionLayerBounds,
} from '../../controls/BlockInteractionResolver';
import { chunkInstanceKey } from '../../entities/chunkedMeshGeometry';
import {
    legacyStoneCornerStairsBlockName,
    stoneCornerStairsBlockName,
} from '../../entities/terrainStairs';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import { getBlockHitboxSize } from '../../utils/blockHitbox';

export function sameItems<T>(
    left: readonly T[] | undefined,
    right: readonly T[],
) {
    return (
        left?.length === right.length &&
        right.every((item, index) => item === left[index])
    );
}

export function blocksEqual(left: Block, right: Block) {
    return (
        left === right ||
        (left.id === right.id &&
            left.name === right.name &&
            left.rotation === right.rotation &&
            left.variant === right.variant &&
            left.message === right.message)
    );
}

function cellKey(stack: Stack) {
    return `${stack.position.x}|${stack.position.y}|${stack.position.z}`;
}

export type RetainedGardenCell = {
    readonly key: string;
    readonly stack: Stack;
    readonly interactions: BlockInteractionLayerTarget[];
};

export type RetainedGardenChunk = {
    readonly key: string;
    readonly version: number;
    readonly cells: readonly RetainedGardenCell[];
    readonly connectivity: readonly RetainedGardenCell[];
    readonly neighborColumnKeys: readonly string[];
    readonly stacks: Stack[];
    readonly bounds: ReturnType<typeof getBlockInteractionLayerBounds>;
    readonly interactions: BlockInteractionLayerTarget[];
    /** Archetype requirements, resolved to GLTFs by the existing asset components. */
    readonly assetUsage: ReadonlyMap<string, number>;
    readonly raisedBedIds: readonly string[];
};

export type RetainedGardenScene = {
    readonly source: Stack[] | undefined;
    readonly catalog: BlockData[] | null | undefined;
    readonly version: number;
    readonly stacks: Stack[];
    readonly cells: ReadonlyMap<string, RetainedGardenCell>;
    readonly blocks: ReadonlyMap<string, Block>;
    readonly chunks: readonly RetainedGardenChunk[];
    readonly interactions: BlockInteractionLayerTarget[];
    readonly dirtyChunkKeys: readonly string[];
};

/** Pure reconciliation: abandoned React renders cannot mutate a committed packet. */
export function compileRetainedGardenScene(
    source: Stack[] | undefined,
    catalog: BlockData[] | null | undefined,
    previous?: RetainedGardenScene,
): RetainedGardenScene {
    if (previous && previous.source === source && previous.catalog === catalog)
        return previous;
    const metadata = new Map(
        catalog?.map((entry) => [entry.information.name, entry]),
    );
    const cells = new Map<string, RetainedGardenCell>();
    const blocks = new Map<string, Block>();
    const grouped = new Map<string, RetainedGardenCell[]>();
    const changedColumns = new Set<string>();
    const stacks = (source ?? []).map((incoming) => {
        const key = cellKey(incoming);
        const old = previous?.cells.get(key);
        const sharedBlocks = incoming.blocks.map((block) => {
            const oldBlock = previous?.blocks.get(block.id);
            const shared =
                oldBlock && blocksEqual(oldBlock, block) ? oldBlock : block;
            blocks.set(shared.id, shared);
            return shared;
        });
        const stack =
            old && sameItems(old.stack.blocks, sharedBlocks)
                ? old.stack
                : sameItems(incoming.blocks, sharedBlocks)
                  ? incoming
                  : { ...incoming, blocks: sharedBlocks };
        let height = 0;
        const cell =
            old?.stack === stack && previous?.catalog === catalog
                ? old
                : {
                      key,
                      stack,
                      interactions: stack.blocks.map((block, blockIndex) => {
                          const data =
                              metadata.get(block.name) ??
                              metadata.get(
                                  block.name === stoneCornerStairsBlockName
                                      ? legacyStoneCornerStairsBlockName
                                      : block.name ===
                                          legacyStoneCornerStairsBlockName
                                        ? stoneCornerStairsBlockName
                                        : block.name,
                              );
                          const target = {
                              block,
                              blockIndex,
                              stack,
                              stackHeight: height,
                              key: `${stack.position.x}|${stack.position.z}|${block.id}|${blockIndex}`,
                              hitbox: getBlockHitboxSize(data),
                          };
                          height += getEffectiveGardenStackBlockHeight({
                              blockHeight: data?.attributes.height ?? 0,
                              blockName: block.name,
                              supportBlockName:
                                  stack.blocks[blockIndex - 1]?.name,
                          });
                          return target;
                      }),
                  };
        cells.set(key, cell);
        if (cell !== old)
            changedColumns.add(`${stack.position.x}|${stack.position.z}`);
        const chunkKey = chunkInstanceKey([
            stack.position.x,
            stack.position.y,
            stack.position.z,
        ]);
        const members = grouped.get(chunkKey);
        if (members) members.push(cell);
        else grouped.set(chunkKey, [cell]);
        return stack;
    });
    if (
        previous &&
        previous.catalog === catalog &&
        sameItems(previous.stacks, stacks)
    ) {
        return { ...previous, source, dirtyChunkKeys: [] };
    }
    for (const [key, cell] of previous?.cells ?? []) {
        if (!cells.has(key))
            changedColumns.add(
                `${cell.stack.position.x}|${cell.stack.position.z}`,
            );
    }
    const oldChunks = new Map(
        previous?.chunks.map((chunk) => [chunk.key, chunk]),
    );
    const columns = new Map<string, RetainedGardenCell>();
    for (const cell of cells.values()) {
        const key = `${cell.stack.position.x}|${cell.stack.position.z}`;
        // Match resolveEntityNeighbors' first-column rule even with duplicate XZ stacks.
        if (!columns.has(key)) columns.set(key, cell);
    }
    const dirtyChunkKeys: string[] = [];
    const chunks = [...grouped]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, cells]) => {
            const old = oldChunks.get(key);
            oldChunks.delete(key);
            if (
                old &&
                sameItems(old.cells, cells) &&
                !old.neighborColumnKeys.some((key) => changedColumns.has(key))
            )
                return old;
            const neighbors = new Set<RetainedGardenCell>();
            const neighborColumnKeys = new Set<string>();
            for (const { stack } of cells) {
                for (const [dx, dz] of [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1],
                ]) {
                    const key = `${stack.position.x + dx}|${stack.position.z + dz}`;
                    neighborColumnKeys.add(key);
                    const neighbor = columns.get(key);
                    if (neighbor) neighbors.add(neighbor);
                }
            }
            const connectivity = [...neighbors];
            if (
                old &&
                sameItems(old.cells, cells) &&
                sameItems(old.connectivity, connectivity)
            )
                return old;
            dirtyChunkKeys.push(key);
            if (old && sameItems(old.cells, cells))
                return { ...old, version: old.version + 1, connectivity };
            const interactions = cells.flatMap((cell) => cell.interactions);
            const assetUsage = new Map<string, number>();
            for (const { block } of interactions)
                assetUsage.set(
                    block.name,
                    (assetUsage.get(block.name) ?? 0) + 1,
                );
            return {
                key,
                version: (old?.version ?? 0) + 1,
                cells,
                connectivity,
                neighborColumnKeys: [...neighborColumnKeys],
                stacks: cells.map((cell) => cell.stack),
                interactions,
                bounds: getBlockInteractionLayerBounds(interactions),
                assetUsage,
                raisedBedIds: interactions
                    .filter(({ block }) => block.name === 'Raised_Bed')
                    .map(({ block }) => block.id),
            };
        });
    dirtyChunkKeys.push(...oldChunks.keys());
    const interactions = [...cells.values()].flatMap(
        (cell) => cell.interactions,
    );
    return {
        source,
        catalog,
        cells,
        blocks,
        version: (previous?.version ?? 0) + (dirtyChunkKeys.length > 0 ? 1 : 0),
        stacks:
            sameItems(previous?.stacks, stacks) && previous
                ? previous.stacks
                : stacks,
        chunks:
            sameItems(previous?.chunks, chunks) && previous
                ? previous.chunks
                : chunks,
        interactions:
            sameItems(previous?.interactions, interactions) && previous
                ? previous.interactions
                : interactions,
        dirtyChunkKeys,
    };
}
