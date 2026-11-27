'use client';

import { createContext, useContext, useEffect, useState } from 'react';

/**
 * The one reduced-motion switch for every weather renderer (GAME_ART.md
 * "Weather > Reduced motion"): the OS `prefers-reduced-motion` setting,
 * unless the debug profile forces it with `&reducedMotion=1` (or `=0`).
 */
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

/** Debug override; `null` follows the OS setting. */
export const WeatherReducedMotionOverrideContext = createContext<
    boolean | null
>(null);

export function getPrefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia(reducedMotionQuery).matches
    );
}

function usePrefersReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(
        getPrefersReducedMotion,
    );

    useEffect(() => {
        if (
            typeof window === 'undefined' ||
            typeof window.matchMedia !== 'function'
        ) {
            return;
        }

        const mediaQuery = window.matchMedia(reducedMotionQuery);
        const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
        handleChange();
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return prefersReducedMotion;
}

export function useWeatherReducedMotion() {
    const override = useContext(WeatherReducedMotionOverrideContext);
    const prefersReducedMotion = usePrefersReducedMotion();
    return override ?? prefersReducedMotion;
}
