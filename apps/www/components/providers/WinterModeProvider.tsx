'use client';

import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';

const SUMMER_HUE = 28;
const WINTER_HUE = 202;
const STORAGE_KEY = 'gredice-winter-mode';

// Check if current date is within winter season (Dec 1 - Mar 20)
export function isWinterSeason(): boolean {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed (0 = January, 11 = December)
    const day = now.getDate();

    // December (month 11): from day 1
    if (month === 11 && day >= 1) return true;
    // January (month 0): all days
    if (month === 0) return true;
    // February (month 1): all days
    if (month === 1) return true;
    // March (month 2): until day 20
    if (month === 2 && day <= 20) return true;

    return false;
}

// Check if current date is within Christmas holidays (Dec 1 - Jan 10)
export function isChristmasHolidaySeason(): boolean {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed (0 = January, 11 = December)
    const day = now.getDate();

    // December (month 11): from day 1
    if (month === 11 && day >= 1) return true;
    // January (month 0): until day 10
    if (month === 0 && day <= 10) return true;

    return false;
}

type WinterModeContextType = {
    isWinter: boolean | null;
    toggle: () => void;
};

const WinterModeContext = createContext<WinterModeContextType | null>(null);

export function useWinterMode() {
    const context = useContext(WinterModeContext);
    if (!context) {
        throw new Error(
            'useWinterMode must be used within a WinterModeProvider',
        );
    }
    return context;
}

export function WinterModeProvider({ children }: { children: ReactNode }) {
    const [isWinter, setIsWinter] = useState<boolean | null>(null);

    const applyHue = useCallback((winter: boolean) => {
        const hue = winter ? WINTER_HUE : SUMMER_HUE;
        document.documentElement.style.setProperty('--baseHue', String(hue));
    }, []);

    // Initialize from localStorage on mount
    useEffect(() => {
        // Force summer mode outside winter season
        if (!isWinterSeason()) {
            setIsWinter(false);
            applyHue(false);
            return;
        }

        const stored = localStorage.getItem(STORAGE_KEY);
        // Default to winter mode during winter season
        const initialValue = stored !== null ? stored === 'true' : true;
        setIsWinter(initialValue);
        applyHue(initialValue);
    }, [applyHue]);

    const toggle = useCallback(() => {
        // Don't allow toggling to winter outside winter season
        if (!isWinterSeason()) {
            return;
        }

        setIsWinter((prev) => {
            const newValue = !prev;
            localStorage.setItem(STORAGE_KEY, String(newValue));
            applyHue(newValue);
            return newValue;
        });
    }, [applyHue]);

    return (
        <WinterModeContext.Provider value={{ isWinter, toggle }}>
            {children}
        </WinterModeContext.Provider>
    );
}
