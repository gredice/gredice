import type { MovingSegment } from './PickupPlacementResolver';

export type PickupRemovalDropAction =
    | {
          type: 'delete';
          blockIds: string[];
      }
    | {
          type: 'recycle';
      };

export function getMovingSegmentBlockIds(movingSegments: MovingSegment[]) {
    const blockIds = new Set<string>();

    for (const segment of movingSegments) {
        for (const block of segment.blocks) {
            blockIds.add(block.id);
        }
    }

    return Array.from(blockIds);
}

export function resolvePickupHudDropAction({
    forceDelete,
    movingSegments,
}: {
    forceDelete: boolean;
    movingSegments: MovingSegment[];
}): PickupRemovalDropAction | null {
    const blockIds = getMovingSegmentBlockIds(movingSegments);
    if (blockIds.length === 0) {
        return null;
    }

    if (!forceDelete && movingSegments[0]?.canRecycle) {
        return { type: 'recycle' };
    }

    return {
        type: 'delete',
        blockIds,
    };
}
