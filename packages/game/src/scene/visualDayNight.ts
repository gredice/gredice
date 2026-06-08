export const visualDayNightTimes = {
    dawnNightEnd: 0.14,
    dawnLightStart: 0.16,
    sunrise: 0.2,
    dawnLightEnd: 0.24,
    dayStart: 0.28,
    lateDayStart: 0.75,
    sunset: 0.8,
    duskNightStart: 0.82,
    nightStart: 0.88,
};

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

export function smoothstep(edge0: number, edge1: number, value: number) {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

export function getVisualDaylightAmount(timeOfDay: number) {
    return Math.min(
        smoothstep(
            visualDayNightTimes.dawnLightStart,
            visualDayNightTimes.dayStart,
            timeOfDay,
        ),
        1 -
            smoothstep(
                visualDayNightTimes.sunset,
                visualDayNightTimes.nightStart,
                timeOfDay,
            ),
    );
}

export function getVisualNightAmount(timeOfDay: number) {
    const dawnAmount =
        1 -
        smoothstep(
            visualDayNightTimes.dawnNightEnd,
            visualDayNightTimes.dawnLightEnd,
            timeOfDay,
        );
    const duskAmount = smoothstep(
        visualDayNightTimes.duskNightStart,
        visualDayNightTimes.nightStart,
        timeOfDay,
    );

    return Math.max(dawnAmount, duskAmount);
}
