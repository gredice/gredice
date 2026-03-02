import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';

type RaisedBedWithBlockId = {
    id: number;
    blockId: string | null;
    orientation?: 'vertical' | 'horizontal';
};

type GardenLike<
    TRaisedBed extends RaisedBedWithBlockId = RaisedBedWithBlockId,
> = {
    stacks: Stack[];
    raisedBeds: TRaisedBed[];
};

type BlockPlacement = {
    block: Block;
    stack: Stack;
    index: number;
};

function getBlockPlacement(
    stacks: Stack[],
    blockId: string,
): BlockPlacement | null {
    for (const stack of stacks) {
        const index = stack.blocks.findIndex(
            (candidate) => candidate.id === blockId,
        );
        if (index >= 0) {
            const block = stack.blocks[index];
            if (block) {
                return { block, stack, index };
            }
        }
    }

    return null;
}

function getAdjacentRaisedBedIds(
    stacks: Stack[],
    blockId: string,
    placement: BlockPlacement,
): string[] {
    return stacks
        .flatMap((stack) =>
            stack.blocks
                .map((block, index) => ({ stack, block, index }))
                .filter(
                    ({ block, index }) =>
                        block.name === 'Raised_Bed' &&
                        index === placement.index,
                ),
        )
        .filter(({ block, stack }) => {
            if (block.id === blockId) {
                return false;
            }
            const sameX = stack.position.x === placement.stack.position.x;
            const sameZ = stack.position.z === placement.stack.position.z;
            return (
                (sameX &&
                    Math.abs(stack.position.z - placement.stack.position.z) ===
                        1) ||
                (sameZ &&
                    Math.abs(stack.position.x - placement.stack.position.x) ===
                        1)
            );
        })
        .map(({ block }) => block.id);
}

function sortBlockIdsByOrientation(
    stacks: Stack[],
    blockIds: string[],
    orientation: 'vertical' | 'horizontal' = 'vertical',
): string[] {
    return [...blockIds].sort((left, right) => {
        const leftPlacement = getBlockPlacement(stacks, left);
        const rightPlacement = getBlockPlacement(stacks, right);
        if (!leftPlacement || !rightPlacement) {
            return left.localeCompare(right);
        }

        if (orientation === 'horizontal') {
            return (
                leftPlacement.stack.position.z - rightPlacement.stack.position.z
            );
        }

        return rightPlacement.stack.position.x - leftPlacement.stack.position.x;
    });
}

function getConnectedRaisedBedBlockIds(
    stacks: Stack[],
    blockId: string,
): string[] {
    const startPlacement = getBlockPlacement(stacks, blockId);
    if (!startPlacement || startPlacement.block.name !== 'Raised_Bed') {
        return [];
    }

    const visited = new Set<string>();
    const queue = [blockId];

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (!currentId || visited.has(currentId)) {
            continue;
        }

        const currentPlacement = getBlockPlacement(stacks, currentId);
        if (!currentPlacement || currentPlacement.block.name !== 'Raised_Bed') {
            continue;
        }

        visited.add(currentId);

        const adjacentIds = getAdjacentRaisedBedIds(
            stacks,
            currentId,
            currentPlacement,
        );
        for (const adjacentId of adjacentIds) {
            if (!visited.has(adjacentId)) {
                queue.push(adjacentId);
            }
        }
    }

    return Array.from(visited);
}

export function findAttachedRaisedBedBlockId(
    stacks: Stack[],
    blockId: string,
): string | null {
    const placement = getBlockPlacement(stacks, blockId);
    if (!placement || placement.block.name !== 'Raised_Bed') {
        return null;
    }

    return (
        getAdjacentRaisedBedIds(stacks, blockId, placement).sort((a, b) =>
            a.localeCompare(b),
        )[0] ?? null
    );
}

export function getRaisedBedBlockIds<TRaisedBed extends RaisedBedWithBlockId>(
    garden: GardenLike<TRaisedBed>,
    raisedBedId: number,
): string[] {
    const raisedBed = garden.raisedBeds.find(
        (candidate) => candidate.id === raisedBedId,
    );
    if (!raisedBed?.blockId) {
        return [];
    }

    const connectedBlockIds = getConnectedRaisedBedBlockIds(
        garden.stacks,
        raisedBed.blockId,
    );
    if (connectedBlockIds.length === 0) {
        return [raisedBed.blockId];
    }

    return sortBlockIdsByOrientation(
        garden.stacks,
        connectedBlockIds,
        raisedBed.orientation,
    );
}

export function isRaisedBedShapeValid<TRaisedBed extends RaisedBedWithBlockId>(
    garden: GardenLike<TRaisedBed>,
    raisedBedId: number,
): boolean {
    return getRaisedBedBlockIds(garden, raisedBedId).length === 2;
}

export function findRaisedBedByBlockId<TRaisedBed extends RaisedBedWithBlockId>(
    garden: GardenLike<TRaisedBed> | null | undefined,
    blockId: string,
): TRaisedBed | null {
    if (!garden) {
        return null;
    }

    const directMatch = garden.raisedBeds.find(
        (candidate) => candidate.blockId === blockId,
    );
    if (directMatch) {
        return directMatch;
    }

    return (
        garden.raisedBeds.find((candidate) => {
            if (!candidate.blockId) {
                return false;
            }

            return (
                findAttachedRaisedBedBlockId(
                    garden.stacks,
                    candidate.blockId,
                ) === blockId
            );
        }) ?? null
    );
}
