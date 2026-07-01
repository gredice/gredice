import * as SunCalc from 'suncalc';
import { getVisualNightAmount, smoothstep } from './visualDayNight';

const MOONLESS_NIGHT_LIGHT_SCALE = 0.32;
const MOONLESS_NIGHT_SKY_SCALE = 0.6;

const MOON_HORIZON_FADE = {
    start: -0.05,
    end: 0.18,
};
const degreesToRadiansScale = Math.PI / 180;

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

function mix(from: number, to: number, amount: number) {
    return from + (to - from) * amount;
}

export function getNightAmount(timeOfDay: number) {
    return getVisualNightAmount(timeOfDay);
}

export function resolveMoonlitNightScales({
    moonlight,
    timeOfDay,
}: {
    moonlight: number;
    timeOfDay: number;
}) {
    const nightAmount = getNightAmount(timeOfDay);
    const visibleMoonlight = clamp01(moonlight);
    const moonNightLightScale =
        MOONLESS_NIGHT_LIGHT_SCALE +
        (1 - MOONLESS_NIGHT_LIGHT_SCALE) * visibleMoonlight;
    const moonNightSkyScale =
        MOONLESS_NIGHT_SKY_SCALE +
        (1 - MOONLESS_NIGHT_SKY_SCALE) * visibleMoonlight;

    return {
        lightScale: mix(1, moonNightLightScale, nightAmount),
        nightAmount,
        skyScale: mix(1, moonNightSkyScale, nightAmount),
        visibleMoonlight,
    };
}

export function getVisibleMoonlight({
    date,
    location,
}: {
    date: Date;
    location: { lat: number; lon: number };
}) {
    const illumination = SunCalc.getMoonIllumination(date);
    const position = SunCalc.getMoonPosition(date, location.lat, location.lon);
    const horizonVisibility = smoothstep(
        MOON_HORIZON_FADE.start,
        MOON_HORIZON_FADE.end,
        position.altitude * degreesToRadiansScale,
    );

    return clamp01(illumination.fraction) * horizonVisibility;
}

export function getMoonlitNightScales({
    date,
    location,
    timeOfDay,
}: {
    date: Date;
    location: { lat: number; lon: number };
    timeOfDay: number;
}) {
    return resolveMoonlitNightScales({
        moonlight: getVisibleMoonlight({ date, location }),
        timeOfDay,
    });
}
