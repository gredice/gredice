export type SpriteLightingWeather = {
    cloudy: number;
    foggy: number;
    rainy: number;
};

function getSunlightFactor(timeOfDay: number) {
    if (timeOfDay <= 0.2 || timeOfDay >= 0.81) {
        return 0;
    }

    if (timeOfDay < 0.225) {
        return (timeOfDay - 0.2) / 0.025;
    }

    if (timeOfDay <= 0.75) {
        return 1;
    }

    return 1 - (timeOfDay - 0.75) / 0.06;
}

export function getSpriteBrightness(
    timeOfDay: number,
    weather: SpriteLightingWeather | undefined,
) {
    const daylightFactor = getSunlightFactor(timeOfDay);
    const cloudy = weather?.cloudy ?? 0;
    const foggy = weather?.foggy ?? 0;
    const rainy = weather?.rainy ?? 0;
    const weatherShade = Math.min(
        0.35,
        cloudy * 0.18 + foggy * 0.22 + rainy * 0.08,
    );
    const baseBrightness = 0.28 + daylightFactor * 0.42;

    return Math.max(0.3, baseBrightness * (1 - weatherShade));
}
