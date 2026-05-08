'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { EntityDetailsSaveContext } from './EntityDetailsSaveContext';

export function EntityDetailsSaveProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [pendingSaveCount, setPendingSaveCount] = useState(0);
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

    async function trackSave<T>(operation: () => Promise<T>) {
        setPendingSaveCount((current) => current + 1);

        try {
            const result = await operation();
            setLastSavedAt(Date.now());
            return result;
        } finally {
            setPendingSaveCount((current) => Math.max(0, current - 1));
        }
    }

    return (
        <EntityDetailsSaveContext.Provider
            value={{
                pendingSaveCount,
                lastSavedAt,
                trackSave,
            }}
        >
            {children}
        </EntityDetailsSaveContext.Provider>
    );
}
