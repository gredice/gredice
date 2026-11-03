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
    publicEnvironmentPaintMaxAge,
    publicEnvironmentPaintScript,
    publicEnvironmentPaintStorageKey,
    publicEnvironmentWeatherPresets,
    readPublicEnvironmentPaint,
    resolvePublicEnvironmentDateAtMinutes,
    resolvePublicEnvironmentPaint,
    resolvePublicEnvironmentSnapshot,
} from './publicEnvironment';

type PublicEnvironmentContextValue = {
    date: Date;
    debugEnabled: boolean;
    debugMinutes: number | null;
    hydrated: boolean;
    setDebugMinutes: (minutes: number | null) => void;
    setWeatherKind: (kind: PublicEnvironmentWeatherKind) => void;
    snapshot: PublicEnvironmentSnapshot;
    weather: PublicEnvironmentWeather;
    weatherKind: PublicEnvironmentWeatherKind;
};

const PublicEnvironmentContext =
    createContext<PublicEnvironmentContextValue | null>(null);

const publicEnvironmentRootProperties = [
    '--baseHue',
    '--environmentHue',
    '--public-environment-contrast-boost',
    '--public-environment-sky',
];

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
    const [restoredWeather, setRestoredWeather] =
        useState<PublicEnvironmentWeather | null>(null);

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
        return (
            weatherQuery.data ??
            restoredWeather ??
            clearPublicEnvironmentWeather
        );
    }, [debugEnabled, restoredWeather, weatherKind, weatherQuery.data]);

    const snapshot = useMemo(
        () => resolvePublicEnvironmentSnapshot({ date, weather }),
        [date, weather],
    );
    const paint = useMemo(
        () => resolvePublicEnvironmentPaint({ snapshot, weather }),
        [snapshot, weather],
    );
    // Only a sky with live weather is worth restoring on the next page load.
    // Stamping it with the weather's fetch time lets failed weather requests
    // age it out instead of keeping old weather fresh.
    const persistedPaintAt =
        weatherQuery.data &&
        (!debugEnabled || (debugMinutes === null && weatherKind === 'live'))
            ? weatherQuery.dataUpdatedAt
            : null;

    useLayoutEffect(() => {
        const root = document.documentElement;
        // Values the inline script restored belong to this provider, not to
        // the document, so cleanup must not put them back.
        const restored = root.hasAttribute('data-public-environment-restored');
        root.removeAttribute('data-public-environment-restored');
        const properties = publicEnvironmentRootProperties.map((property) => ({
            priority: restored ? '' : root.style.getPropertyPriority(property),
            property,
            value: restored ? '' : root.style.getPropertyValue(property),
        }));
        const environmentAttribute = restored
            ? null
            : root.getAttribute('data-public-environment');

        return () => {
            for (const { priority, property, value } of properties) {
                if (value) {
                    root.style.setProperty(property, value, priority);
                } else {
                    root.style.removeProperty(property);
                }
            }
            if (environmentAttribute === null) {
                root.removeAttribute('data-public-environment');
            } else {
                root.setAttribute(
                    'data-public-environment',
                    environmentAttribute,
                );
            }
        };
    }, []);

    // The inline script already painted the stored sky. Adopt its weather
    // before the first paint so the live sky does not flash clear first.
    useLayoutEffect(() => {
        setRestoredWeather(
            parsePublicEnvironmentWeather(
                readPublicEnvironmentPaint(
                    publicEnvironmentPaintStorageKey,
                    publicEnvironmentPaintMaxAge,
                )?.weather,
            ),
        );
    }, []);

    // Apply reading colors before the new sky is painted. ThemeProvider also
    // suppresses transitions when switching between the light/dark palettes.
    // Keep this in sync with applyPublicEnvironmentPaint.
    useLayoutEffect(() => {
        const root = document.documentElement;
        const hue = String(paint.themeHue);
        root.style.setProperty('--baseHue', hue);
        root.style.setProperty('--environmentHue', hue);
        root.style.setProperty(
            '--public-environment-contrast-boost',
            String(paint.contrastBoost),
        );
        root.style.setProperty('--public-environment-sky', paint.sky);
        root.dataset.publicEnvironment = 'on';
        setTheme(snapshot.dark ? 'dark' : 'light');
    }, [paint, setTheme, snapshot.dark]);

    useEffect(() => {
        if (persistedPaintAt === null) return;
        try {
            localStorage.setItem(
                publicEnvironmentPaintStorageKey,
                JSON.stringify({ ...paint, at: persistedPaintAt }),
            );
        } catch {
            // Storage can be unavailable; the sky then starts from default.
        }
    }, [paint, persistedPaintAt]);

    const value = useMemo(
        () => ({
            date,
            debugEnabled,
            debugMinutes,
            hydrated,
            setDebugMinutes,
            setWeatherKind,
            snapshot,
            weather,
            weatherKind,
        }),
        [
            date,
            debugEnabled,
            debugMinutes,
            hydrated,
            snapshot,
            weather,
            weatherKind,
        ],
    );

    return (
        <PublicEnvironmentContext.Provider value={value}>
            {/* Paints the stored sky on full page loads before hydration. */}
            <script
                // biome-ignore lint/security/noDangerouslySetInnerHtml: static script built from local constants.
                dangerouslySetInnerHTML={{
                    __html: publicEnvironmentPaintScript,
                }}
                suppressHydrationWarning
            />
            {hydrated ? (
                <PublicSkyBackdrop snapshot={snapshot} weather={weather} />
            ) : null}
            {children}
        </PublicEnvironmentContext.Provider>
    );
}
