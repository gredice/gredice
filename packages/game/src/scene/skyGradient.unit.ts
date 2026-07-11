import assert from 'node:assert/strict';
import test from 'node:test';
import {
    defaultGameBackgroundPaletteIndex,
    getGameBackgroundPaletteIndexByKey,
} from './backgroundPalettes';
import { resolveMoonlitNightScales } from './moonlight';
import {
    resolveEnvironmentSkyBackgroundColors,
    resolveGroundViewSkyGradientColors,
    resolveSkyBackgroundColor,
    resolveSkyGradientColors,
} from './skyGradient';

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
    timeOfDay,
    weather,
}: {
    moonlight?: number;
    paletteIndex?: number;
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
    });

    return resolveSkyGradientColors({
        backgroundColor,
        backgroundPaletteIndex: paletteIndex,
        moonlight,
        timeOfDay,
        weather,
    });
}

test('neutral daytime sky resolves to a visible gradient', () => {
    const gradient = resolveGradient({ timeOfDay: 0.5 });

    assert.ok(colorDistance(gradient.zenith, gradient.horizon) > 0.025);
    assert.ok(colorDistance(gradient.upper, gradient.horizon) > 0.015);
    assert.ok(colorDistance(gradient.lower, gradient.horizon) < 0.001);
    assert.ok(gradient.sunGlowIntensity > 0.4);
});

test('neutral post-sunset sky darkens the lower background', () => {
    const gradient = resolveGradient({
        moonlight: 0.45,
        timeOfDay: 0.87,
    });

    assert.ok(
        colorLuminance(gradient.lower) <
            colorLuminance(gradient.horizon) - 0.025,
    );
    assert.ok(colorLuminance(gradient.lower) < 0.35);
});

test('neutral after-midnight sky keeps the lower background dark', () => {
    const gradient = resolveGradient({
        moonlight: 0.45,
        timeOfDay: 0.04,
    });

    assert.ok(colorLuminance(gradient.horizon) < 0.16);
    assert.ok(colorLuminance(gradient.lower) < 0.12);
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

test('ground view collapses the sky to the ground color without celestial glow', () => {
    const gradient = resolveGradient({
        moonlight: 0.9,
        timeOfDay: 0.5,
    });
    const groundColor = gradient.lower.clone().set('#9eb64a');
    const groundView = resolveGroundViewSkyGradientColors(
        gradient,
        groundColor,
    );

    assert.ok(colorDistance(groundView.zenith, groundColor) < 0.001);
    assert.ok(colorDistance(groundView.upper, groundColor) < 0.001);
    assert.ok(colorDistance(groundView.horizon, groundColor) < 0.001);
    assert.ok(colorDistance(groundView.lower, groundColor) < 0.001);
    assert.equal(groundView.sunGlowIntensity, 0);
    assert.equal(groundView.moonGlowIntensity, 0);
    assert.notEqual(groundView.lower, groundColor);
});
