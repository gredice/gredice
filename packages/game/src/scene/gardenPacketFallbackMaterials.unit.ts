import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    DoubleSide,
    MeshStandardMaterial,
    Scene,
    ShaderLib,
    Texture,
    UniformsUtils,
    Vector2,
    Vector4,
} from 'three';
import { applyGroundPatchMaterial } from '../entities/helpers/groundPatchMaterial';
import { retainCloudShadowAttenuationMaterial } from './cloudShadowAttenuation';
import { readSharedGardenMaterialMetrics } from './gardenMaterials';
import { acquireGardenPacketFallbackMaterial as acquireInRoot } from './gardenPacketFallbackMaterials';
import { createIntegratedWeatherSurfaceMaterial } from './weatherSurfaceMaterial';

const root = new Scene();
function acquireGardenPacketFallbackMaterial(
    source: Parameters<typeof acquireInRoot>[0],
) {
    return acquireInRoot(source, root);
}

function shader(material: MeshStandardMaterial) {
    const program = {
        fragmentShader: ShaderLib.standard.fragmentShader,
        vertexShader: ShaderLib.standard.vertexShader,
        uniforms: UniformsUtils.clone(ShaderLib.standard.uniforms),
    };
    Reflect.apply(material.onBeforeCompile, material, [program, undefined]);
    return program;
}

describe('transient stock packet fallback materials', () => {
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
        const first = acquireGardenPacketFallbackMaterial(source);
        const second = acquireGardenPacketFallbackMaterial(source);
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
        const first = acquireGardenPacketFallbackMaterial(source);
        assert.ok(first);
        first.release();
        const remounted = acquireGardenPacketFallbackMaterial(source);
        assert.ok(remounted);
        assert.notEqual(remounted.material, first.material);
        source.color.set('#bc7332');
        const changed = acquireGardenPacketFallbackMaterial(source);
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
        const lease = acquireGardenPacketFallbackMaterial(source);
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
        const lease = acquireGardenPacketFallbackMaterial(source);
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

    it('isolates equal pending clones across roots while sharing within one root', () => {
        const source = new MeshStandardMaterial({ map: new Texture() });
        const firstRoot = new Scene(),
            secondRoot = new Scene();
        const first = acquireInRoot(source, firstRoot),
            sameRoot = acquireInRoot(source, firstRoot),
            otherRoot = acquireInRoot(source, secondRoot);
        assert.ok(first && sameRoot && otherRoot);
        assert.equal(first.material, sameRoot.material);
        assert.notEqual(first.material, otherRoot.material);
        let firstDisposed = 0,
            otherDisposed = 0;
        first.material.addEventListener('dispose', () => firstDisposed++);
        otherRoot.material.addEventListener('dispose', () => otherDisposed++);
        first.release();
        sameRoot.release();
        assert.equal(firstDisposed, 1);
        assert.equal(otherDisposed, 0);
        otherRoot.release();
        assert.equal(otherDisposed, 1);
    });

    it('keeps unsupported hooks and sorted transparency on their authored lifetime', () => {
        const unknown = new MeshStandardMaterial();
        unknown.onBeforeCompile = () => {};
        assert.equal(acquireGardenPacketFallbackMaterial(unknown), undefined);
        assert.equal(
            acquireGardenPacketFallbackMaterial(
                new MeshStandardMaterial({ transparent: true, opacity: 0.4 }),
            ),
            undefined,
        );
    });
});
