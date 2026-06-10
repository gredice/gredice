import type { BlockData } from '@gredice/client';

export type BlockHitboxSize = {
    width: number;
    height: number;
    depth: number;
};

const minimumBlockHitboxSizes: Record<string, BlockHitboxSize> = {
    BirdHouse: { width: 0.72, height: 1.3, depth: 0.72 },
    CactusColumnCluster: { width: 0.72, height: 1, depth: 0.62 },
    CactusPricklyPear: { width: 0.66, height: 0.95, depth: 0.45 },
    DeadTreeStump: { width: 0.45, height: 0.98, depth: 0.75 },
    DeadTreeTall: { width: 1.4, height: 1.8, depth: 0.52 },
    Pine: { width: 1.12, height: 2.77, depth: 1.12 },
    PineAdvent: { width: 1.12, height: 2.77, depth: 1.12 },
    Shade: { width: 1, height: 1.05, depth: 1 },
    ShovelSmall: { width: 0.32, height: 1.03, depth: 0.16 },
    Tree: { width: 1.36, height: 2.38, depth: 1.43 },
    WaterWell: { width: 1.22, height: 1.36, depth: 0.95 },
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
    const minimumHitbox = blockData
        ? minimumBlockHitboxSizes[blockData.information.name]
        : undefined;
    const fallbackHeight = Math.max(
        positiveNumber(attributes?.height, 1),
        0.35,
    );

    return {
        width: Math.max(
            positiveNumber(attributes?.hitboxWidth, 1),
            minimumHitbox?.width ?? 0,
        ),
        height: Math.max(
            positiveNumber(attributes?.hitboxHeight, fallbackHeight),
            minimumHitbox?.height ?? 0,
        ),
        depth: Math.max(
            positiveNumber(attributes?.hitboxDepth, 1),
            minimumHitbox?.depth ?? 0,
        ),
    };
}
