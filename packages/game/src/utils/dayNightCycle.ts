const DAY_NIGHT_CYCLE_DISABLED_STORAGE_KEY = 'game-day-night-cycle-disabled';
let cachedDayNightCycleDisabled: boolean | undefined;

// Normalized midpoint of the day-night cycle, equivalent to noon.
export const ALWAYS_DAY_TIME = 0.5;

export function isDayNightCycleDisabled() {
    if (cachedDayNightCycleDisabled !== undefined) {
        return cachedDayNightCycleDisabled;
    }

    try {
        cachedDayNightCycleDisabled =
            typeof window !== 'undefined' &&
            window.localStorage.getItem(DAY_NIGHT_CYCLE_DISABLED_STORAGE_KEY) ===
                'true';
    } catch {
        cachedDayNightCycleDisabled = false;
    }
    return cachedDayNightCycleDisabled;
}

export function setDayNightCycleDisabled(disabled: boolean) {
    if (typeof window === 'undefined') {
        return;
    }

    cachedDayNightCycleDisabled = disabled;
    window.localStorage.setItem(
        DAY_NIGHT_CYCLE_DISABLED_STORAGE_KEY,
        String(disabled),
    );
}
