'use client';

import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';

type DesktopNavContextValue = {
    isExpanded: boolean;
    toggle: () => void;
};

const DesktopNavContext = createContext<DesktopNavContextValue | undefined>(
    undefined,
);

export function DesktopNavProvider({ children }: PropsWithChildren) {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggle = useCallback(() => {
        setIsExpanded((current) => !current);
    }, []);

    const value = useMemo(
        () => ({
            isExpanded,
            toggle,
        }),
        [isExpanded, toggle],
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
