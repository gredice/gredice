'use client';

import { createContext, useContext } from 'react';

export interface GameFeatureFlags {
    /** Gates new Advanced Sowing selection/submission; persisted data stays readable. */
    enableAdvancedSowingFlag?: boolean;
    enableGardenAvatarFlag?: boolean;
    enableOutletGardenFlag?: boolean;
    enableDebugHudFlag?: boolean;
    enableRaisedBedNotificationBubblesFlag?: boolean;
    enableRaisedBedWateringFlag?: boolean;
    enableRaisedBedDiaryFlag?: boolean;
    enableRaisedBedOperationsFlag?: boolean;
    enableRaisedBedFieldOperationsFlag?: boolean;
    enableRaisedBedFieldWateringFlag?: boolean;
    enableRaisedBedFieldDiaryFlag?: boolean;
    enableIntegratedWeatherSurfacesFlag?: boolean;
    enableSuncokretDebugFlag?: boolean;
}

export const GameFlagsContext = createContext<GameFeatureFlags>({});

export function useGameFlags() {
    return useContext(GameFlagsContext);
}
