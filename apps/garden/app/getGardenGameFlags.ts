import type { GameFeatureFlags } from '@gredice/game';
import {
    adaptiveHighQualityFlag,
    enableDebugHudFlag,
    enableSuncokretChatFlag,
    enableSuncokretDebugFlag,
    rainWetOverlayFlag,
    staticOpaqueSceneCacheFlag,
} from './flags';

export async function getGardenGameFlags(): Promise<GameFeatureFlags> {
    const [
        enableAdaptiveHighQualityFlag,
        enableDebugHud,
        enableRainWetOverlayFlag,
        enableStaticOpaqueSceneCacheFlag,
        enableSuncokretChat,
        enableSuncokretDebug,
    ] = await Promise.all([
        adaptiveHighQualityFlag(),
        enableDebugHudFlag(),
        rainWetOverlayFlag(),
        staticOpaqueSceneCacheFlag(),
        enableSuncokretChatFlag(),
        enableSuncokretDebugFlag(),
    ]);

    return {
        enableAdaptiveHighQualityFlag,
        enableDebugHudFlag: enableDebugHud,
        enableRainWetOverlayFlag,
        enableStaticOpaqueSceneCacheFlag,
        enableSuncokretChatFlag: enableSuncokretChat,
        enableSuncokretDebugFlag: enableSuncokretDebug,
    };
}
