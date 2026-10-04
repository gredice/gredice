import {
    createContext,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
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
    previous?: EntityBlockInstanceIndex,
): EntityBlockInstanceIndex {
    const blockNameByActiveDragTargetKey = new Map<string, string>();
    const blocksByName = new Map<string, IndexedEntityBlock[]>();
    let order = 0;
    const oldByBlock = new Map(
        [...(previous?.blocksByName.values() ?? [])]
            .flat()
            .map((entry) => [entry.block.id, entry]),
    );

    for (const stack of stacks ?? []) {
        stack.blocks.forEach((block, blockIndex) => {
            const old = oldByBlock.get(block.id);
            const indexedBlock =
                old?.block === block &&
                old.stack === stack &&
                old.blockIndex === blockIndex &&
                old.order === order
                    ? old
                    : { block, blockIndex, order, stack };
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

    const retainedGroups = new Map<string, readonly IndexedEntityBlock[]>(
        blocksByName,
    );
    for (const [name, entries] of blocksByName) {
        const old = previous?.blocksByName.get(name);
        if (
            old &&
            old.length === entries.length &&
            entries.every((entry, i) => entry === old[i])
        )
            retainedGroups.set(name, old);
    }
    return {
        blockNameByActiveDragTargetKey,
        blocksByName: retainedGroups,
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

    const previous = useRef<EntityBlockInstanceIndex | undefined>(undefined);
    const index = useMemo(
        () =>
            sharedIndex && sharedIndex.stacks === stacks
                ? sharedIndex
                : createEntityBlockInstanceIndex(stacks, previous.current),
        [sharedIndex, stacks],
    );
    useLayoutEffect(() => {
        previous.current = index;
    }, [index]);
    return index;
}
