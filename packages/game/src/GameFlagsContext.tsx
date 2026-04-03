'use client';

import { createContext, useContext } from 'react';

export interface GameFeatureFlags {
    enableDebugHudFlag?: boolean;
    enablePlantGeneratorFlag?: boolean;
    enableRaisedBedWateringFlag?: boolean;
    enableRaisedBedDiaryFlag?: boolean;
    enableRaisedBedOperationsFlag?: boolean;
    enableRaisedBedFieldOperationsFlag?: boolean;
    enableRaisedBedFieldWateringFlag?: boolean;
    enableRaisedBedFieldDiaryFlag?: boolean;
    raisedBedImageAI?: boolean;
}

export const GameFlagsContext = createContext<GameFeatureFlags>({});

export function useGameFlags() {
    return useContext(GameFlagsContext);
}
