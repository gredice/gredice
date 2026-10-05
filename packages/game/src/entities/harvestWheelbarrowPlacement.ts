import type { BlockData } from '@gredice/client';
import { harvestWheelbarrow } from '@gredice/js/harvestWheelbarrow';
import { resolvePickupPlacementPreviewForRelative } from '../controls/PickupPlacementResolver';
import type { GardenStack } from '../types/Stack';
import { getStackHeight } from '../utils/stackHeightCore';

/** Keep the wheelbarrow's optimistic/local rotation inside supported free cells. */
export function canRotateHarvestWheelbarrows({
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
            if (
                !blockIds.has(block.id) ||
                block.name !== harvestWheelbarrow.name
            )
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
