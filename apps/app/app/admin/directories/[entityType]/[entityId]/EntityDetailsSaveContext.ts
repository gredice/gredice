'use client';

import { createContext, useContext } from 'react';

export type EntityDetailsSaveContextValue = {
    pendingSaveCount: number;
    lastSavedAt: number | null;
    trackSave: <T>(operation: () => Promise<T>) => Promise<T>;
};

async function runOperation<T>(operation: () => Promise<T>) {
    return operation();
}

export const EntityDetailsSaveContext =
    createContext<EntityDetailsSaveContextValue>({
        pendingSaveCount: 0,
        lastSavedAt: null,
        trackSave: runOperation,
    });

export function useEntityDetailsSave() {
    return useContext(EntityDetailsSaveContext);
}
