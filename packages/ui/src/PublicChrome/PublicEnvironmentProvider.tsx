'use client';

import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import type { ReactNode } from 'react';
import {
    createContext,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useState,
} from 'react';
import { PublicSkyBackdrop } from './PublicSkyBackdrop';
import {
    clearPublicEnvironmentWeather,
    type PublicEnvironmentSnapshot,
    type PublicEnvironmentWeather,
    type PublicEnvironmentWeatherKind,
    parsePublicEnvironmentWeather,
    publicEnvironmentWeatherPresets,
    resolvePublicEnvironmentDateAtMinutes,
    resolvePublicEnvironmentSnapshot,
} from './publicEnvironment';

type PublicEnvironmentContextValue = {
    date: Date;
    debugEnabled: boolean;
    debugMinutes: number | null;
    setDebugMinutes: (minutes: number | null) => void;
    setWeatherKind: (kind: PublicEnvironmentWeatherKind) => void;
    snapshot: PublicEnvironmentSnapshot;
    weather: PublicEnvironmentWeather;
    weatherKind: PublicEnvironmentWeatherKind;
};

const PublicEnvironmentContext =
    createContext<PublicEnvironmentContextValue | null>(null);

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
    const { setTheme } = useTheme();
    const [hydrated, setHydrated] = useState(false);
    const [now, setNow] = useState(() => new Date());
    const [debugMinutes, setDebugMinutes] = useState<number | null>(null);
    const [weatherKind, setWeatherKind] =
        useState<PublicEnvironmentWeatherKind>('live');

    useEffect(() => setHydrated(true), []);

    useEffect(() => {
        const updateNow = () => setNow(new Date());
        const interval = window.setInterval(updateNow, 60_000);
        return () => window.clearInterval(interval);
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

    // Apply reading colors before the new sky is painted. ThemeProvider also
    // suppresses transitions when switching between the light/dark palettes.
    useLayoutEffect(() => {
        const root = document.documentElement;
        const hue = String(snapshot.themeHue);
        root.style.setProperty('--baseHue', hue);
        root.style.setProperty('--environmentHue', hue);
        root.dataset.publicEnvironment = 'on';
        setTheme(snapshot.dark ? 'dark' : 'light');
    }, [setTheme, snapshot.dark, snapshot.themeHue]);

    const value = useMemo(
        () => ({
            date,
            debugEnabled,
            debugMinutes,
            setDebugMinutes,
            setWeatherKind,
            snapshot,
            weather,
            weatherKind,
        }),
        [date, debugEnabled, debugMinutes, snapshot, weather, weatherKind],
    );

    return (
        <PublicEnvironmentContext.Provider value={value}>
            {hydrated ? (
                <PublicSkyBackdrop snapshot={snapshot} weather={weather} />
            ) : null}
            {children}
        </PublicEnvironmentContext.Provider>
    );
}
