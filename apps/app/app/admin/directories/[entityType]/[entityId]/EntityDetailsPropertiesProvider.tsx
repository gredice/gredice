'use client';

import {
    type PropsWithChildren,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { EntityDetailsPropertiesContext } from './EntityDetailsPropertiesContext';

const entityDetailsPropertiesStorageKey =
    'gredice.entityDetails.propertiesPanel';

export function EntityDetailsPropertiesProvider({
    children,
}: PropsWithChildren) {
    const [isOpen, setIsOpen] = useState(true);
    const [hasLoadedPreference, setHasLoadedPreference] = useState(false);

    useEffect(() => {
        try {
            const storedValue = window.localStorage.getItem(
                entityDetailsPropertiesStorageKey,
            );

            if (storedValue === 'closed') {
                setIsOpen(false);
            } else if (storedValue === 'open') {
                setIsOpen(true);
            }
        } catch {
            // Local storage is an enhancement; keep the default open state.
        } finally {
            setHasLoadedPreference(true);
        }
    }, []);

    useEffect(() => {
        if (!hasLoadedPreference) {
            return;
        }

        try {
            window.localStorage.setItem(
                entityDetailsPropertiesStorageKey,
                isOpen ? 'open' : 'closed',
            );
        } catch {
            // Ignore persistence failures and leave the panel usable.
        }
    }, [hasLoadedPreference, isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const toggle = useCallback(() => {
        setIsOpen((current) => !current);
    }, []);

    const contextValue = useMemo(
        () => ({
            isOpen,
            toggle,
        }),
        [isOpen, toggle],
    );

    return (
        <EntityDetailsPropertiesContext.Provider value={contextValue}>
            {children}
        </EntityDetailsPropertiesContext.Provider>
    );
}
