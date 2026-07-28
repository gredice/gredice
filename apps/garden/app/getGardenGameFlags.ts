import type { GameFeatureFlags } from '@gredice/game';
import {
    adaptiveHighQualityFlag,
    blockGeometryMergingFlag,
    enableDebugHudFlag,
    enableSuncokretChatFlag,
    enableSuncokretDebugFlag,
    rainWetOverlayFlag,
    staticOpaqueSceneCacheFlag,
} from './flags';

export async function getGardenGameFlags(): Promise<GameFeatureFlags> {
    const [
        enableAdaptiveHighQualityFlag,
        enableBlockGeometryMergingFlag,
        enableDebugHud,
        enableRainWetOverlayFlag,
        enableStaticOpaqueSceneCacheFlag,
        enableSuncokretChat,
        enableSuncokretDebug,
    ] = await Promise.all([
        adaptiveHighQualityFlag(),
        blockGeometryMergingFlag(),
        enableDebugHudFlag(),
        rainWetOverlayFlag(),
        staticOpaqueSceneCacheFlag(),
        enableSuncokretChatFlag(),
        enableSuncokretDebugFlag(),
    ]);

    return {
        enableAdaptiveHighQualityFlag,
        enableBlockGeometryMergingFlag,
        enableDebugHudFlag: enableDebugHud,
        enableRainWetOverlayFlag,
        enableStaticOpaqueSceneCacheFlag,
        enableSuncokretChatFlag: enableSuncokretChat,
        enableSuncokretDebugFlag: enableSuncokretDebug,
    };
}
