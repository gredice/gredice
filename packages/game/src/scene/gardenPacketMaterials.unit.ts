import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BoxGeometry,
    DoubleSide,
    Mesh,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    Scene,
    ShaderLib,
    Texture,
    UniformsUtils,
    Vector2,
    Vector4,
} from 'three';
import { applyGroundPatchMaterial } from '../entities/helpers/groundPatchMaterial';
import {
    type CloudShadowMaterialLeaseMap,
    releaseCloudShadowAttenuationMaterials,
    syncCloudShadowAttenuationMaterials,
} from './cloudShadowAttenuation';
import {
    compileMeshBufferSources,
    packMeshGeometry,
    unpackMeshGeometry,
} from './compiler/meshBuffers';
import { readSharedGardenMaterialMetrics } from './gardenMaterials';
import {
    acquireGardenPacketMaterial,
    createGardenPacketMaterial,
    getGardenPacketMaterialSignature,
} from './gardenPacketMaterials';
import { isStaticOpaqueSceneCacheReplayEligible } from './staticOpaqueSceneCacheReplay';
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
function cloudUniforms(strength: number) {
    return {
        bounds: { value: new Vector4(0, 0, 1, 1) },
        hardness: { value: 0 },
        map: { value: null },
        projection: { value: new Vector2() },
        strength: { value: strength },
    };
}

