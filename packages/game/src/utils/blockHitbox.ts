import type { BlockData } from '@gredice/client';

export type BlockHitboxSize = {
    width: number;
    height: number;
    depth: number;
};

function positiveNumber(value: unknown, fallback: number) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : fallback;
}

export function getBlockHitboxSize(
    blockData: BlockData | null | undefined,
): BlockHitboxSize {
    const attributes = blockData?.attributes;
    const fallbackHeight = Math.max(
        positiveNumber(attributes?.height, 1),
        0.35,
    );

    return {
        width: positiveNumber(attributes?.hitboxWidth, 1),
        height: positiveNumber(attributes?.hitboxHeight, fallbackHeight),
        depth: positiveNumber(attributes?.hitboxDepth, 1),
    };
}
