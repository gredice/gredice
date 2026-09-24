import type { GameFeatureFlags } from '@gredice/game';
import {
    enableDebugHudFlag,
    enableGardenAvatarFlag,
    enableSuncokretDebugFlag,
} from './flags';

export async function getGardenGameFlags(): Promise<GameFeatureFlags> {
    const [enableDebugHud, enableGardenAvatar, enableSuncokretDebug] =
        await Promise.all([
            enableDebugHudFlag(),
            enableGardenAvatarFlag(),
            enableSuncokretDebugFlag(),
        ]);

    return {
        enableDebugHudFlag: enableDebugHud,
        enableGardenAvatarFlag: enableGardenAvatar,
        enableSuncokretDebugFlag: enableSuncokretDebug,
    };
}
