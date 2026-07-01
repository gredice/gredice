'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import type { ReactNode } from 'react';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';
import * as SunCalc from 'suncalc';
import { useCurrentUser } from './currentUser';

const publicChromeQueryClient = new QueryClient();
const SUMMER_HUE = 28;
const WINTER_HUE = 202;
const WINTER_MODE_STORAGE_KEY = 'gredice-winter-mode';
const DAY_NIGHT_CYCLE_DISABLED_STORAGE_KEY = 'game-day-night-cycle-disabled';
const DAY_NIGHT_CYCLE_DISABLED_CHANGE_EVENT =
    'game-day-night-cycle-disabled-change';

// Zagreb, Croatia coordinates
const defaultLocation = { lat: 45.739, lon: 16.572 };

function isDaytime(now: Date): boolean {
    const times = SunCalc.getTimes(
        now,
        defaultLocation.lat,
        defaultLocation.lon,
    );
    const { sunrise, sunset } = times;

    if (sunrise && sunset) {
        return now >= sunrise && now < sunset;
    }

    if (times.alwaysUp) {
        return true;
    }

    if (times.alwaysDown) {
        return false;
    }

    return (
        SunCalc.getPosition(now, defaultLocation.lat, defaultLocation.lon)
            .altitude >= 0
    );
}

function isDayNightCycleDisabled() {
    try {
        return (
            typeof window !== 'undefined' &&
            window.localStorage.getItem(
                DAY_NIGHT_CYCLE_DISABLED_STORAGE_KEY,
            ) === 'true'
        );
    } catch {
        return false;
    }
}

function resolveDayNightTheme({
    dayNightCycleDisabled,
    daytime,
}: {
    dayNightCycleDisabled: boolean;
    daytime: boolean;
}) {
    return dayNightCycleDisabled || daytime ? 'light' : 'dark';
}

function DayNightThemeSync() {
    const { setTheme } = useTheme();

    useEffect(() => {
        function sync() {
            const nextTheme = resolveDayNightTheme({
                dayNightCycleDisabled: isDayNightCycleDisabled(),
                daytime: isDaytime(new Date()),
            });
            setTheme(nextTheme);
        }

        sync();
        const interval = window.setInterval(sync, 60_000);
        window.addEventListener(DAY_NIGHT_CYCLE_DISABLED_CHANGE_EVENT, sync);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener(
                DAY_NIGHT_CYCLE_DISABLED_CHANGE_EVENT,
                sync,
            );
        };
    }, [setTheme]);

    return null;
}

// Check if current date is within winter season (Dec 1 - Mar 20)
export function isWinterSeason(date: Date = new Date()): boolean {
    const month = date.getMonth();
    const day = date.getDate();

    if (month === 11 && day >= 1) return true;
    if (month === 0) return true;
    if (month === 1) return true;
    if (month === 2 && day <= 20) return true;

    return false;
}

// Check if current date is within Christmas holidays (Dec 1 - Jan 10)
export function isChristmasHolidaySeason(date: Date = new Date()): boolean {
    const month = date.getMonth();
    const day = date.getDate();

    if (month === 11 && day >= 1) return true;
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
            'useWinterMode must be used within a PublicChromeProvider',
        );
    }
    return context;
}

function WinterModeProvider({
    apiBasePath,
    children,
}: {
    apiBasePath: string;
    children: ReactNode;
}) {
    const [isWinter, setIsWinter] = useState<boolean | null>(null);
    const { data: user, isLoading } = useCurrentUser(apiBasePath);

    const applyHue = useCallback((winter: boolean) => {
        const hue = winter ? WINTER_HUE : SUMMER_HUE;
        document.documentElement.style.setProperty('--baseHue', String(hue));
    }, []);

    useEffect(() => {
        const stored = localStorage.getItem(WINTER_MODE_STORAGE_KEY);
        const initialValue =
            stored !== null ? stored === 'true' : isWinterSeason();
        setIsWinter(initialValue);
        applyHue(initialValue);
    }, [applyHue]);

    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (user || !isWinterSeason()) {
            setIsWinter(false);
            localStorage.setItem(WINTER_MODE_STORAGE_KEY, 'false');
            applyHue(false);
        }
    }, [applyHue, isLoading, user]);

    const toggle = useCallback(() => {
        if (user || !isWinterSeason()) {
            return;
        }

        setIsWinter((previous) => {
            const nextValue = !previous;
            localStorage.setItem(WINTER_MODE_STORAGE_KEY, String(nextValue));
            applyHue(nextValue);
            return nextValue;
        });
    }, [applyHue, user]);

    return (
        <WinterModeContext.Provider value={{ isWinter, toggle }}>
            {children}
        </WinterModeContext.Provider>
    );
}

export function PublicChromeProvider({
    apiBasePath = '/api/gredice',
    children,
}: {
    apiBasePath?: string;
    children: ReactNode;
}) {
    return (
        <QueryClientProvider client={publicChromeQueryClient}>
            <ThemeProvider attribute="class" disableTransitionOnChange>
                <DayNightThemeSync />
                <WinterModeProvider apiBasePath={apiBasePath}>
                    {children}
                </WinterModeProvider>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
