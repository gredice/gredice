import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import * as SunCalc from 'suncalc';
import {
    DAY_NIGHT_CYCLE_DISABLED_CHANGE_EVENT,
    isDayNightCycleDisabled,
} from '../utils/dayNightCycle';
import { resolveDayNightTheme } from './dayNightTheme';

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

/**
 * Syncs the next-themes theme based on actual sunrise/sunset times and the
 * user's forced daytime setting.
 * Should be mounted once at the app level (inside a ThemeProvider).
 */
export function useThemeManager() {
    const { resolvedTheme, setTheme } = useTheme();

    useEffect(() => {
        function sync() {
            const nextTheme = resolveDayNightTheme({
                dayNightCycleDisabled: isDayNightCycleDisabled(),
                isDaytime: isDaytime(new Date()),
            });
            if (resolvedTheme !== nextTheme) {
                setTheme(nextTheme);
            }
        }

        sync();
        const interval = setInterval(sync, 60_000);
        window.addEventListener(DAY_NIGHT_CYCLE_DISABLED_CHANGE_EVENT, sync);
        return () => {
            clearInterval(interval);
            window.removeEventListener(
                DAY_NIGHT_CYCLE_DISABLED_CHANGE_EVENT,
                sync,
            );
        };
    }, [resolvedTheme, setTheme]);
}
