import type { GameSceneProps } from '@gredice/game';

export const highTargetOperationVisualHighlightTarget = {
    fieldId: 201,
    positionIndex: 0,
    raisedBedId: 2,
} as const;

export function resolveGameProfileBlockGeometryMerging(
    value: string | undefined,
) {
    return value === '1';
}

export function resolveGameProfileAdaptiveHigh(value: string | undefined) {
    return value === '1';
}

export function resolveGameProfileOperationVisuals(value: string | undefined) {
    return value === '1';
}

export function resolveGameProfileFlags(
    blockGeometryMerging: string | undefined,
    adaptiveHigh: string | undefined,
) {
    return {
        enableAdaptiveHighQualityFlag:
            resolveGameProfileAdaptiveHigh(adaptiveHigh),
        enableBlockGeometryMergingFlag:
            resolveGameProfileBlockGeometryMerging(blockGeometryMerging),
        enableDebugHudFlag: true,
        enableRainWetOverlayFlag: true,
    } satisfies NonNullable<GameSceneProps['flags']>;
}
