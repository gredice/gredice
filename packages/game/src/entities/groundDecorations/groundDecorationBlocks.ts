import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import { waterBlockName } from '../waterBlockFoam';
import {
    type GroundDecorationSurface,
    resolveGroundDecorationSurface,
} from './groundDecorationConfig';

export type GroundDecorationBlock = {
    block: Block;
    blockIndex: number;
    stack: Stack;
    surface: GroundDecorationSurface;
};

function hasWaterBlockAbove(stack: Stack, blockIndex: number) {
    for (let index = blockIndex + 1; index < stack.blocks.length; index += 1) {
        if (stack.blocks[index]?.name === waterBlockName) {
            return true;
        }
    }

    return false;
}

export function getGroundDecorationBlocks(stacks: Stack[] | undefined) {
    if (!stacks) {
        return [] as GroundDecorationBlock[];
    }

    return stacks.flatMap((stack) =>
        stack.blocks.flatMap((block, blockIndex) => {
            const surface = resolveGroundDecorationSurface(block.name);
            if (!surface || hasWaterBlockAbove(stack, blockIndex)) {
                return [];
            }

            return [
                {
                    block,
                    blockIndex,
                    stack,
                    surface,
                },
            ];
        }),
    );
}
