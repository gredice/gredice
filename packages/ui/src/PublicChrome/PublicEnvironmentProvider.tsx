'use client';

import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import type { ReactNode } from 'react';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import * as SunCalc from 'suncalc';
import { PublicSkyBackdrop } from './PublicSkyBackdrop';
import {
    clearPublicEnvironmentWeather,
    type PublicEnvironmentSnapshot,
    type PublicEnvironmentWeather,
    type PublicEnvironmentWeatherKind,
    parsePublicEnvironmentWeather,
    publicEnvironmentDefaultLocation,
    publicEnvironmentWeatherPresets,
    resolvePublicEnvironmentDateAtMinutes,
    resolvePublicEnvironmentSnapshot,
} from './publicEnvironment';
import { useWinterMode } from './WinterModeContext';

const SUMMER_HUE = 28;
const WINTER_HUE = 202;
const PUBLIC_ENVIRONMENT_STORAGE_KEY = 'gredice-public-environment-enabled';
const DAY_NIGHT_CYCLE_DISABLED_STORAGE_KEY = 'game-day-night-cycle-disabled';
const DAY_NIGHT_CYCLE_DISABLED_CHANGE_EVENT =
    'game-day-night-cycle-disabled-change';

type PublicEnvironmentContextValue = {
    date: Date;
    debugEnabled: boolean;
    debugMinutes: number | null;
    enabled: boolean | null;
    setDebugMinutes: (minutes: number | null) => void;
    setWeatherKind: (kind: PublicEnvironmentWeatherKind) => void;
    snapshot: PublicEnvironmentSnapshot;
    toggle: () => void;
    weather: PublicEnvironmentWeather;
    weatherKind: PublicEnvironmentWeatherKind;
};

const PublicEnvironmentContext =
    createContext<PublicEnvironmentContextValue | null>(null);

function isDaytime(now: Date) {
    const { lat, lon } = publicEnvironmentDefaultLocation;
    const times = SunCalc.getTimes(now, lat, lon);

    if (times.sunrise && times.sunset) {
        return now >= times.sunrise && now < times.sunset;
    }

    if (times.alwaysUp) return true;
    if (times.alwaysDown) return false;
    return SunCalc.getPosition(now, lat, lon).altitude >= 0;
}

function isDayNightCycleDisabled() {
    try {
        return (
            window.localStorage.getItem(
                DAY_NIGHT_CYCLE_DISABLED_STORAGE_KEY,
            ) === 'true'
        );
    } catch {
        return false;
    }
}

function readDebugFlag(value: unknown) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    return Reflect.get(value, 'enabled') === true;
}

export function usePublicEnvironment() {
    const context = useContext(PublicEnvironmentContext);
    if (!context) {
        throw new Error(
            'usePublicEnvironment must be used within a PublicChromeProvider',
        );
    }
    return context;
}

export function PublicEnvironmentProvider({
    apiBasePath,
    children,
    debugApiPath,
}: {
    apiBasePath: string;
    children: ReactNode;
    debugApiPath: string;
}) {
    const { isWinter } = useWinterMode();
    const { setTheme } = useTheme();
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [now, setNow] = useState(() => new Date());
    const [debugMinutes, setDebugMinutes] = useState<number | null>(null);
    const [weatherKind, setWeatherKind] =
        useState<PublicEnvironmentWeatherKind>('live');

    useEffect(() => {
        try {
            setEnabled(
                window.localStorage.getItem(PUBLIC_ENVIRONMENT_STORAGE_KEY) ===
                    'true',
            );
        } catch {
            setEnabled(false);
        }
    }, []);

    useEffect(() => {
        const updateNow = () => setNow(new Date());
        const interval = window.setInterval(updateNow, 60_000);
        window.addEventListener(
            DAY_NIGHT_CYCLE_DISABLED_CHANGE_EVENT,
            updateNow,
        );
        return () => {
            window.clearInterval(interval);
            window.removeEventListener(
                DAY_NIGHT_CYCLE_DISABLED_CHANGE_EVENT,
                updateNow,
            );
        };
    }, []);

    const debugFlagQuery = useQuery({
        queryKey: ['public-environment-debug', debugApiPath],
        queryFn: async () => {
            const response = await fetch(debugApiPath, { cache: 'no-store' });
            if (!response.ok) return false;
            return readDebugFlag(await response.json());
        },
        retry: false,
        staleTime: 5 * 60 * 1000,
    });
    const debugEnabled = debugFlagQuery.data === true;

    useEffect(() => {
        if (!debugEnabled) {
            setDebugMinutes(null);
            setWeatherKind('live');
        }
    }, [debugEnabled]);

    const weatherQuery = useQuery({
        queryKey: ['public-environment-weather', apiBasePath],
        queryFn: async () => {
            const response = await fetch(`${apiBasePath}/api/data/weather/now`);
            if (!response.ok) return null;
            return parsePublicEnvironmentWeather(await response.json());
        },
        enabled: enabled === true,
        refetchInterval: 5 * 60 * 1000,
        retry: 1,
        staleTime: 5 * 60 * 1000,
    });

    const date = useMemo(() => {
        if (!debugEnabled || debugMinutes === null) {
            return now;
        }
        return resolvePublicEnvironmentDateAtMinutes(now, debugMinutes);
    }, [debugEnabled, debugMinutes, now]);

    const weather = useMemo(() => {
        if (debugEnabled && weatherKind !== 'live') {
            return publicEnvironmentWeatherPresets[weatherKind];
        }
        return weatherQuery.data ?? clearPublicEnvironmentWeather;
    }, [debugEnabled, weatherKind, weatherQuery.data]);

    const snapshot = useMemo(
        () => resolvePublicEnvironmentSnapshot({ date, weather }),
        [date, weather],
    );

    useEffect(() => {
        if (enabled === null || isWinter === null) return;

        const root = document.documentElement;
        const immersive = enabled;
        const theme = immersive
            ? snapshot.dark
                ? 'dark'
                : 'light'
            : isDayNightCycleDisabled() || isDaytime(now)
              ? 'light'
              : 'dark';
        const hue = immersive
            ? snapshot.themeHue
            : isWinter
              ? WINTER_HUE
              : SUMMER_HUE;

        root.style.setProperty('--baseHue', String(hue));
        if (immersive) {
            root.style.setProperty('--environmentHue', String(hue));
            root.dataset.publicEnvironment = 'on';
        } else {
            root.style.removeProperty('--environmentHue');
            delete root.dataset.publicEnvironment;
        }
        setTheme(theme);
    }, [enabled, isWinter, now, setTheme, snapshot.dark, snapshot.themeHue]);

    const toggle = useCallback(() => {
        setEnabled((current) => {
            const next = !(current ?? false);
            try {
                window.localStorage.setItem(
                    PUBLIC_ENVIRONMENT_STORAGE_KEY,
                    String(next),
                );
            } catch {
                // The in-memory preference still works when storage is blocked.
            }
            return next;
        });
    }, []);

    const value = useMemo(
        () => ({
            date,
            debugEnabled,
            debugMinutes,
            enabled,
            setDebugMinutes,
            setWeatherKind,
            snapshot,
            toggle,
            weather,
            weatherKind,
        }),
        [
            date,
            debugEnabled,
            debugMinutes,
            enabled,
            snapshot,
            toggle,
            weather,
            weatherKind,
        ],
    );

    return (
        <PublicEnvironmentContext.Provider value={value}>
            {enabled ? (
                <PublicSkyBackdrop snapshot={snapshot} weather={weather} />
            ) : null}
            {children}
        </PublicEnvironmentContext.Provider>
    );
}
