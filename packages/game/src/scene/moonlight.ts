import SunCalc from 'suncalc';

const MOONLESS_NIGHT_LIGHT_SCALE = 0.32;
const MOONLESS_NIGHT_SKY_SCALE = 0.6;

const NIGHT_VISIBILITY = {
    dawnFadeStart: 0.2,
    dayStart: 0.25,
    duskStart: 0.75,
    nightStart: 0.8,
};

const MOON_HORIZON_FADE = {
    start: -0.05,
    end: 0.18,
};

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

function mix(from: number, to: number, amount: number) {
    return from + (to - from) * amount;
}

export function getNightAmount(timeOfDay: number) {
    const dawnAmount =
        1 -
        smoothstep(
            NIGHT_VISIBILITY.dawnFadeStart,
            NIGHT_VISIBILITY.dayStart,
            timeOfDay,
        );
    const duskAmount = smoothstep(
        NIGHT_VISIBILITY.duskStart,
        NIGHT_VISIBILITY.nightStart,
        timeOfDay,
    );
    return Math.max(dawnAmount, duskAmount);
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
        position.altitude,
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
