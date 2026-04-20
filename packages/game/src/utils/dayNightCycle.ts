const DAY_NIGHT_CYCLE_DISABLED_STORAGE_KEY = 'game-day-night-cycle-disabled';

export const ALWAYS_DAY_TIME = 0.5;

export function isDayNightCycleDisabled() {
    return (
        typeof window !== 'undefined' &&
        window.localStorage.getItem(DAY_NIGHT_CYCLE_DISABLED_STORAGE_KEY) ===
            'true'
    );
}

export function setDayNightCycleDisabled(disabled: boolean) {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(
        DAY_NIGHT_CYCLE_DISABLED_STORAGE_KEY,
        String(disabled),
    );
}
