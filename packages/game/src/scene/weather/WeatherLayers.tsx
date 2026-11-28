'use client';

import { FogLayer } from './fog/FogLayer';
import { RainLayer } from './rain/RainLayer';
import { CloudShadowDriver } from './sky/CloudShadowDriver';
import { SkyClouds } from './sky/SkyClouds';
import { SnowLayer } from './snow/SnowLayer';
import { StormLayer } from './storm/StormLayer';
import { WindLayer } from './wind/WindLayer';

/**
 * The single mount point of the weather (GAME_ART.md "Weather"). Every layer
 * reads the shared `useWeatherFrame()` and holds its own render lease only
 * while it moves, so this list is the whole weather system: the cloud band
 * and haze, moving cloud shadows, rain, snow, fog and mist, the storm bolt
 * and wind. Sky props switch themselves off in the avatar views.
 */
export function WeatherLayers() {
    return (
        <>
            <SkyClouds />
            <CloudShadowDriver />
            <RainLayer />
            <SnowLayer />
            <FogLayer />
            <StormLayer />
            <WindLayer />
        </>
    );
}
