import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import { getTimes } from 'suncalc';

// Zagreb, Croatia coordinates
const defaultLocation = { lat: 45.739, lon: 16.572 };

function isDaytime(now: Date): boolean {
    const { sunrise, sunset } = getTimes(
        now,
        defaultLocation.lat,
        defaultLocation.lon,
    );
    return now >= sunrise && now < sunset;
}

/**
 * Syncs the next-themes theme based on actual sunrise/sunset times.
 * Should be mounted once at the app level (inside a ThemeProvider).
 */
export function useThemeManager() {
    const { resolvedTheme, setTheme } = useTheme();

    useEffect(() => {
        function sync() {
            const isDay = isDaytime(new Date());
            if (isDay && resolvedTheme !== 'light') {
                setTheme('light');
            } else if (!isDay && resolvedTheme !== 'dark') {
                setTheme('dark');
            }
        }

        sync();
        const interval = setInterval(sync, 60_000);
        return () => clearInterval(interval);
    }, [resolvedTheme, setTheme]);
}
