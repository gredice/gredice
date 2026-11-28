import { Color } from 'three';
import { resolveCoverDimmingShare } from '../../atmosphereLighting';
import { gameWeatherSkyGrey } from '../../gameArtStyle';
import type { SkyGradientColors } from '../../skyGradient';
import { smoothstep } from '../../visualDayNight';
import type { WeatherRoleTimeWeights } from '../weatherRoles';
import { resolveBandCover } from './cloudBand';

/*
 * The grey rain and storm sky (`gameWeatherSkyGrey` in `gameArtStyle.ts`):
 * high cover with rain or thunder takes colour out of the backdrop only,
 * the sky gradient and the cloud band. Colours are `THREE.Color` in the
 * working (linear) colour space; each keeps its luminance.
 */

export type WeatherSkyGreyWeather = {
    cloudy?: number;
    rainy?: number;
    thundery?: number;
    /** Damped storm amount of blended weather (`weatherBlend.ts`). */
    storm?: number;
};

/** How far a colour moves toward `tint`, and the grey it moves to. */
export type WeatherSkyGrey = {
    amount: number;
    tint: Color;
};

const dayTint = new Color(gameWeatherSkyGrey.dayTint);
const sunsetTint = new Color(gameWeatherSkyGrey.sunsetTint);
const nightTint = new Color(gameWeatherSkyGrey.nightTint);

function clamp01(value: number) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Relative luminance of a linear colour. */
function luminance(color: Color) {
    return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

/**
 * How grey the weather makes the sky, 0 to 1, before the time of day: the
 * cover curve (full from cover 0.75) times the wet, whichever of rain and
 * storm gives more. Rain over its ramp takes the reported cover, so a
 * low-cover shower keeps its colour. The storm amount takes the cover the
 * band draws (`resolveBandCover`): thunder always brings the deck, so a
 * storm reported as partly cloudy greys like the deck it shows. Exactly 0
 * without rain or thunder, so clear, cloudy, fog and snow skies keep every
 * colour.
 */
export function resolveWeatherSkyGreyAmount(
    weather: WeatherSkyGreyWeather | null | undefined,
) {
    if (!weather) {
        return 0;
    }
    const [rainFrom, rainTo] = gameWeatherSkyGrey.rainRamp;
    const rain = smoothstep(rainFrom, rainTo, clamp01(weather.rainy ?? 0));
    const storm = clamp01(weather.storm ?? weather.thundery ?? 0);
    if (rain <= 0 && storm <= 0) {
        return 0;
    }
    const cloudy = weather.cloudy ?? 0;
    return Math.max(
        resolveCoverDimmingShare(cloudy) * rain,
        resolveCoverDimmingShare(resolveBandCover(cloudy, storm)) * storm,
    );
}

/**
 * The sky grey at a time of day, from the weather roles' time weights
 * (`resolveWeatherRoleTimeWeights`): sunset and night take less colour,
 * toward a rose and a slate grey.
 */
export function resolveWeatherSkyGrey(
    weather: WeatherSkyGreyWeather | null | undefined,
    time: WeatherRoleTimeWeights,
    target: WeatherSkyGrey = { amount: 0, tint: new Color() },
): WeatherSkyGrey {
    const midday = clamp01(time.midday);
    const sunset = clamp01(time.sunset);
    const night = clamp01(time.night);
    const total = midday + sunset + night;
    const share = total > 0 ? 1 / total : 0;
    const strength =
        (gameWeatherSkyGrey.dayStrength * midday +
            gameWeatherSkyGrey.sunsetStrength * sunset +
            gameWeatherSkyGrey.nightStrength * night) *
        share;
    target.amount = resolveWeatherSkyGreyAmount(weather) * strength;
    target.tint.setRGB(
        (dayTint.r * midday + sunsetTint.r * sunset + nightTint.r * night) *
            share,
        (dayTint.g * midday + sunsetTint.g * sunset + nightTint.g * night) *
            share,
        (dayTint.b * midday + sunsetTint.b * sunset + nightTint.b * night) *
            share,
    );
    return target;
}

/**
 * Moves a linear colour toward the grey tint at its own luminance, in
 * place. A zero amount leaves it exactly as it was.
 */
export function applyWeatherSkyGrey(color: Color, grey: WeatherSkyGrey) {
    const amount = clamp01(grey.amount);
    if (amount <= 0) {
        return color;
    }
    const tintLuminance = luminance(grey.tint);
    const scale = tintLuminance > 0 ? luminance(color) / tintLuminance : 0;
    color.setRGB(
        color.r + (Math.min(1, grey.tint.r * scale) - color.r) * amount,
        color.g + (Math.min(1, grey.tint.g * scale) - color.g) * amount,
        color.b + (Math.min(1, grey.tint.b * scale) - color.b) * amount,
    );
    return color;
}

/** A greyed copy of a sky gradient; the same gradient at a zero amount. */
export function applyWeatherSkyGreyToGradient(
    gradient: SkyGradientColors,
    grey: WeatherSkyGrey,
): SkyGradientColors {
    if (clamp01(grey.amount) <= 0) {
        return gradient;
    }
    return {
        ...gradient,
        zenith: applyWeatherSkyGrey(gradient.zenith.clone(), grey),
        upper: applyWeatherSkyGrey(gradient.upper.clone(), grey),
        horizon: applyWeatherSkyGrey(gradient.horizon.clone(), grey),
        lower: applyWeatherSkyGrey(gradient.lower.clone(), grey),
        sunGlow: applyWeatherSkyGrey(gradient.sunGlow.clone(), grey),
        moonGlow: applyWeatherSkyGrey(gradient.moonGlow.clone(), grey),
    };
}
