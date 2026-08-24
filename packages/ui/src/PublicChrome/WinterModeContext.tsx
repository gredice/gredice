'use client';

import { createContext, useContext } from 'react';

export type WinterModeContextValue = {
    isWinter: boolean | null;
    toggle: () => void;
};

export const WinterModeContext = createContext<WinterModeContextValue | null>(
    null,
);

export function useWinterMode() {
    const context = useContext(WinterModeContext);
    if (!context) {
        throw new Error(
            'useWinterMode must be used within a PublicChromeProvider',
        );
    }
    return context;
}
