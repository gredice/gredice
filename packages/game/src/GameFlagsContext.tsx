'use client';

import { createContext, useContext } from 'react';

export interface GameFeatureFlags {
    enableGardenAvatarFlag?: boolean;
    enableGardenBuildingSystemFlag?: boolean;
    enableDebugHudFlag?: boolean;
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
