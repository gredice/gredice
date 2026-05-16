'use client';

import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';

const SUMMER_HUE = 28;
const WINTER_HUE = 202;
const STORAGE_KEY = 'gredice-winter-mode';

// Check if current date is within winter season (Dec 1 - Mar 20)
export function isWinterSeason(date: Date = new Date()): boolean {
    const month = date.getMonth(); // 0-indexed (0 = January, 11 = December)
    const day = date.getDate();

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
export function isChristmasHolidaySeason(date: Date = new Date()): boolean {
    const month = date.getMonth(); // 0-indexed (0 = January, 11 = December)
    const day = date.getDate();

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
    const { data: user, isLoading } = useCurrentUser();

    const applyHue = useCallback((winter: boolean) => {
        const hue = winter ? WINTER_HUE : SUMMER_HUE;
        document.documentElement.style.setProperty('--baseHue', String(hue));
    }, []);

    // Initialize from localStorage on mount so visuals are applied immediately
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        // Default to winter mode during winter season
        const initialValue =
            stored !== null ? stored === 'true' : isWinterSeason();
        setIsWinter(initialValue);
        applyHue(initialValue);
    }, [applyHue]);

    // Once user data is available, force summer for authenticated users or outside winter season and persist to localStorage
    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (user || !isWinterSeason()) {
            setIsWinter(false);
            localStorage.setItem(STORAGE_KEY, 'false');
            applyHue(false);
        }
    }, [applyHue, isLoading, user]);

    const toggle = useCallback(() => {
        // Logged-in users always stay in summer mode, and winter mode is disabled outside winter season
        if (user || !isWinterSeason()) {
            return;
        }

        setIsWinter((prev) => {
            const newValue = !prev;
            localStorage.setItem(STORAGE_KEY, String(newValue));
            applyHue(newValue);
            return newValue;
        });
    }, [applyHue, user]);

    return (
        <WinterModeContext.Provider value={{ isWinter, toggle }}>
            {children}
        </WinterModeContext.Provider>
    );
}
