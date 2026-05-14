'use client';

import { createContext, useContext } from 'react';

export const GameSceneDetailContext = createContext({
    renderDetails: true,
});

export function useGameSceneDetails() {
    return useContext(GameSceneDetailContext);
}
