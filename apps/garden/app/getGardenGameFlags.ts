import type { GameFeatureFlags } from '@gredice/game';
import {
    enableAdvancedSowingFlag,
    enableDebugHudFlag,
    enableGardenAvatarFlag,
    enableOutletGardenFlag,
    enableRaisedBedNotificationBubblesFlag,
    enableSuncokretDebugFlag,
} from './flags';

export async function getGardenGameFlags(): Promise<GameFeatureFlags> {
    const [
        enableAdvancedSowing,
        enableDebugHud,
        enableGardenAvatar,
        enableOutletGarden,
        enableRaisedBedNotificationBubbles,
        enableSuncokretDebug,
    ] = await Promise.all([
        enableAdvancedSowingFlag(),
        enableDebugHudFlag(),
        enableGardenAvatarFlag(),
        enableOutletGardenFlag(),
        enableRaisedBedNotificationBubblesFlag(),
        enableSuncokretDebugFlag(),
    ]);

    return {
        enableAdvancedSowingFlag: enableAdvancedSowing,
        enableDebugHudFlag: enableDebugHud,
        enableGardenAvatarFlag: enableGardenAvatar,
        enableOutletGardenFlag: enableOutletGarden,
        enableRaisedBedNotificationBubblesFlag:
            enableRaisedBedNotificationBubbles,
        enableSuncokretDebugFlag: enableSuncokretDebug,
    };
}
