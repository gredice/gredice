'use client';

import { createContext, useContext } from 'react';

type EntityDetailsPropertiesContextValue = {
    isOpen: boolean;
    toggle: () => void;
};

export const EntityDetailsPropertiesContext =
    createContext<EntityDetailsPropertiesContextValue | null>(null);

export function useEntityDetailsProperties() {
    const context = useContext(EntityDetailsPropertiesContext);

    if (!context) {
        throw new Error(
            'useEntityDetailsProperties must be used inside EntityDetailsPropertiesProvider',
        );
    }

    return context;
}
