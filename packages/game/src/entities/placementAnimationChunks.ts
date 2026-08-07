import type { GameState } from '../useGameState';
import {
    type ChunkedMeshInstance,
    chunkMeshInstances,
    type MeshInstanceChunk,
} from './chunkedMeshGeometry';

type PlacementAnimationInstance = ChunkedMeshInstance & {
    block: {
        id: string;
    };
};

export type PlacementAnimationChunkAddress = {
    chunkIndex: number;
    instanceIndex: number;
    order: number;
};

export type AddressedPlacementAnimationChunks<
    T extends PlacementAnimationInstance,
> = {
    addressByBlockId: ReadonlyMap<string, PlacementAnimationChunkAddress>;
    chunks: MeshInstanceChunk<T>[];
};

type PlacementAnimationChunkCacheEntry<T extends PlacementAnimationInstance> = {
    chunk: MeshInstanceChunk<T>;
    signature: string;
    sourceChunk: MeshInstanceChunk<T>;
};

export type PlacementAnimationChunkCache<T extends PlacementAnimationInstance> =
    Map<string, PlacementAnimationChunkCacheEntry<T>>;

type PlacementAnimationState = Pick<GameState, 'blockPlacementDropAnimations'>;

const emptyPlacementSignatures = new Map<string, string>();

function renderIdsEqual(
    left: ReadonlyMap<string, number>,
    right: ReadonlyMap<string, number>,
) {
    if (left.size !== right.size) {
        return false;
    }

    for (const [blockId, renderId] of left) {
        if (right.get(blockId) !== renderId) {
            return false;
        }
    }

    return true;
}

export function createPlacementDropAnimationRenderIdsSelector(
    ownedBlockIds: readonly string[],
) {
    const ownedBlockIdSet = new Set(ownedBlockIds);
    let previousAnimations:
        | PlacementAnimationState['blockPlacementDropAnimations']
        | undefined;
    let previousSelection: ReadonlyMap<string, number> = new Map();

    return (state: PlacementAnimationState) => {
        if (state.blockPlacementDropAnimations === previousAnimations) {
            return previousSelection;
        }
        previousAnimations = state.blockPlacementDropAnimations;

        const nextSelection = new Map<string, number>();

        for (const [blockId, animation] of Object.entries(
            state.blockPlacementDropAnimations,
        )) {
            if (ownedBlockIdSet.has(blockId)) {
                nextSelection.set(blockId, animation.renderId);
            } else if (ownedBlockIdSet.has(animation.sourceBlockId)) {
                nextSelection.set(animation.sourceBlockId, animation.renderId);
            }
        }

        if (renderIdsEqual(previousSelection, nextSelection)) {
            return previousSelection;
        }

        previousSelection = nextSelection;
        return previousSelection;
    };
}

export function addressPlacementAnimationChunks<
    T extends PlacementAnimationInstance,
>(instances: T[]): AddressedPlacementAnimationChunks<T> {
    const chunks = chunkMeshInstances(instances);
    const orderByInstance = new Map<T, number>();
    const addressByBlockId = new Map<string, PlacementAnimationChunkAddress>();

    instances.forEach((instance, order) => {
        orderByInstance.set(instance, order);
    });
    chunks.forEach((chunk, chunkIndex) => {
        chunk.instances.forEach((instance, instanceIndex) => {
            const order = orderByInstance.get(instance);
            if (order === undefined) {
                return;
            }

            addressByBlockId.set(instance.block.id, {
                chunkIndex,
                instanceIndex,
                order,
            });
        });
    });

    return {
        addressByBlockId,
        chunks,
    };
}

export function createPlacementAnimationChunkCache<
    T extends PlacementAnimationInstance,
>(): PlacementAnimationChunkCache<T> {
    return new Map();
}

export function localizePlacementDropAnimationChunks<
    T extends PlacementAnimationInstance,
>(
    addressed: AddressedPlacementAnimationChunks<T>,
    animatedRenderIds: ReadonlyMap<string, number>,
    chunkCache: PlacementAnimationChunkCache<T>,
) {
    const animatedAddresses: Array<
        PlacementAnimationChunkAddress & { renderId: number }
    > = [];
    const animatedBlockIdsByChunkIndex = new Map<number, Set<string>>();

    for (const [blockId, renderId] of animatedRenderIds) {
        const address = addressed.addressByBlockId.get(blockId);
        if (!address) {
            continue;
        }

        animatedAddresses.push({ ...address, renderId });
        const chunkBlockIds = animatedBlockIdsByChunkIndex.get(
            address.chunkIndex,
        );
        if (chunkBlockIds) {
            chunkBlockIds.add(blockId);
        } else {
            animatedBlockIdsByChunkIndex.set(
                address.chunkIndex,
                new Set([blockId]),
            );
        }
    }

    if (animatedBlockIdsByChunkIndex.size === 0) {
        return {
            animatedInstances: [] as Array<{
                instance: T;
                renderId: number;
            }>,
            chunks: addressed.chunks,
            placementSignatureByChunkKey: emptyPlacementSignatures,
            touchedChunkKeys: [] as string[],
        };
    }

    const chunks = [...addressed.chunks];
    const placementSignatureByChunkKey = new Map<string, string>();
    const touchedChunkKeys: string[] = [];
    const touchedChunkIndexes = [...animatedBlockIdsByChunkIndex.keys()].sort(
        (left, right) => left - right,
    );

    for (const chunkIndex of touchedChunkIndexes) {
        const chunk = addressed.chunks[chunkIndex];
        const chunkBlockIds = animatedBlockIdsByChunkIndex.get(chunkIndex);
        if (!chunk || !chunkBlockIds) {
            continue;
        }

        const placementSignature = JSON.stringify([...chunkBlockIds].sort());
        const cachedChunk = chunkCache.get(chunk.key);
        if (
            cachedChunk?.sourceChunk === chunk &&
            cachedChunk.signature === placementSignature
        ) {
            chunks[chunkIndex] = cachedChunk.chunk;
        } else {
            const localizedChunk = {
                key: chunk.key,
                instances: chunk.instances.filter(
                    (instance) => !chunkBlockIds.has(instance.block.id),
                ),
            };
            chunks[chunkIndex] = localizedChunk;
            chunkCache.set(chunk.key, {
                chunk: localizedChunk,
                signature: placementSignature,
                sourceChunk: chunk,
            });
        }
        placementSignatureByChunkKey.set(chunk.key, placementSignature);
        touchedChunkKeys.push(chunk.key);
    }

    animatedAddresses.sort((left, right) => left.order - right.order);
    const animatedInstances: Array<{
        instance: T;
        renderId: number;
    }> = [];
    for (const address of animatedAddresses) {
        const instance =
            addressed.chunks[address.chunkIndex]?.instances[
                address.instanceIndex
            ];
        if (instance) {
            animatedInstances.push({
                instance,
                renderId: address.renderId,
            });
        }
    }

    return {
        animatedInstances,
        chunks,
        placementSignatureByChunkKey,
        touchedChunkKeys,
    };
}
