import assert from 'node:assert/strict';
import test from 'node:test';
import {
    defaultGameBackgroundPaletteIndex,
    getGameBackgroundPaletteIndexByKey,
} from './backgroundPalettes';
import { resolveMoonlitNightScales } from './moonlight';
import {
    resolveEnvironmentSkyBackgroundColors,
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
    assert.ok(
        overcastGradient.moonGlowIntensity < moonlitGradient.moonGlowIntensity,
    );
});
