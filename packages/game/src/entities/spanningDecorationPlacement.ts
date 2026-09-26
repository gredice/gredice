import type { BlockData } from '@gredice/client';
import { autumnBlanketBench } from '@gredice/js/autumnBlanketBench';
import { fallenLog } from '@gredice/js/fallenLog';
import { harvestWheelbarrow } from '@gredice/js/harvestWheelbarrow';
import { resolvePickupPlacementPreviewForRelative } from '../controls/PickupPlacementResolver';
import type { GardenStack } from '../types/Stack';
import { getStackHeight } from '../utils/stackHeightCore';

const guardedDecorations = new Set<string>([
    harvestWheelbarrow.name,
    fallenLog.name,
    autumnBlanketBench.name,
]);

/** Keep long decorations inside supported free cells during optimistic/local rotation. */
export function canRotateSpanningDecorations({
    blockData,
    blockIds,
    rotation,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    blockIds: Set<string>;
    rotation: number;
    stacks: GardenStack[];
}) {
    for (const stack of stacks) {
        for (const [index, block] of stack.blocks.entries()) {
            if (!blockIds.has(block.id) || !guardedDecorations.has(block.name))
                continue;
            if (
                !blockData?.some((item) => item.information.name === block.name)
            )
                return false;
            const preview = resolvePickupPlacementPreviewForRelative({
                blockData,
                gardenIsSandbox: false,
                localSandboxStorageKey: null,
                movingSegments: [
                    {
                        sourceStack: stack,
                        sourceStartIndex: index,
                        blocks: [{ ...block, rotation }],
                        baseHeight: getStackHeight(blockData, stack, block),
                        canRecycle: false,
                    },
                ],
                relative: { x: 0, y: 0, z: 0 },
                stacks,
            });
            if (!preview || preview.nextIsBlocked || preview.nextIsOverRecycler)
                return false;
        }
    }
    return true;
}
