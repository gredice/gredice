'use client';

import { createContext, useContext } from 'react';

type GameLoadingContextValue = {
    setIsReady: (ready: boolean) => void;
};

export const GameLoadingContext = createContext<GameLoadingContextValue | null>(
    null,
);

export function useGameLoading() {
    return useContext(GameLoadingContext);
}
