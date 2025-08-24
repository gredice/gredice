import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import { useGameState } from '../useGameState';

export function useThemeManager() {
    const { resolvedTheme, setTheme } = useTheme();

    const timeOfDay = useGameState((state) => state.timeOfDay);
    const isDay = timeOfDay > 0.2 && timeOfDay < 0.8;

    useEffect(() => {
        if (isDay && resolvedTheme !== 'light') {
            setTheme('light');
        } else if (!isDay && resolvedTheme !== 'dark') {
            setTheme('dark');
        }
    }, [isDay, resolvedTheme, setTheme]);
}
