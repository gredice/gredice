import type { GameFeatureFlags } from '@gredice/game';
import {
    enableAdvancedSowingFlag,
    enableDebugHudFlag,
    enableGardenAvatarFlag,
    enableSuncokretDebugFlag,
} from './flags';

export async function getGardenGameFlags(): Promise<GameFeatureFlags> {
    const [
        enableAdvancedSowing,
        enableDebugHud,
        enableGardenAvatar,
        enableSuncokretDebug,
    ] = await Promise.all([
        enableAdvancedSowingFlag(),
        enableDebugHudFlag(),
        enableGardenAvatarFlag(),
        enableSuncokretDebugFlag(),
    ]);

    return {
        enableAdvancedSowingFlag: enableAdvancedSowing,
        enableDebugHudFlag: enableDebugHud,
        enableGardenAvatarFlag: enableGardenAvatar,
        enableSuncokretDebugFlag: enableSuncokretDebug,
    };
}
