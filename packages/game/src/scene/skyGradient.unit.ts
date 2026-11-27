import assert from 'node:assert/strict';
import test from 'node:test';
import {
    defaultGameBackgroundPaletteIndex,
    getGameBackgroundPaletteIndexByKey,
} from './backgroundPalettes';
import { resolveMoonlitNightScales } from './moonlight';
import {
    cloneSkyGradientColors,
    isSkyGradientWithinEpsilon,
    lerpSkyGradientColors,
    resolveEnvironmentSkyBackgroundColors,
    resolveGroundViewSkyGradientColors,
    resolveSkyBackgroundColor,
    resolveSkyGradientColors,
} from './skyGradient';
import { getSolarEclipseVisualScales } from './solarEclipse';

function colorDistance(
    first: { b: number; g: number; r: number },
    second: { b: number; g: number; r: number },
) {
    return Math.hypot(
        first.r - second.r,
        first.g - second.g,
        first.b - second.b,
    );
}

function colorLuminance(color: { b: number; g: number; r: number }) {
    return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function resolveGradient({
    moonlight = 0,
    paletteIndex = defaultGameBackgroundPaletteIndex,
    solarEclipseObscuration = 0,
    timeOfDay,
    weather,
}: {
    moonlight?: number;
    paletteIndex?: number;
    solarEclipseObscuration?: number;
    timeOfDay: number;
    weather?: Parameters<typeof resolveSkyGradientColors>[0]['weather'];
}) {
    const baseColors = resolveEnvironmentSkyBackgroundColors({
        backgroundPaletteIndex: paletteIndex,
        timeOfDay,
    });
    const moonlitNightScales = resolveMoonlitNightScales({
        moonlight,
        timeOfDay,
    });
    const backgroundColor = resolveSkyBackgroundColor({
        background: baseColors.background,
        moonlitSkyScale: moonlitNightScales.skyScale,
        weather,
    }).multiplyScalar(getSolarEclipseVisualScales(solarEclipseObscuration).sky);

    return resolveSkyGradientColors({
        backgroundColor,
        backgroundPaletteIndex: paletteIndex,
        moonlight,
        solarEclipseObscuration,
        timeOfDay,
        weather,
    });
}

test('neutral daytime sky resolves to a visible gradient', () => {
    const gradient = resolveGradient({ timeOfDay: 0.5 });

    assert.ok(colorDistance(gradient.zenith, gradient.horizon) > 0.025);
    assert.ok(colorDistance(gradient.upper, gradient.horizon) > 0.015);
    assert.ok(colorDistance(gradient.lower, gradient.horizon) < 0.001);
    // Kept low at midday so the glow does not haze over the blue sky.
    assert.ok(gradient.sunGlowIntensity > 0.1);
});

test('Croatian partial eclipse darkens every daylight gradient band and the solar glow', () => {
    const clearDay = resolveGradient({ timeOfDay: 0.78 });
    const eclipse = resolveGradient({
        solarEclipseObscuration: 0.478,
        timeOfDay: 0.78,
    });

    for (const key of ['zenith', 'upper', 'horizon', 'lower'] as const) {
        assert.ok(
            colorLuminance(eclipse[key]) < colorLuminance(clearDay[key]) * 0.8,
            `Expected eclipse ${key} to be visibly darker than clear daylight`,
        );
    }
    assert.ok(eclipse.sunGlowIntensity < clearDay.sunGlowIntensity * 0.6);
    assert.equal(eclipse.moonGlowIntensity, clearDay.moonGlowIntensity);
});

test('neutral post-sunset sky darkens the lower background', () => {
    const gradient = resolveGradient({
        moonlight: 0.45,
        timeOfDay: 0.87,
    });

    assert.ok(
        colorLuminance(gradient.lower) <
            colorLuminance(gradient.horizon) - 0.02,
    );
    assert.ok(colorLuminance(gradient.lower) < 0.35);
});

test('neutral after-midnight sky is a light, saturated blue-violet', () => {
    const day = resolveGradient({ timeOfDay: 0.5 });
    for (const moonlight of [0, 0.45]) {
        const gradient = resolveGradient({
            moonlight,
            timeOfDay: 0.04,
        });

        for (const key of ['zenith', 'horizon', 'lower'] as const) {
            const color = gradient[key];
            const hsl = { h: 0, l: 0, s: 0 };
            color.getHSL(hsl);
            assert.ok(color.b > color.r && color.b > color.g, key);
            assert.ok(hsl.s > 0.3, `${key} is not saturated`);
        }
        // Night stays clearly darker than day, but not a dark navy.
        assert.ok(colorLuminance(gradient.horizon) > 0.12);
        assert.ok(
            colorLuminance(gradient.horizon) <
                colorLuminance(day.horizon) * 0.5,
        );
        assert.ok(
            colorLuminance(gradient.lower) < colorLuminance(gradient.horizon),
        );
    }
});

test('a snowy or overcast night sky stays blue-violet, not grey', () => {
    for (const weather of [
        { cloudy: 0.75, foggy: 0.2, snowy: 0.7 },
        { cloudy: 1 },
    ]) {
        const gradient = resolveGradient({ timeOfDay: 0.04, weather });
        for (const key of ['zenith', 'upper', 'horizon'] as const) {
            const color = gradient[key];
            const hsl = { h: 0, l: 0, s: 0 };
            color.getHSL(hsl);
            assert.ok(color.b > color.r && color.b > color.g, key);
            assert.ok(
                hsl.s > 0.25,
                `${key} under ${JSON.stringify(weather)} is greyish (${hsl.s})`,
            );
        }
    }
});

test('background palettes tint the same time of day differently', () => {
    const blueGradient = resolveGradient({
        paletteIndex: getGameBackgroundPaletteIndexByKey('light-blue'),
        timeOfDay: 0.52,
    });
    const roseGradient = resolveGradient({
        paletteIndex: getGameBackgroundPaletteIndexByKey('rose'),
        timeOfDay: 0.52,
    });

    assert.ok(colorDistance(blueGradient.horizon, roseGradient.horizon) > 0.1);
});

test('moonlight and cloud cover tune glow strength at night', () => {
    const moonlessGradient = resolveGradient({
        moonlight: 0,
        timeOfDay: 0.92,
    });
    const moonlitGradient = resolveGradient({
        moonlight: 0.9,
        timeOfDay: 0.92,
    });
    const overcastGradient = resolveGradient({
        moonlight: 0.9,
        timeOfDay: 0.92,
        weather: { cloudy: 0.9 },
    });

    assert.ok(
        moonlitGradient.moonGlowIntensity > moonlessGradient.moonGlowIntensity,
    );
    assert.ok(moonlitGradient.moonGlowIntensity < 0.16);
    assert.ok(
        overcastGradient.moonGlowIntensity < moonlitGradient.moonGlowIntensity,
    );
});

test('ground view collapses the sky to the gradient lower color without celestial glow', () => {
    const gradient = resolveGradient({
        moonlight: 0.9,
        timeOfDay: 0.5,
    });
    const groundView = resolveGroundViewSkyGradientColors(gradient);

    assert.ok(colorDistance(groundView.zenith, gradient.lower) < 0.001);
    assert.ok(colorDistance(groundView.upper, gradient.lower) < 0.001);
    assert.ok(colorDistance(groundView.horizon, gradient.lower) < 0.001);
    assert.ok(colorDistance(groundView.lower, gradient.lower) < 0.001);
    assert.equal(groundView.sunGlowIntensity, 0);
    assert.equal(groundView.moonGlowIntensity, 0);
    assert.notEqual(groundView.lower, gradient.lower);
});

test('gradient convergence detects both color and glow intensity changes', () => {
    const target = resolveGradient({ timeOfDay: 0.5 });
    const displayed = cloneSkyGradientColors(target);

    assert.equal(isSkyGradientWithinEpsilon(displayed, target, 0.001), true);

    displayed.horizon.r += 0.01;
    assert.equal(isSkyGradientWithinEpsilon(displayed, target, 0.001), false);

    displayed.horizon.copy(target.horizon);
    displayed.sunGlowIntensity += 0.01;
    assert.equal(isSkyGradientWithinEpsilon(displayed, target, 0.001), false);
});

test('gradient transition converges and can release its render lease', () => {
    const displayed = resolveGradient({
        moonlight: 0.8,
        timeOfDay: 0.92,
    });
    const target = resolveGradient({ timeOfDay: 0.5 });
    const transitionSeconds = 0.6;

    for (let frame = 0; frame < 600; frame += 1) {
        lerpSkyGradientColors(
            displayed,
            target,
            1 - Math.exp(-(1 / transitionSeconds) * (1 / 60)),
        );
        if (isSkyGradientWithinEpsilon(displayed, target, 0.001)) {
            break;
        }
    }

    assert.equal(isSkyGradientWithinEpsilon(displayed, target, 0.001), true);
});

test('the weather tone applies once: the background base stays untoned', () => {
    const background = resolveEnvironmentSkyBackgroundColors({
        backgroundPaletteIndex: defaultGameBackgroundPaletteIndex,
        timeOfDay: 0.5,
    }).background;
    const clear = resolveSkyBackgroundColor({
        background,
        moonlitSkyScale: 1,
    });
    const overcast = resolveSkyBackgroundColor({
        background,
        moonlitSkyScale: 1,
        weather: { cloudy: 1, rainy: 1 },
    });
    assert.ok(colorDistance(clear, overcast) < 1e-9);
    // The gradient still moves toward periwinkle under cloud.
    const clearSky = resolveGradient({ timeOfDay: 0.5 });
    const overcastSky = resolveGradient({
        timeOfDay: 0.5,
        weather: { cloudy: 0.9 },
    });
    assert.ok(colorDistance(clearSky.zenith, overcastSky.zenith) > 0.02);
});

test('a storm sky moves to the violet storm stops, following the damped storm', () => {
    for (const timeOfDay of [0.5, 0.92]) {
        const rain = resolveGradient({
            timeOfDay,
            weather: { cloudy: 1, rainy: 1 },
        });
        const storm = resolveGradient({
            timeOfDay,
            weather: { cloudy: 1, rainy: 1, thundery: 1, storm: 1 },
        });
        const halfway = resolveGradient({
            timeOfDay,
            weather: { cloudy: 1, rainy: 1, thundery: 1, storm: 0.5 },
        });
        const hsl = { h: 0, l: 0, s: 0 };
        storm.zenith.getHSL(hsl);
        // Violet: blue-purple hue, saturated, not grey.
        assert.ok(hsl.h > 0.65 && hsl.h < 0.76, `hue ${hsl.h}`);
        assert.ok(hsl.s > 0.3, `saturation ${hsl.s}`);
        const full = colorDistance(rain.zenith, storm.zenith);
        const half = colorDistance(rain.zenith, halfway.zenith);
        assert.ok(full > 0.03);
        assert.ok(half > full * 0.3 && half < full * 0.7);
    }
});
