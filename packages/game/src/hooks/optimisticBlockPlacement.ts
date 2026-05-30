import {
    type GardenBlockDataLike,
    type GardenBlockStack,
    resolveGardenBlockPlacement,
} from '@gredice/js/gardenBlocks';
import { Vector3 } from 'three';
import type { Stack } from '../types/Stack';

export type PlacementBlockData = GardenBlockDataLike & {
    information?: {
        name?: string | null;
    } | null;
};

type GardenWithStacks = {
    stacks: Stack[];
};

function createBlockDataByName(blockData: PlacementBlockData[]) {
    const blockDataByName = new Map<string, GardenBlockDataLike>();
    for (const block of blockData) {
        const name = block.information?.name;
        if (name) {
            blockDataByName.set(name, block);
        }
    }
    return blockDataByName;
}

function createBlockNameById(stacks: Stack[]) {
    const blockNameById = new Map<string, string>();
    for (const stack of stacks) {
        for (const block of stack.blocks) {
            blockNameById.set(block.id, block.name);
        }
    }
    return blockNameById;
}

function createPlacementStacks(stacks: Stack[]): GardenBlockStack[] {
    return stacks.map((stack) => ({
        positionX: stack.position.x,
        positionY: stack.position.z,
        blocks: stack.blocks.map((block) => block.id),
    }));
}

export function createOptimisticBlockPlacement<
    TGarden extends GardenWithStacks,
>(
    garden: TGarden,
    blockData: PlacementBlockData[] | null | undefined,
    blockName: string,
    blockId: string,
) {
    if (!blockData) {
        return null;
    }

    const placement = resolveGardenBlockPlacement({
        blockName,
        stacks: createPlacementStacks(garden.stacks),
        blockNameById: createBlockNameById(garden.stacks),
        blockDataByName: createBlockDataByName(blockData),
    });
    if (!placement.valid) {
        return null;
    }

    const { x, y } = placement.placement;
    let hasTargetStack = false;
    const optimisticBlock = {
        id: blockId,
        name: blockName,
        rotation: 0,
    };
    const stacks = garden.stacks.map((stack) => {
        if (stack.position.x !== x || stack.position.z !== y) {
            return stack;
        }

        hasTargetStack = true;
        return {
            ...stack,
            blocks: [...stack.blocks, optimisticBlock],
        };
    });

    if (!hasTargetStack) {
        stacks.push({
            position: new Vector3(x, 0, y),
            blocks: [optimisticBlock],
        });
    }

    return {
        blockId,
        position: new Vector3(x, 0, y),
        stacks,
    };
}

export function replaceOptimisticBlockId<TGarden extends GardenWithStacks>(
    garden: TGarden,
    optimisticBlockId: string,
    blockId: string,
): TGarden {
    return {
        ...garden,
        stacks: garden.stacks.map((stack) => ({
            ...stack,
            blocks: stack.blocks.map((block) =>
                block.id === optimisticBlockId
                    ? {
                          ...block,
                          id: blockId,
                      }
                    : block,
            ),
        })),
    };
}

export function removeOptimisticBlockId<TGarden extends GardenWithStacks>(
    garden: TGarden,
    optimisticBlockId: string,
): TGarden {
    return {
        ...garden,
        stacks: garden.stacks.flatMap((stack) => {
            const blocks = stack.blocks.filter(
                (block) => block.id !== optimisticBlockId,
            );

            if (blocks.length === stack.blocks.length) {
                return [stack];
            }

            if (blocks.length === 0) {
                return [];
            }

            return [
                {
                    ...stack,
                    blocks,
                },
            ];
        }),
    };
}
