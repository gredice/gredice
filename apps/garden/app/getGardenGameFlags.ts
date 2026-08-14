import type { GameFeatureFlags } from '@gredice/game';
import {
    enableDebugHudFlag,
    enableGardenAvatarFlag,
    enableOutletGardenFlag,
    enableSuncokretDebugFlag,
} from './flags';

export async function getGardenGameFlags(): Promise<GameFeatureFlags> {
    const [
        enableDebugHud,
        enableGardenAvatar,
        enableOutletGarden,
        enableSuncokretDebug,
    ] = await Promise.all([
        enableDebugHudFlag(),
        enableGardenAvatarFlag(),
        enableOutletGardenFlag(),
        enableSuncokretDebugFlag(),
    ]);

    return {
        enableDebugHudFlag: enableDebugHud,
        enableGardenAvatarFlag: enableGardenAvatar,
        enableOutletGardenFlag: enableOutletGarden,
        enableSuncokretDebugFlag: enableSuncokretDebug,
    };
}
