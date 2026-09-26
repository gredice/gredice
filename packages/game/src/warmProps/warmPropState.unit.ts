import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
    type BufferGeometry,
    type InstancedMesh,
    type Material,
    Raycaster,
} from 'three';
import { createWarmPropMeshes } from './warmPropMeshes';
import {
    resolveWarmPropPolicy,
    warmPropCaps,
    warmPropCrackleGain,
    warmPropFlicker,
    warmPropPhase,
} from './warmPropState';

const defaults = {
    tier: 'high',
    enabled: true,
    visible: true,
    reducedMotion: false,
    rain: 0,
    snow: 0,
} as const;

test('quality caps and weather/accessibility policy keep work bounded', () => {
    for (const tier of [
        'low',
        'auto-constrained',
        'medium',
        'high',
        'custom',
    ] as const) {
        const policy = resolveWarmPropPolicy({ ...defaults, tier });
        assert.equal(policy.capacity, warmPropCaps[tier]);
        assert(policy.smokePerSource * policy.capacity <= 18);
        const reduced = resolveWarmPropPolicy({
            ...defaults,
            tier,
            reducedMotion: true,
        });
        assert.equal(reduced.animate, false);
        assert.equal(reduced.smokePerSource, 0);
        assert.equal(reduced.capacity, policy.capacity);
    }
    for (const override of [
        { enabled: false },
        { visible: false },
        { rain: 0.66 },
        { rain: 3 },
        { snow: 0.1 },
        { snow: 1 },
    ]) {
        assert.deepEqual(resolveWarmPropPolicy({ ...defaults, ...override }), {
            capacity: 0,
            animate: false,
            smokePerSource: 0,
        });
    }
    assert.equal(resolveWarmPropPolicy({ ...defaults, rain: 0.3 }).capacity, 6);
});

test('frozen seeded flames repeat without accumulating simulation state', () => {
    const seed = warmPropPhase('garden:7:brazier:1');
    assert.equal(seed, warmPropPhase('garden:7:brazier:1'));
    assert.notEqual(seed, warmPropPhase('garden:7:brazier:2'));
    const first = warmPropFlicker(12, seed);
    for (let time = 0; time < 100; time += 0.1) {
        const value = warmPropFlicker(time, seed);
        assert(value >= 0.8 && value <= 1);
    }
    assert.equal(first, warmPropFlicker(12, seed));
    assert.notEqual(first, warmPropFlicker(12.5, seed));
});

test('distance fades crackle to silence with a bounded near gain', () => {
    assert.equal(warmPropCrackleGain(0), 0.14);
    assert(warmPropCrackleGain(4) < warmPropCrackleGain(2));
    assert.equal(warmPropCrackleGain(8), 0);
    assert.equal(warmPropCrackleGain(100), 0);
    assert.equal(warmPropCrackleGain(Number.NaN), 0);
});

test('pooled geometry has no picking or shadows and disposes owned resources', () => {
    const pool = createWarmPropMeshes(6);
    let disposed = 0;
    const meshes: InstancedMesh<BufferGeometry, Material>[] = [
        pool.fire,
        pool.smoke,
    ];
    for (const mesh of meshes) {
        assert.equal(mesh.instanceMatrix.count, 18);
        assert.equal(mesh.castShadow, false);
        mesh.addEventListener('dispose', () => disposed++);
        mesh.geometry.addEventListener('dispose', () => disposed++);
        mesh.material.addEventListener('dispose', () => disposed++);
        const hits: Parameters<typeof mesh.raycast>[1] = [];
        mesh.raycast(new Raycaster(), hits);
        assert.equal(hits.length, 0);
    }
    assert.equal(pool.fire.material.transparent, false);
    assert.equal(pool.smoke.material.depthWrite, false);
    assert.equal(pool.smoke.material.depthTest, true);
    pool.dispose();
    assert.equal(disposed, 6);
});

test('both hosts ship the same decodable bounded original loop with silent seams', () => {
    const garden = readFileSync(
        new URL(
            '../../../../apps/garden/public/assets/sounds/warm-prop-crackle-v1.wav',
            import.meta.url,
        ),
    );
    const www = readFileSync(
        new URL(
            '../../../../apps/www/public/assets/sounds/warm-prop-crackle-v1.wav',
            import.meta.url,
        ),
    );
    assert.deepEqual(garden, www);
    assert.equal(garden.toString('ascii', 0, 4), 'RIFF');
    assert.equal(garden.readUInt32LE(24), 22050);
    assert.equal(garden.readUInt16LE(22), 1);
    assert.equal(garden.readInt16LE(44), 0);
    assert.equal(garden.readInt16LE(garden.length - 2), 0);
    assert.equal((garden.length - 44) / 2 / 22050, 6);
});
