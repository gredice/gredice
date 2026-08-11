import type { GameFeatureFlags } from '@gredice/game';
import {
    enableAdvancedSowingFlag,
    enableDebugHudFlag,
    enableGardenAvatarFlag,
    enableOutletGardenFlag,
    enableSuncokretDebugFlag,
} from './flags';

export async function getGardenGameFlags(): Promise<GameFeatureFlags> {
    const [
        enableAdvancedSowing,
        enableDebugHud,
        enableGardenAvatar,
        enableOutletGarden,
        enableSuncokretDebug,
    ] = await Promise.all([
        enableAdvancedSowingFlag(),
        enableDebugHudFlag(),
        enableGardenAvatarFlag(),
        enableOutletGardenFlag(),
        enableSuncokretDebugFlag(),
    ]);

    return {
        enableAdvancedSowingFlag: enableAdvancedSowing,
        enableDebugHudFlag: enableDebugHud,
        enableGardenAvatarFlag: enableGardenAvatar,
        enableOutletGardenFlag: enableOutletGarden,
        enableSuncokretDebugFlag: enableSuncokretDebug,
    };
}
