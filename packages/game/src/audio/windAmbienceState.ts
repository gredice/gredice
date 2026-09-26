function smooth(from: number, to: number, value: number) {
    const amount = Math.min(1, Math.max(0, (value - from) / (to - from)));
    return amount * amount * (3 - 2 * amount);
}

/** Scene/API wind strength is 0–3, not m/s. Adjacent textures share one gain budget. */
export function resolveWindAmbience(windSpeed = 0, rainIntensity = 0) {
    const wind = Number.isFinite(windSpeed)
        ? Math.min(3, Math.max(0, windSpeed))
        : 0;
    const rain = Number.isFinite(rainIntensity)
        ? Math.min(1, Math.max(0, rainIntensity))
        : 0;
    const medium = smooth(1, 2, wind);
    const strong = smooth(2, 3, wind);
    const gain =
        smooth(0.25, 1, wind) *
        (0.12 + 0.14 * smooth(1, 3, wind)) *
        (1 - rain * 0.3);
    return [
        { name: 'light', gain: gain * (1 - medium) },
        { name: 'medium', gain: gain * medium * (1 - strong) },
        { name: 'strong', gain: gain * strong },
    ];
}
