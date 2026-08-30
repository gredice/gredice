import type { GameFeatureFlags } from '@gredice/game';
import {
    enableDebugHudFlag,
    enableGardenAvatarFlag,
    enableGardenBuildingSystemFlag,
    enableSuncokretDebugFlag,
} from './flags';

export async function getGardenGameFlags(): Promise<GameFeatureFlags> {
    const [
        enableDebugHud,
        enableGardenAvatar,
        enableGardenBuildingSystem,
        enableSuncokretDebug,
    ] = await Promise.all([
        enableDebugHudFlag(),
        enableGardenAvatarFlag(),
        enableGardenBuildingSystemFlag(),
        enableSuncokretDebugFlag(),
    ]);

    return {
        enableDebugHudFlag: enableDebugHud,
        enableGardenAvatarFlag: enableGardenAvatar,
        enableGardenBuildingSystemFlag: enableGardenBuildingSystem,
        enableSuncokretDebugFlag: enableSuncokretDebug,
    };
}
