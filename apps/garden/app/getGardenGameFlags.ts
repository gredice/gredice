import type { GameFeatureFlags } from '@gredice/game';
import { enableDebugHudFlag, enableSuncokretDebugFlag } from './flags';

export async function getGardenGameFlags(): Promise<GameFeatureFlags> {
    const [enableDebugHud, enableSuncokretDebug] = await Promise.all([
        enableDebugHudFlag(),
        enableSuncokretDebugFlag(),
    ]);

    return {
        enableDebugHudFlag: enableDebugHud,
        enableSuncokretDebugFlag: enableSuncokretDebug,
    };
}
