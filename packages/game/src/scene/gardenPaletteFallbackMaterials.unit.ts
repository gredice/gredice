import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    DoubleSide,
    MeshStandardMaterial,
    ShaderLib,
    Texture,
    UniformsUtils,
    Vector2,
    Vector4,
} from 'three';
import { applyGroundPatchMaterial } from '../entities/helpers/groundPatchMaterial';
import { retainCloudShadowAttenuationMaterial } from './cloudShadowAttenuation';
import { readSharedGardenMaterialMetrics } from './gardenMaterials';
import { acquireGardenPaletteFallbackMaterial } from './gardenPaletteFallbackMaterials';
import { createIntegratedWeatherSurfaceMaterial } from './weatherSurfaceMaterial';

function shader(material: MeshStandardMaterial) {
    const program = {
        fragmentShader: ShaderLib.standard.fragmentShader,
        vertexShader: ShaderLib.standard.vertexShader,
        uniforms: UniformsUtils.clone(ShaderLib.standard.uniforms),
    };
    Reflect.apply(material.onBeforeCompile, material, [program, undefined]);
    return program;
}

describe('transient palette packet fallback materials', () => {
    it('retains exact authored PBR, maps and cutout without owning the source or textures', () => {
        const source = new MeshStandardMaterial({
            color: '#3478b9',
            roughness: 0.25,
            metalness: 0.65,
            emissive: '#102030',
            emissiveIntensity: 3,
            side: DoubleSide,
            alphaTest: 0.5,
            map: new Texture(),
            alphaMap: new Texture(),
        });
        let sourceDisposals = 0;
        let mapDisposals = 0;
        source.addEventListener('dispose', () => sourceDisposals++);
        source.map?.addEventListener('dispose', () => mapDisposals++);
        source.alphaMap?.addEventListener('dispose', () => mapDisposals++);
        const before = readSharedGardenMaterialMetrics();
        const first = acquireGardenPaletteFallbackMaterial(source);
        const second = acquireGardenPaletteFallbackMaterial(source);
        assert.ok(first && second);
        assert.ok(first.material instanceof MeshStandardMaterial);
        assert.notEqual(first.material, source);
        assert.equal(first.material, second.material);
        assert.deepEqual(first.material.color, source.color);
        assert.equal(first.material.roughness, source.roughness);
        assert.equal(first.material.metalness, source.metalness);
        assert.deepEqual(first.material.emissive, source.emissive);
        assert.equal(
            first.material.emissiveIntensity,
            source.emissiveIntensity,
        );
        assert.equal(first.material.side, source.side);
        assert.equal(first.material.alphaTest, source.alphaTest);
        assert.equal(first.material.map, source.map);
        assert.equal(first.material.alphaMap, source.alphaMap);
        assert.deepEqual(shader(first.material), shader(source));
        let cloneDisposals = 0;
        first.material.addEventListener('dispose', () => cloneDisposals++);
        first.release();
        first.release();
        assert.equal(cloneDisposals, 0);
        second.release();
        second.release();
        assert.equal(cloneDisposals, 1);
        assert.equal(sourceDisposals, 0);
        assert.equal(mapDisposals, 0);
        assert.deepEqual(readSharedGardenMaterialMetrics(), before);
    });

    it('uses a fresh clone after final release and observes supported source mutation', () => {
        const source = new MeshStandardMaterial({ color: '#3273bc' });
        const first = acquireGardenPaletteFallbackMaterial(source);
        assert.ok(first);
        first.release();
        const remounted = acquireGardenPaletteFallbackMaterial(source);
        assert.ok(remounted);
        assert.notEqual(remounted.material, first.material);
        source.color.set('#bc7332');
        const changed = acquireGardenPaletteFallbackMaterial(source);
        assert.ok(changed);
        assert.ok(changed.material instanceof MeshStandardMaterial);
        assert.notEqual(changed.material, remounted.material);
        assert.deepEqual(changed.material.color, source.color);
        changed.release();
        remounted.release();
    });

    it('preserves ground and live weather callbacks with the same uniform owners', () => {
        const wetness = { value: 0.8 };
        const snowAmount = { value: 0.6 };
        const ground = applyGroundPatchMaterial(
            new MeshStandardMaterial({ color: '#907754' }),
            'dirt',
            {},
        );
        const source = createIntegratedWeatherSurfaceMaterial(ground, {
            frostIntensityUniform: { value: 0.4 },
            rain: {
                enabled: true,
                bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
                darkness: 1,
                glossiness: 0.7,
                puddleStrengthUniform: { value: 0.3 },
                topSurfaceBias: 1.8,
                wetnessUniform: wetness,
            },
            snow: {
                enabled: true,
                amountUniform: snowAmount,
                color: '#f7f7ff',
                lift: 0.003,
                maxThickness: 0.18,
                noiseAmplitude: 0.35,
                noiseInfluence: 0.15,
                noiseScale: 2.5,
                slopeExponent: 2.4,
            },
        });
        const lease = acquireGardenPaletteFallbackMaterial(source);
        assert.ok(lease);
        assert.ok(lease.material instanceof MeshStandardMaterial);
        assert.equal(
            lease.material.customProgramCacheKey(),
            source.customProgramCacheKey(),
        );
        assert.deepEqual(shader(lease.material), shader(source));
        wetness.value = 0.1;
        snowAmount.value = 0.2;
        assert.deepEqual(shader(lease.material), shader(source));
        lease.release();
    });

    it('unwraps source cloud attenuation and lets the scene apply it exactly once to the clone', () => {
        const source = applyGroundPatchMaterial(
            new MeshStandardMaterial(),
            'grass',
            {},
        );
        const uniforms = {
            bounds: { value: new Vector4(0, 0, 1, 1) },
            hardness: { value: 0 },
            map: { value: null },
            projection: { value: new Vector2() },
            strength: { value: 0.5 },
        };
        const cloud = retainCloudShadowAttenuationMaterial(source, uniforms);
        const lease = acquireGardenPaletteFallbackMaterial(source);
        assert.ok(lease);
        assert.ok(lease.material instanceof MeshStandardMaterial);
        assert.notDeepEqual(shader(lease.material), shader(source));
        const cloneCloud = retainCloudShadowAttenuationMaterial(
            lease.material,
            uniforms,
        );
        assert.deepEqual(shader(lease.material), shader(source));
        cloneCloud.release();
        lease.release();
        cloud.release();
    });

    it('keeps unsupported hooks and sorted transparency on their authored lifetime', () => {
        const unknown = new MeshStandardMaterial();
        unknown.onBeforeCompile = () => {};
        assert.equal(acquireGardenPaletteFallbackMaterial(unknown), undefined);
        assert.equal(
            acquireGardenPaletteFallbackMaterial(
                new MeshStandardMaterial({ transparent: true, opacity: 0.4 }),
            ),
            undefined,
        );
    });
});