describe('stock uniform garden packets', () => {
    it('shares only complete equal stock uniforms, maps, feature flags and registered hooks', () => {
        const source = new MeshStandardMaterial({
            color: '#aabbcc',
            roughness: 0.9,
            metalness: 0.1,
        });
        assert.equal(
            getGardenPacketMaterialSignature(source),
            getGardenPacketMaterialSignature(source.clone()),
        );
        for (const change of [
            (m: MeshStandardMaterial) => m.color.set('#112233'),
            (m: MeshStandardMaterial) => {
                m.roughness = 0.2;
            },
            (m: MeshStandardMaterial) => {
                m.metalness = 0.8;
            },
            (m: MeshStandardMaterial) => m.emissive.set('#112233'),
            (m: MeshStandardMaterial) => {
                m.emissiveIntensity = 2;
            },
            (m: MeshStandardMaterial) => {
                m.map = new Texture();
            },
            (m: MeshStandardMaterial) => {
                m.alphaMap = new Texture();
            },
            (m: MeshStandardMaterial) => {
                m.normalMap = new Texture();
            },
            (m: MeshStandardMaterial) => {
                m.side = DoubleSide;
            },
            (m: MeshStandardMaterial) => {
                m.alphaTest = 0.5;
            },
            (m: MeshStandardMaterial) => {
                m.vertexColors = true;
            },
            (m: MeshStandardMaterial) => {
                m.depthWrite = false;
            },
        ]) {
            const other = source.clone();
            change(other);
            assert.notEqual(
                getGardenPacketMaterialSignature(other),
                getGardenPacketMaterialSignature(source),
            );
        }
        assert.equal(
            getGardenPacketMaterialSignature(new MeshPhysicalMaterial()),
            undefined,
        );
        assert.equal(
            getGardenPacketMaterialSignature(
                new MeshStandardMaterial({ transparent: true }),
            ),
            undefined,
        );
        const unknown = source.clone();
        unknown.onBeforeCompile = () => {};
        assert.equal(getGardenPacketMaterialSignature(unknown), undefined);
    });
    it('preserves authored GLSL/cache keys and complete mapped cutout/PBR values without new flags', () => {
        const source = new MeshStandardMaterial({
            color: '#aabbcc',
            roughness: 0.3,
            metalness: 0.7,
            emissive: '#112233',
            emissiveIntensity: 2,
            map: new Texture(),
            alphaMap: new Texture(),
            alphaTest: 0.5,
            side: DoubleSide,
        });
        const clone = createGardenPacketMaterial(source);
        assert.deepEqual(shader(clone), shader(source));
        assert.equal(
            clone.customProgramCacheKey(),
            source.customProgramCacheKey(),
        );
        assert.equal(clone.onBeforeCompile, source.onBeforeCompile);
        assert.equal(
            getGardenPacketMaterialSignature(clone),
            getGardenPacketMaterialSignature(source),
        );
        assert.equal(clone.map, source.map);
        assert.equal(clone.alphaMap, source.alphaMap);
        assert.equal(clone.vertexColors, source.vertexColors);
        clone.dispose();
    });
    it('borrows immutable geometry while compilation owns copied arrays without palette attributes', () => {
        const source = new BoxGeometry();
        const positions = source.getAttribute('position').array.slice();
        const matrices = new Float64Array([
            1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 20, 3, 5, 1,
        ]);
        const result = unpackMeshGeometry(
            compileMeshBufferSources([
                { source: packMeshGeometry(source), matrices },
            ]),
        );
        assert.notEqual(
            result.getAttribute('position').array,
            source.getAttribute('position').array,
        );
        assert.deepEqual(source.getAttribute('position').array, positions);
        assert.equal(result.hasAttribute('aGardenPalette0'), false);
        assert.equal(result.hasAttribute('aGardenPalette1'), false);
        result.dispose();
        source.dispose();
    });
    it('deduplicates equal sources within one root and isolates independent root lifetimes and cloud uniforms', () => {
        const source = new MeshStandardMaterial({ map: new Texture() });
        const rootA = new Scene(),
            rootB = new Scene();
        const before = readSharedGardenMaterialMetrics();
        const a = acquireGardenPacketMaterial(source, rootA),
            a2 = acquireGardenPacketMaterial(source.clone(), rootA),
            b = acquireGardenPacketMaterial(source, rootB);
        assert.ok(a && a2 && b);
        assert.equal(a.material, a2.material);
        assert.notEqual(a.material, b.material);
        let sourceDisposals = 0,
            mapDisposals = 0,
            aDisposals = 0,
            bDisposals = 0;
        source.addEventListener('dispose', () => sourceDisposals++);
        source.map?.addEventListener('dispose', () => mapDisposals++);
        a.material.addEventListener('dispose', () => aDisposals++);
        b.material.addEventListener('dispose', () => bDisposals++);
        const leasesA: CloudShadowMaterialLeaseMap = new Map(),
            leasesB: CloudShadowMaterialLeaseMap = new Map();
        const uniformsA = cloudUniforms(0.2),
            uniformsB = cloudUniforms(0.8);
        assert.equal(
            syncCloudShadowAttenuationMaterials({
                enabled: true,
                leases: leasesA,
                root: rootA,
                uniforms: uniformsA,
            }),
            1,
        );
        assert.equal(
            syncCloudShadowAttenuationMaterials({
                enabled: true,
                leases: leasesB,
                root: rootB,
                uniforms: uniformsB,
            }),
            1,
        );
        assert.ok(
            a.material instanceof MeshStandardMaterial &&
                b.material instanceof MeshStandardMaterial,
        );
        assert.notDeepEqual(shader(a.material), shader(b.material));
        a.release();
        a.release();
        assert.equal(aDisposals, 0);
        a2.release();
        assert.equal(aDisposals, 1);
        assert.equal(bDisposals, 0);
        releaseCloudShadowAttenuationMaterials(leasesA);
        releaseCloudShadowAttenuationMaterials(leasesB);
        b.release();
        assert.equal(bDisposals, 1);
        assert.equal(sourceDisposals, 0);
        assert.equal(mapDisposals, 0);
        assert.deepEqual(readSharedGardenMaterialMetrics(), before);
    });
    it('acquires fresh live clones after StrictMode-style release/reacquisition or source mutation', () => {
        const source = new MeshStandardMaterial();
        const root = new Scene();
        const first = acquireGardenPacketMaterial(source, root);
        assert.ok(first);
        first.release();
        const second = acquireGardenPacketMaterial(source, root);
        assert.ok(second);
        assert.notEqual(second.material, first.material);
        source.roughness = 0.2;
        const changed = acquireGardenPacketMaterial(source, root);
        assert.ok(changed);
        assert.notEqual(changed.material, second.material);
        assert.ok(changed.material instanceof MeshStandardMaterial);
        assert.equal(changed.material.roughness, 0.2);
        second.release();
        changed.release();
    });
    it('preserves registered ground/weather hooks and actual mutable uniform owners', () => {
        const wetness = { value: 0.8 };
        const source = createIntegratedWeatherSurfaceMaterial(
            applyGroundPatchMaterial(new MeshStandardMaterial(), 'dirt', {}),
            {
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
                    enabled: false,
                    amountUniform: { value: 0 },
                    color: '#f7f7ff',
                    lift: 0.003,
                    maxThickness: 0.18,
                    noiseAmplitude: 0.35,
                    noiseInfluence: 0.15,
                    noiseScale: 2.5,
                    slopeExponent: 2.4,
                },
            },
        );
        const clone = createGardenPacketMaterial(source);
        assert.deepEqual(shader(clone), shader(source));
        wetness.value = 0.2;
        assert.deepEqual(shader(clone), shader(source));
        assert.equal(
            clone.customProgramCacheKey(),
            source.customProgramCacheKey(),
        );
        clone.dispose();
        source.dispose();
    });
    it('retains existing ground cache eligibility and moving weather/unknown callback rejection', () => {
        const geometry = new BoxGeometry();
        const ground = applyGroundPatchMaterial(
            new MeshStandardMaterial(),
            'dirt',
            {},
        );
        const clone = createGardenPacketMaterial(ground);
        const mesh = new Mesh(geometry, clone);
        assert.equal(isStaticOpaqueSceneCacheReplayEligible(mesh), true);
        mesh.onBeforeRender = () => {};
        assert.equal(isStaticOpaqueSceneCacheReplayEligible(mesh), false);
        clone.dispose();
        ground.dispose();
        geometry.dispose();
    });
});
