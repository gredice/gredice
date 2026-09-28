import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MeshStandardMaterial, ShaderLib, Vector2 } from 'three';
import { snowOverlayVertexShader } from '../snow/snowShader';
import {
    bindAutumnPropWindMaterial,
    createAutumnPropWindUniforms,
    patchAutumnPropWindShader,
    resolveAutumnPropWindStrength,
} from './autumnPropWind';

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
    assert.equal(resolveAutumnPropWindStrength({ ...defaults, speed: 100 }), 1);
    assert.equal(
        resolveAutumnPropWindStrength({ ...defaults, reducedMotion: true }),
        0,
    );
    assert.equal(
        resolveAutumnPropWindStrength({ ...defaults, enabled: false }),
        0,
    );
    assert.equal(resolveAutumnPropWindStrength({ ...defaults, snow: 0.25 }), 0);
    assert.equal(
        resolveAutumnPropWindStrength({ ...defaults, snow: 0.125 }),
        0.5,
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

test('base, shadow, rain and snow shaders all move the same position exactly once', () => {
    const rainSource = readFileSync(
        new URL('../rain/RainWetOverlay.tsx', import.meta.url),
        'utf8',
    );
    const rain = rainSource.match(
        /const rainOverlayVertexShader = `([\s\S]*?)`;/,
    )?.[1];
    assert.ok(rain);
    for (const source of [
        ShaderLib.standard.vertexShader,
        ShaderLib.depth.vertexShader,
        ShaderLib.distance.vertexShader,
        rain,
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
