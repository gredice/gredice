import type { GameFeatureFlags } from '@gredice/game';
import {
    enableDebugHudFlag,
    enableSuncokretChatFlag,
    enableSuncokretDebugFlag,
} from './flags';

export async function getGardenGameFlags(): Promise<GameFeatureFlags> {
    const [enableDebugHud, enableSuncokretChat, enableSuncokretDebug] =
        await Promise.all([
            enableDebugHudFlag(),
            enableSuncokretChatFlag(),
            enableSuncokretDebugFlag(),
        ]);

    return {
        enableDebugHudFlag: enableDebugHud,
        enableSuncokretChatFlag: enableSuncokretChat,
        enableSuncokretDebugFlag: enableSuncokretDebug,
    };
}
