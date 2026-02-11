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

export function findAttachedRaisedBedBlockId(
    stacks: Stack[],
    blockId: string,
): string | null {
    const placement = getBlockPlacement(stacks, blockId);
    if (!placement || placement.block.name !== 'Raised_Bed') {
        return null;
    }

    const candidates = stacks
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
        .sort((a, b) => a.block.id.localeCompare(b.block.id));

    return candidates[0]?.block.id ?? null;
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

    const attachedBlockId = findAttachedRaisedBedBlockId(
        garden.stacks,
        raisedBed.blockId,
    );
    if (!attachedBlockId) {
        return [raisedBed.blockId];
    }

    if (raisedBed.orientation === 'horizontal') {
        return [raisedBed.blockId, attachedBlockId].sort((left, right) => {
            const leftPlacement = getBlockPlacement(garden.stacks, left);
            const rightPlacement = getBlockPlacement(garden.stacks, right);
            if (!leftPlacement || !rightPlacement) {
                return left.localeCompare(right);
            }
            return (
                leftPlacement.stack.position.z - rightPlacement.stack.position.z
            );
        });
    }

    return [raisedBed.blockId, attachedBlockId].sort((left, right) => {
        const leftPlacement = getBlockPlacement(garden.stacks, left);
        const rightPlacement = getBlockPlacement(garden.stacks, right);
        if (!leftPlacement || !rightPlacement) {
            return left.localeCompare(right);
        }
        return leftPlacement.stack.position.x - rightPlacement.stack.position.x;
    });
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
