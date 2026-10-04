'use client';

import type { BlockData } from '@gredice/client';
import {
    type GardenBlockDataLike,
    getGardenBlockFootprintOffsets,
} from '@gredice/js/gardenBlocks';
import { Shadow } from '@react-three/drei';

export function resolvePlacementFootprintIndicatorPositions(
    blockData: GardenBlockDataLike | null | undefined,
    rotation = 0,
) {
    return getGardenBlockFootprintOffsets(blockData, rotation).map(
        (offset) => [offset.x, 0, offset.y] as const,
    );
}

export function PlacementFootprintIndicator({
    blockData,
    color,
    opacity,
    rotation = 0,
}: {
    blockData: BlockData | null | undefined;
    color: number;
    opacity: number;
    rotation?: number;
}) {
    return resolvePlacementFootprintIndicatorPositions(blockData, rotation).map(
        (position) => (
            <Shadow
                key={`${position[0]}:${position[2]}`}
                color={color}
                colorStop={0.5}
                opacity={opacity}
                position={position}
                scale={2}
            />
        ),
    );
}
