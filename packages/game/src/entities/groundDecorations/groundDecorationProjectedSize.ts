import type { GameQualityProfileTier } from '../../scene/gameQuality';

// Eighteen backing pixels are six CSS pixels at the constrained mobile DPR cap.
// Standard tiers stay more conservative because their close-up budget is less
// constrained and their canvas usually renders at a lower DPR.
const minimumProjectedBackingPixelsByQuality = {
    'auto-constrained': 18,
    custom: 2.5,
    high: 2,
    low: 18,
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
