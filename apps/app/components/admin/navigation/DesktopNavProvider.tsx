'use client';

import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
    useLayoutEffect,
    useMemo,
    useState,
} from 'react';

type DesktopNavContextValue = {
    isExpanded: boolean;
    setExpanded: (expanded: boolean) => void;
    toggle: () => void;
};

const DesktopNavContext = createContext<DesktopNavContextValue | undefined>(
    undefined,
);

const desktopNavExpandedStorageKey = 'gredice:admin:desktop-nav-expanded';

function readStoredDesktopNavExpanded() {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const value = window.localStorage.getItem(desktopNavExpandedStorageKey);
        if (value === 'true') {
            return true;
        }
        if (value === 'false') {
            return false;
        }
    } catch {
        return null;
    }

    return null;
}

function writeStoredDesktopNavExpanded(isExpanded: boolean) {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(
            desktopNavExpandedStorageKey,
            String(isExpanded),
        );
    } catch {
        // Ignore unavailable localStorage, for example private browsing quotas.
    }
}

export function DesktopNavProvider({ children }: PropsWithChildren) {
    const [isExpanded, setIsExpanded] = useState(true);

    useLayoutEffect(() => {
        const storedExpanded = readStoredDesktopNavExpanded();
        if (storedExpanded !== null) {
            setIsExpanded(storedExpanded);
        }
    }, []);

    const setExpanded = useCallback((expanded: boolean) => {
        setIsExpanded(expanded);
    }, []);

    const toggle = useCallback(() => {
        setIsExpanded((current) => {
            const nextExpanded = !current;
            writeStoredDesktopNavExpanded(nextExpanded);
            return nextExpanded;
        });
    }, []);

    const value = useMemo(
        () => ({
            isExpanded,
            setExpanded,
            toggle,
        }),
        [isExpanded, setExpanded, toggle],
    );

    return (
        <DesktopNavContext.Provider value={value}>
            {children}
        </DesktopNavContext.Provider>
    );
}

export function useDesktopNav() {
    const context = useContext(DesktopNavContext);

    if (!context) {
        throw new Error('useDesktopNav must be used inside DesktopNavProvider');
    }

    return context;
}
