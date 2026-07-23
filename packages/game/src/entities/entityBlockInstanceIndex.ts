import { createContext, useContext, useMemo } from 'react';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';

export type IndexedEntityBlock = {
    block: Block;
    blockIndex: number;
    order: number;
    stack: Stack;
};

export type EntityBlockInstanceIndex = {
    blockNameByActiveDragTargetKey: ReadonlyMap<string, string>;
    blocksByName: ReadonlyMap<string, readonly IndexedEntityBlock[]>;
    stacks: Stack[] | undefined;
};

const emptyIndexedEntityBlocks: readonly IndexedEntityBlock[] = [];

function activeDragTargetKey({
    blockId,
    blockIndex,
    stack,
}: {
    blockId: string;
    blockIndex: number;
    stack: Stack;
}) {
    return `${stack.position.x}|${stack.position.z}|${blockId}|${blockIndex}`;
}

export function createEntityBlockInstanceIndex(
    stacks: Stack[] | undefined,
): EntityBlockInstanceIndex {
    const blockNameByActiveDragTargetKey = new Map<string, string>();
    const blocksByName = new Map<string, IndexedEntityBlock[]>();
    let order = 0;

    for (const stack of stacks ?? []) {
        stack.blocks.forEach((block, blockIndex) => {
            const indexedBlock = { block, blockIndex, order, stack };
            const matchingBlocks = blocksByName.get(block.name);

            if (matchingBlocks) {
                matchingBlocks.push(indexedBlock);
            } else {
                blocksByName.set(block.name, [indexedBlock]);
            }

            blockNameByActiveDragTargetKey.set(
                activeDragTargetKey({
                    blockId: block.id,
                    blockIndex,
                    stack,
                }),
                block.name,
            );
            order += 1;
        });
    }

    return {
        blockNameByActiveDragTargetKey,
        blocksByName,
        stacks,
    };
}

export function getIndexedEntityBlocks(
    index: EntityBlockInstanceIndex,
    name: string | undefined,
    names: readonly string[] | undefined,
) {
    const requestedNames = new Set(names);

    if (name) {
        requestedNames.add(name);
    }

    const matchingGroups = Array.from(requestedNames, (requestedName) =>
        index.blocksByName.get(requestedName),
    ).filter(
        (group): group is readonly IndexedEntityBlock[] => group !== undefined,
    );

    if (matchingGroups.length === 0) {
        return emptyIndexedEntityBlocks;
    }

    if (matchingGroups.length === 1) {
        return matchingGroups[0] ?? emptyIndexedEntityBlocks;
    }

    return matchingGroups
        .flat()
        .sort((left, right) => left.order - right.order);
}

export function hasIndexedEntityBlocks(
    index: EntityBlockInstanceIndex,
    name: string,
) {
    return index.blocksByName.has(name);
}

export const EntityBlockInstanceIndexContext =
    createContext<EntityBlockInstanceIndex | null>(null);

export function useEntityBlockInstanceIndex(stacks: Stack[] | undefined) {
    const sharedIndex = useContext(EntityBlockInstanceIndexContext);

    return useMemo(
        () =>
            sharedIndex && sharedIndex.stacks === stacks
                ? sharedIndex
                : createEntityBlockInstanceIndex(stacks),
        [sharedIndex, stacks],
    );
}
