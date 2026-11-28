import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoxGeometry, MeshStandardMaterial, ShaderLib, Vector2 } from 'three';
import { createSnowOverlayGeometry } from '../snow/createSnowOverlayGeometry';
import { snowOverlayVertexShader } from '../snow/snowShader';
import {
    autumnPropWindCullingPadding,
    bindAutumnPropWindMaterial,
    createAutumnPropWindUniforms,
    getAutumnPropWindGeometry,
    padAutumnPropWindCullingBounds,
    patchAutumnPropWindShader,
    resolveAutumnPropWindStrength,
} from './autumnPropWind';
import { resolveWindSway } from './weather/windClass';

test('wind remains bounded across quality, invalid weather and accessibility settings', () => {
    const defaults = {
        tier: 'high',
        speed: 3,
        snow: 0,
        enabled: true,
        reducedMotion: false,
    } as const;
    for (const tier of ['low', 'auto-constrained'] as const) {
        assert.equal(resolveAutumnPropWindStrength({ ...defaults, tier }), 0);
    }
    for (const tier of ['medium', 'high', 'custom'] as const) {
        for (const speed of [-1, 0, 0.5, 1, 3, 100, NaN, Infinity]) {
            const strength = resolveAutumnPropWindStrength({
                ...defaults,
                tier,
                speed,
            });
            assert.ok(strength >= 0 && strength <= 1);
        }
    }
    // One wind scale: in proportion to the class 0 to 4, like plant sway.
    assert.equal(resolveAutumnPropWindStrength({ ...defaults, speed: 100 }), 1);
    assert.equal(resolveAutumnPropWindStrength({ ...defaults, speed: 4 }), 1);
    assert.equal(resolveAutumnPropWindStrength(defaults), 0.75);
    assert.equal(
        resolveAutumnPropWindStrength({ ...defaults, speed: 2 }),
        resolveWindSway(2),
    );
    // Reduced motion keeps 30% of the sway (GAME_ART "Weather > Reduced motion").
    assert.ok(
        Math.abs(
            resolveAutumnPropWindStrength({
                ...defaults,
                reducedMotion: true,
            }) -
                0.75 * 0.3,
        ) < 1e-12,
    );
    assert.equal(
        resolveAutumnPropWindStrength({ ...defaults, enabled: false }),
        0,
    );
    assert.equal(resolveAutumnPropWindStrength({ ...defaults, snow: 0.25 }), 0);
    assert.equal(
        resolveAutumnPropWindStrength({ ...defaults, snow: 0.125 }),
        0.375,
    );
});

test('seeded uniforms share the scene clock and weather without altering cached materials', () => {
    const time = { value: 12 },
        strength = { value: 1 },
        direction = { value: new Vector2(1, 0) };
    const uniforms = createAutumnPropWindUniforms(
        time,
        strength,
        direction,
        'same',
    );
    assert.equal(uniforms.uAutumnWindTime, time);
    assert.equal(uniforms.uAutumnWindStrength, strength);
    assert.equal(uniforms.uAutumnWindDirection, direction);
    assert.equal(
        uniforms.uAutumnWindPhase.value,
        createAutumnPropWindUniforms(time, strength, direction, 'same')
            .uAutumnWindPhase.value,
    );
    assert.notEqual(
        uniforms.uAutumnWindPhase.value,
        createAutumnPropWindUniforms(time, strength, direction, 'different')
            .uAutumnWindPhase.value,
    );
    const cached = new MeshStandardMaterial();
    const owned = cached.clone();
    const key = cached.customProgramCacheKey();
    const restore = bindAutumnPropWindMaterial(owned, {
        role: 'grass',
        uniforms,
    });
    assert.equal(cached.customProgramCacheKey(), key);
    assert.equal(cached.userData.autumnPropWind, undefined);
    assert.notEqual(owned.customProgramCacheKey(), key);
    restore();
    assert.equal(owned.userData.autumnPropWind, undefined);
    assert.equal(owned.customProgramCacheKey(), key);
    cached.dispose();
    owned.dispose();
});

// The rain wet overlay shader left this list when the overlay was retired
// (the wet look is in the base-ground material, which is not an overlay).
test('base, shadow and snow shaders all move the same position exactly once', () => {
    for (const source of [
        ShaderLib.standard.vertexShader,
        ShaderLib.depth.vertexShader,
        ShaderLib.distance.vertexShader,
        snowOverlayVertexShader,
    ]) {
        for (const role of [
            'grass',
            'seed-heads',
            'garland',
            'wreath',
            'scarf',
        ] as const) {
            const shader = patchAutumnPropWindShader(source, role);
            assert.equal(
                shader.split('autumnWindOffset(position)').length - 1,
                1,
            );
            assert.ok(shader.includes('transpose(mat3(modelMatrix))'));
        }
    }
    assert.throws(
        () => patchAutumnPropWindShader('void main() {}', 'grass'),
        /Unsupported/,
    );
});

test('padded wind geometry is shared per model and keeps snow overlays cached', () => {
    const source = new BoxGeometry(1, 1, 1);
    source.computeBoundingSphere();
    const sourceRadius = source.boundingSphere?.radius ?? 0;
    const geometry = getAutumnPropWindGeometry(source);
    assert.equal(getAutumnPropWindGeometry(source), geometry);
    assert.notEqual(geometry, source);
    assert.equal(source.boundingSphere?.radius, sourceRadius);
    assert.equal(
        geometry.boundingSphere?.radius,
        sourceRadius + autumnPropWindCullingPadding,
    );
    assert.equal(
        createSnowOverlayGeometry(getAutumnPropWindGeometry(source)),
        createSnowOverlayGeometry(geometry),
    );
});

test('culling padding is applied once to derived overlay geometry', () => {
    const overlay = createSnowOverlayGeometry(new BoxGeometry(1, 1, 1));
    const radius = overlay.boundingSphere?.radius ?? 0;
    padAutumnPropWindCullingBounds(overlay);
    padAutumnPropWindCullingBounds(overlay);
    assert.equal(
        overlay.boundingSphere?.radius,
        radius + autumnPropWindCullingPadding,
    );
});
