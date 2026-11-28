/**
 * How much cloud and fog let the sun or moon show (GAME_ART.md "Weather >
 * Clear" and "Overcast"): the disc hides as cloud passes 0.55 and is gone
 * at 0.85, and fog hides it from 0.3 to 0.8. Falling snow hides it too
 * (the target's snow states). No residual ghost disc.
 */
export function resolveSkyBodyWeatherVisibility({
    cloudy,
    foggy,
    snowy = 0,
}: {
    cloudy: number;
    foggy: number;
    snowy?: number;
}) {
    const smoothstep = (edge0: number, edge1: number, value: number) => {
        const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    };
    return (
        (1 - smoothstep(0.55, 0.85, cloudy)) *
        (1 - smoothstep(0.3, 0.8, foggy)) *
        (1 - smoothstep(0, 0.3, snowy))
    );
}
