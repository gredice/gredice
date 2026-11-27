import assert from 'node:assert/strict';
import test from 'node:test';
import { ShaderChunk } from 'three';
import { gameShadeVeil, gameSurfaceGradient } from './gameArtStyle';
import { installSkyRimShaderChunk } from './skyRimShaderChunk';
import {
    buildShadeVeilShaderChunk,
    buildSurfaceGradientShaderChunk,
    installSurfaceGradientShaderChunk,
} from './surfaceGradientShaderChunk';

test('installs the surface gradient once, after the light is gathered', () => {
    const original = ShaderChunk.lights_fragment_end;
    try {
        installSurfaceGradientShaderChunk();
        const installed = ShaderChunk.lights_fragment_end;
        installSurfaceGradientShaderChunk();

        assert.equal(ShaderChunk.lights_fragment_end, installed);
        assert.ok(installed.startsWith(original));
        assert.equal(installed.split('gredice:surface-gradient').length, 2);
        // Only lit standard materials take part, and a material can opt out.
        assert.match(installed, /defined\( STANDARD \)/);
        assert.match(installed, /!defined\( GREDICE_NO_SURFACE_GRADIENT \)/);
        // It scales the diffuse light only, so emissive glow is untouched.
        assert.match(installed, /reflectedLight\.directDiffuse \*=/);
        assert.match(installed, /reflectedLight\.indirectDiffuse \*=/);
        assert.doesNotMatch(installed, /totalEmissiveRadiance/);
    } finally {
        ShaderChunk.lights_fragment_end = original;
    }
});

test('composes with the sky rim in either install order', () => {
    const original = ShaderChunk.lights_fragment_end;
    try {
        installSkyRimShaderChunk();
        installSurfaceGradientShaderChunk();
        const installed = ShaderChunk.lights_fragment_end;
        assert.equal(installed.split('gredice:sky-rim').length, 2);
        assert.equal(installed.split('gredice:surface-gradient').length, 2);
    } finally {
        ShaderChunk.lights_fragment_end = original;
    }
});

test('the gradient is subtle, lighter at the top and spares the terrain', () => {
    const {
        baseTint,
        fadeIn,
        floorHeight,
        span,
        topTint,
        upFacingEnd,
        upFacingStart,
    } = gameSurfaceGradient;
    const luminance = ([red, green, blue]: readonly number[]) =>
        red * 0.2126 + green * 0.7152 + blue * 0.0722;

    assert.ok(luminance(topTint) > luminance(baseTint));
    // Cooler at the base, warmer at the top.
    assert.ok(baseTint[2] >= baseTint[0]);
    assert.ok(topTint[0] >= topTint[2]);
    for (const channel of [...baseTint, ...topTint]) {
        assert.ok(Math.abs(channel - 1) <= 0.12, `${channel} is not subtle`);
    }
    assert.ok(upFacingStart > upFacingEnd);
    assert.ok(upFacingStart < 1);
    // Terrain blocks are 0.4 tall. The gradient fades in around their top,
    // so terrain sides below the floor keep their light.
    assert.equal(floorHeight, 0.4);
    assert.ok(fadeIn[0] < floorHeight && fadeIn[1] > floorHeight);
    assert.ok(fadeIn[1] - floorHeight <= 0.1);
    assert.ok(span >= 1);

    const chunk = buildSurfaceGradientShaderChunk();
    assert.match(chunk, /smoothstep\(\s*0\.3800,\s*0\.4600,/);
    assert.match(chunk, /smoothstep\(\s*0\.4000,\s*1\.8000,/);
    // The world position comes from the view position: no extra varying.
    assert.match(chunk, /transpose\( mat3\( viewMatrix \) \)/);
    assert.match(chunk, /viewMatrix\[ 1 \]\.xyz/);
    assert.doesNotMatch(chunk, /varying/);
});

test('the shade veil cools shaded faces by day and night, terrain included', () => {
    const chunk = buildShadeVeilShaderChunk();
    assert.ok(buildSurfaceGradientShaderChunk().includes(chunk));
    // Night is read from the hemisphere ground colour and the day veil from
    // the key against the sky fill, so it follows the light rig.
    assert.match(chunk, /hemisphereLights\[ 0 \]\.groundColor/);
    assert.match(chunk, /hemisphereLights\[ 0 \]\.skyColor/);
    assert.match(chunk, /directionalLights\[ 0 \]\.color/);
    assert.match(chunk, /NUM_HEMI_LIGHTS > 0/);
    // Terrain opts out of the gradient, not of the veil.
    assert.doesNotMatch(chunk, /GREDICE_NO_SURFACE_GRADIENT/);
    assert.match(chunk, /reflectedLight\.indirectDiffuse \*=/);
    assert.match(chunk, /reflectedLight\.indirectDiffuse \+=/);
    assert.doesNotMatch(chunk, /totalEmissiveRadiance/);
    for (const strength of [
        gameShadeVeil.day.strength,
        gameShadeVeil.night.strength,
    ]) {
        assert.match(
            chunk,
            new RegExp(strength.toFixed(4).replace('.', '\\.')),
        );
    }
});
