import type { BlockData } from '@gredice/client';
import { getGardenBlockFootprintOffsets } from '@gredice/js/gardenBlocks';
import { resolveBlockPlacement } from '../hooks/optimisticBlockPlacement';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { getStackHeight } from '../utils/stackHeightCore';

export type HudPlacementGridPosition = {
    x: number;
    z: number;
};

export type HudPlacementPreview = {
    baseBlocks: Block[];
    error: string | null;
    hoverHeight: number;
    isBlocked: boolean;
    position: HudPlacementGridPosition;
};

type GardenWithStacks = {
    stacks: Stack[];
};

function getStackAtPosition(
    stacks: Stack[] | undefined,
    position: HudPlacementGridPosition,
) {
    return stacks?.find(
        (stack) =>
            stack.position.x === position.x && stack.position.z === position.z,
    );
}

function getHudPlacementSupport({
    blockData,
    blockName,
    position,
    stacks,
}: {
    blockData: BlockData[];
    blockName: string;
    position: HudPlacementGridPosition;
    stacks: Stack[] | undefined;
}) {
    const blockEntity = blockData.find(
        (block) => block.information.name === blockName,
    );
    let support = {
        baseBlocks: [] as Block[],
        hoverHeight: 0,
    };

    for (const offset of getGardenBlockFootprintOffsets(blockEntity)) {
        const stack = getStackAtPosition(stacks, {
            x: position.x + offset.x,
            z: position.z + offset.y,
        });
        const hoverHeight = getStackHeight(blockData, stack);
        if (hoverHeight > support.hoverHeight) {
            support = {
                baseBlocks: stack?.blocks ?? [],
                hoverHeight,
            };
        }
    }

    return support;
}

export function resolveHudPlacementPreview({
    blockData,
    blockName,
    garden,
    position,
}: {
    blockData: BlockData[] | null | undefined;
    blockName: string;
    garden: GardenWithStacks | null | undefined;
    position: HudPlacementGridPosition;
}): HudPlacementPreview | null {
    if (!blockData || !garden) {
        return null;
    }

    const placement = resolveBlockPlacement(garden, blockData, blockName, {
        requestedPosition: { x: position.x, y: position.z },
    });
    const support = getHudPlacementSupport({
        blockData,
        blockName,
        position,
        stacks: garden.stacks,
    });

    return {
        baseBlocks: support.baseBlocks,
        error: placement?.valid === false ? placement.error : null,
        hoverHeight: support.hoverHeight,
        isBlocked: placement?.valid !== true,
        position,
    };
}
