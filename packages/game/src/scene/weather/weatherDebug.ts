/**
 * Weather switches for side-by-side checks and measurements, set by the
 * debug profile page (`apps/garden/app/debug/profile/game`) and passed to
 * `GameScene` as `weatherDebug`.
 */

/**
 * Layers a measurement can hide to compare the same frame with and without
 * them: `rain` (drops and splash rings), `snow` (falling flakes), `lightning`
 * (the bolt and its glow) and `sky` (clouds, the band and cloud shadows).
 */
export const weatherHiddenLayerNames = [
    'rain',
    'snow',
    'lightning',
    'sky',
] as const;

export type WeatherHiddenLayer = (typeof weatherHiddenLayerNames)[number];

/** Lightning debug: no scheduled strikes, or one strike at a scene time. */
export type WeatherLightningDebug =
    | { mode: 'off' }
    | {
          mode: 'at';
          /** Scene seconds (the `fixedTimeSeconds` clock when frozen). */
          seconds: number;
      };

export type WeatherDebugOptions = {
    /** Force reduced motion on (true) or off (false); unset follows the OS. */
    reducedMotion?: boolean;
    hide?: readonly WeatherHiddenLayer[];
    lightning?: WeatherLightningDebug;
    /**
     * Publish the frame (view, footprint, sky layout, timings) on
     * `window.__grediceWeatherFrame` for screenshot scripts.
     */
    inspect?: boolean;
};

export function isWeatherHiddenLayer(
    value: string,
): value is WeatherHiddenLayer {
    return weatherHiddenLayerNames.some((name) => name === value);
}
