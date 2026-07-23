import type { GameQualityProfileTier } from '../../scene/gameQuality';

const minimumProjectedBackingPixelsByQuality = {
    'auto-constrained': 3,
    custom: 2.5,
    high: 2,
    low: 3,
    medium: 2.5,
} satisfies Record<GameQualityProfileTier, number>;

export function estimateGroundDecorationProjectedBackingPixels(
    worldHeight: number,
    projectionScaleY: number,
    backingBufferHeight: number,
    viewDepth: number,
) {
    if (
        !Number.isFinite(backingBufferHeight) ||
        backingBufferHeight <= 0 ||
        !Number.isFinite(projectionScaleY) ||
        projectionScaleY === 0 ||
        !Number.isFinite(viewDepth) ||
        viewDepth <= 0 ||
        !Number.isFinite(worldHeight) ||
        worldHeight <= 0
    ) {
        return null;
    }

    return (
        (Math.abs(worldHeight * projectionScaleY) / viewDepth) *
        (backingBufferHeight / 2)
    );
}

export function resolveGroundDecorationMinimumProjectedBackingPixels(
    qualityTier: GameQualityProfileTier,
) {
    return minimumProjectedBackingPixelsByQuality[qualityTier];
}

export function shouldCullGroundDecorationByProjectedSize(
    worldHeight: number,
    projectionScaleY: number,
    backingBufferHeight: number,
    viewDepth: number,
    minimumBackingPixels: number,
) {
    const projectedBackingPixels =
        estimateGroundDecorationProjectedBackingPixels(
            worldHeight,
            projectionScaleY,
            backingBufferHeight,
            viewDepth,
        );

    return (
        projectedBackingPixels !== null &&
        projectedBackingPixels < minimumBackingPixels
    );
}
