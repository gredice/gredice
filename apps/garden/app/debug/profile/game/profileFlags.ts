import type { GameSceneProps } from '@gredice/game';

export function resolveGameProfileBlockGeometryMerging(
    value: string | undefined,
) {
    return value === '1';
}

export function resolveGameProfileFlags(
    blockGeometryMerging: string | undefined,
) {
    return {
        enableBlockGeometryMergingFlag:
            resolveGameProfileBlockGeometryMerging(blockGeometryMerging),
        enableDebugHudFlag: true,
        enableRainWetOverlayFlag: true,
    } satisfies NonNullable<GameSceneProps['flags']>;
}
