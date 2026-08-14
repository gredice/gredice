import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import { isMulchBlockName } from '../raisedBed/mulchPatchGeometry';
import { isWaterBlockName } from '../waterBlockNames';
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

function hasCoverBlockAbove(stack: Stack, blockIndex: number) {
    for (let index = blockIndex + 1; index < stack.blocks.length; index += 1) {
        const blockName = stack.blocks[index]?.name ?? '';
        if (isWaterBlockName(blockName) || isMulchBlockName(blockName)) {
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
            if (!surface || hasCoverBlockAbove(stack, blockIndex)) {
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
