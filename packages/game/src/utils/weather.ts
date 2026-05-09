const WEATHER_VISUALIZATION_DISABLED_STORAGE_KEY =
    'game-weather-visualization-disabled';
let cachedWeatherVisualizationDisabled: boolean | undefined;

export function isWeatherVisualizationDisabled() {
    if (cachedWeatherVisualizationDisabled !== undefined) {
        return cachedWeatherVisualizationDisabled;
    }

    try {
        cachedWeatherVisualizationDisabled =
            typeof window !== 'undefined' &&
            window.localStorage.getItem(
                WEATHER_VISUALIZATION_DISABLED_STORAGE_KEY,
            ) === 'true';
    } catch {
        cachedWeatherVisualizationDisabled = false;
    }
    return cachedWeatherVisualizationDisabled;
}

export function setWeatherVisualizationDisabled(disabled: boolean) {
    if (typeof window === 'undefined') {
        return;
    }

    cachedWeatherVisualizationDisabled = disabled;
    try {
        window.localStorage.setItem(
            WEATHER_VISUALIZATION_DISABLED_STORAGE_KEY,
            String(disabled),
        );
    } catch {
        // Ignore storage failures and keep the in-memory state updated.
    }
}
