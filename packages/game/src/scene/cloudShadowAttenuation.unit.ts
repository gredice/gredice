import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    MeshBasicMaterial,
    MeshStandardMaterial,
    Object3D,
    ShaderMaterial,
    Texture,
    Vector2,
    Vector4,
} from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import {
    type CloudShadowMaterialLeaseMap,
    cloudShadowFragmentShaderChunk,
    getCloudShadowAttenuationMaterialCandidateRevision,
    projectCloudShadowReceiverToGround,
    registerCloudShadowAttenuationMaterialCandidate,
    releaseCloudShadowAttenuationMaterials,
    resolveCloudShadowAttenuationActivation,
    resolveCloudShadowAttenuationConfig,
    resolveCloudShadowAttenuationUpdateTick,
    resolveCloudShadowMaskPlacement,
    retainCloudShadowAttenuationMaterial,
    supportsCloudShadowAttenuation,
    syncCloudShadowAttenuationMaterials,
} from './cloudShadowAttenuation';
import { gameQualityProfiles, resolveGameQualityProfile } from './gameQuality';

const uniforms = {
    bounds: { value: new Vector4(-10, -10, 0.05, 0.05) },
    hardness: { value: 0 },
    map: { value: new Texture() },
    projection: { value: new Vector2(0.5, -0.25) },
    strength: { value: 0.8 },
};

describe('cloud shadow attenuation quality', () => {
    it('scales mask resolution and cadence with quality', () => {
        const constrained = resolveGameQualityProfile('auto', undefined, {
            coarsePointer: true,
            coreCount: 4,
            dpr: 3,
            memoryGb: 4,
            narrowViewport: true,
        });

        assert.deepEqual(
            resolveCloudShadowAttenuationConfig({
                prefersReducedMotion: false,
                quality: constrained,
            }),
            {
                enabled: true,
                maskResolution: 64,
                updateMs: 240,
            },
        );
        assert.deepEqual(
            resolveCloudShadowAttenuationConfig({
                prefersReducedMotion: false,
                quality: gameQualityProfiles.medium,
            }),
            {
                enabled: true,
                maskResolution: 128,
                updateMs: 160,
            },
        );
        assert.deepEqual(
            resolveCloudShadowAttenuationConfig({
                prefersReducedMotion: false,
                quality: gameQualityProfiles.high,
            }),
            {
                enabled: true,
                maskResolution: 192,
                updateMs: 96,
            },
        );
    });

    it('slows and caps the mask for reduced motion', () => {
        assert.deepEqual(
            resolveCloudShadowAttenuationConfig({
                prefersReducedMotion: true,
                quality: gameQualityProfiles.high,
            }),
            {
                enabled: true,
                maskResolution: 128,
                updateMs: 320,
            },
        );
    });

    it('honors an adaptive minimum cadence without changing High fidelity', () => {
        assert.deepEqual(
            resolveCloudShadowAttenuationConfig({
                minimumUpdateMs: 160,
                prefersReducedMotion: false,
                quality: gameQualityProfiles.high,
            }),
            {
                enabled: true,
                maskResolution: 192,
                updateMs: 160,
            },
        );
        assert.deepEqual(
            resolveCloudShadowAttenuationConfig({
                minimumUpdateMs: 96,
                prefersReducedMotion: true,
                quality: gameQualityProfiles.high,
            }),
            {
                enabled: true,
                maskResolution: 128,
                updateMs: 320,
            },
        );
    });

    it('disables attenuation with user shadows', () => {
        assert.deepEqual(
            resolveCloudShadowAttenuationConfig({
                prefersReducedMotion: false,
                quality: gameQualityProfiles.low,
            }),
            {
                enabled: false,
                maskResolution: 0,
                updateMs: 0,
            },
        );
    });
});

describe('cloud shadow attenuation scheduling', () => {
    it('activates lazily and remains active after weather clears', () => {
        assert.equal(
            resolveCloudShadowAttenuationActivation({
                activated: false,
                strength: 0,
            }),
            false,
        );
        assert.equal(
            resolveCloudShadowAttenuationActivation({
                activated: false,
                strength: Number.NaN,
            }),
            false,
        );
        assert.equal(
            resolveCloudShadowAttenuationActivation({
                activated: false,
                strength: 0.2,
            }),
            true,
        );
        assert.equal(
            resolveCloudShadowAttenuationActivation({
                activated: true,
                strength: 0,
            }),
            true,
        );
    });

    it('updates only when due and schedules from now without catch-up', () => {
        assert.deepEqual(
            resolveCloudShadowAttenuationUpdateTick({
                enabled: true,
                force: false,
                nextUpdateAt: 1_000,
                now: 999,
                updateMs: 160,
            }),
            {
                nextUpdateAt: 1_000,
                shouldUpdate: false,
            },
        );
        assert.deepEqual(
            resolveCloudShadowAttenuationUpdateTick({
                enabled: true,
                force: false,
                nextUpdateAt: 1_000,
                now: 1_400,
                updateMs: 160,
            }),
            {
                nextUpdateAt: 1_560,
                shouldUpdate: true,
            },
        );
    });

    it('supports forced updates and remains idle while disabled', () => {
        assert.equal(
            resolveCloudShadowAttenuationUpdateTick({
                enabled: true,
                force: true,
                nextUpdateAt: 10_000,
                now: 500,
                updateMs: 240,
            }).shouldUpdate,
            true,
        );
        assert.deepEqual(
            resolveCloudShadowAttenuationUpdateTick({
                enabled: false,
                force: true,
                nextUpdateAt: 10_000,
                now: 500,
                updateMs: 240,
            }),
            {
                nextUpdateAt: 10_000,
                shouldUpdate: false,
            },
        );
    });
});

describe('cloud shadow world projection', () => {
    it('maps raised receivers onto the same sun ray as the ground footprint', () => {
        const projection = { x: 0.5, z: -0.25 };
        const ground = projectCloudShadowReceiverToGround(
            { x: 7, y: 0, z: 4.5 },
            projection,
        );
        const raised = projectCloudShadowReceiverToGround(
            { x: 8, y: 2, z: 4 },
            projection,
        );

        assert.deepEqual(raised, ground);
    });

    it('projects cloud altitude before mapping to mask pixels', () => {
        const placement = resolveCloudShadowMaskPlacement({
            bounds: { maxX: 10, maxZ: 10, minX: -10, minZ: -10 },
            projection: { x: 0.5, z: -0.25 },
            resolution: 100,
            sample: {
                altitude: 10,
                height: 4,
                opacity: 0.75,
                rotation: 0.2,
                width: 8,
                x: 12,
                z: 2,
            },
        });

        assert.deepEqual(
            {
                alpha: placement.alpha,
                height: placement.height,
                rotation: placement.rotation,
                width: placement.width,
                x: placement.x,
            },
            {
                alpha: 0.75,
                height: 20,
                rotation: -0.2,
                width: 40,
                x: 85,
            },
        );
        assert.ok(Math.abs(placement.y - 27.5) < Number.EPSILON * 32);
    });
});

describe('cloud shadow material integration', () => {
    it('skips the texture lookup when cloud strength is zero', () => {
        assert.match(
            cloudShadowFragmentShaderChunk,
            /if \( grediceCloudShadowStrength > 0\.001 \)/,
        );
        assert.ok(
            cloudShadowFragmentShaderChunk.indexOf(
                'grediceCloudShadowStrength > 0.001',
            ) <
                cloudShadowFragmentShaderChunk.indexOf(
                    'texture2D( grediceCloudShadowMap',
                ),
        );
    });

    it('composes and restores exact material shader hooks', () => {
        const material = new MeshStandardMaterial();
        let originalHookCallCount = 0;
        material.onBeforeCompile = (shader) => {
            originalHookCallCount += 1;
            shader.fragmentShader = shader.fragmentShader.replace(
                'void main()',
                '// existing material hook\nvoid main()',
            );
        };
        material.customProgramCacheKey = () => 'existing-cache-key';
        const originalOnBeforeCompile = material.onBeforeCompile;
        const originalCustomProgramCacheKey = material.customProgramCacheKey;
        const leaseA = retainCloudShadowAttenuationMaterial(material, uniforms);
        const patchedOnBeforeCompile = material.onBeforeCompile;
        const patchedCustomProgramCacheKey = material.customProgramCacheKey;
        const leaseB = retainCloudShadowAttenuationMaterial(material, uniforms);

        assert.notEqual(patchedOnBeforeCompile, originalOnBeforeCompile);
        assert.notEqual(
            patchedCustomProgramCacheKey,
            originalCustomProgramCacheKey,
        );
        assert.match(
            material.customProgramCacheKey(),
            /^existing-cache-key\|gredice-cloud-shadow-attenuation-v1$/,
        );
        const shader = {
            fragmentShader:
                '#include <common>\nvoid main() {\n#include <aomap_fragment>\n}',
            uniforms: {},
            vertexShader:
                '#include <common>\nvoid main() {\n#include <worldpos_vertex>\n}',
        };
        Reflect.apply(material.onBeforeCompile, material, [shader, undefined]);
        assert.equal(originalHookCallCount, 1);
        assert.match(shader.fragmentShader, /existing material hook/);
        assert.match(shader.fragmentShader, /grediceCloudShadowAttenuation/);

        leaseA.release();
        assert.equal(material.onBeforeCompile, patchedOnBeforeCompile);
        leaseB.release();
        assert.equal(material.onBeforeCompile, originalOnBeforeCompile);
        assert.equal(
            material.customProgramCacheKey,
            originalCustomProgramCacheKey,
        );
    });

    it('patches lit materials and excludes unlit materials', () => {
        const generatedPlantMaterial = new CustomShaderMaterial({
            baseMaterial: MeshStandardMaterial,
        });

        assert.equal(
            supportsCloudShadowAttenuation(new MeshStandardMaterial()),
            true,
        );
        assert.equal(
            supportsCloudShadowAttenuation(generatedPlantMaterial),
            true,
        );
        assert.equal(
            supportsCloudShadowAttenuation(new MeshBasicMaterial()),
            false,
        );
        assert.equal(
            supportsCloudShadowAttenuation(new ShaderMaterial()),
            false,
        );
        generatedPlantMaterial.dispose();
    });

    it('releases scene material hooks when attenuation is disabled', () => {
        const root = new Object3D();
        const material = new MeshStandardMaterial();
        const object = new Object3D();
        Reflect.set(object, 'material', material);
        root.add(object);
        const leases: CloudShadowMaterialLeaseMap = new Map();
        const originalOnBeforeCompile = material.onBeforeCompile;

        assert.equal(
            syncCloudShadowAttenuationMaterials({
                enabled: true,
                leases,
                root,
                uniforms,
            }),
            1,
        );
        assert.notEqual(material.onBeforeCompile, originalOnBeforeCompile);
        assert.equal(
            syncCloudShadowAttenuationMaterials({
                enabled: false,
                leases,
                root,
                uniforms,
            }),
            0,
        );
        assert.equal(material.onBeforeCompile, originalOnBeforeCompile);

        releaseCloudShadowAttenuationMaterials(leases);
    });

    it('patches explicitly registered dynamic materials without a scene scan gap', () => {
        const root = new Object3D();
        const material = new MeshStandardMaterial();
        const leases: CloudShadowMaterialLeaseMap = new Map();
        const originalOnBeforeCompile = material.onBeforeCompile;
        const revisionBefore =
            getCloudShadowAttenuationMaterialCandidateRevision();
        const unregister =
            registerCloudShadowAttenuationMaterialCandidate(material);

        assert.equal(
            getCloudShadowAttenuationMaterialCandidateRevision(),
            revisionBefore + 1,
        );
        assert.equal(
            syncCloudShadowAttenuationMaterials({
                enabled: true,
                leases,
                root,
                uniforms,
            }),
            1,
        );
        assert.notEqual(material.onBeforeCompile, originalOnBeforeCompile);

        unregister();
        unregister();
        assert.equal(
            getCloudShadowAttenuationMaterialCandidateRevision(),
            revisionBefore + 2,
        );
        assert.equal(
            syncCloudShadowAttenuationMaterials({
                enabled: true,
                leases,
                root,
                uniforms,
            }),
            0,
        );
        assert.equal(material.onBeforeCompile, originalOnBeforeCompile);
    });
});

describe('cached cloud program uniform bindings', () => {
    function rendererWith(value: unknown) {
        return {
            properties: {
                has: () => true,
                get: () => value,
                remove: () => {},
                update: () => undefined,
                dispose: () => {},
            },
        };
    }
    it('refreshes only five owned aliases without changing cached programs, lists, hooks, keys or unrelated uniforms', () => {
        const material = new MeshStandardMaterial();
        const originalHook = material.onBeforeCompile,
            originalKey = material.customProgramCacheKey;
        const pbr = { value: 0.7 };
        const table = { roughness: pbr };
        const programs = new Map([['cached-cloud', { usedTimes: 1 }]]),
            list = [{}];
        const properties = { uniforms: table, programs, uniformsList: list };
        const lease = retainCloudShadowAttenuationMaterial(
            material,
            uniforms,
            rendererWith(properties),
        );
        assert.equal(Reflect.get(table, 'grediceCloudShadowMap'), uniforms.map);
        assert.equal(
            Reflect.get(table, 'grediceCloudShadowBounds'),
            uniforms.bounds,
        );
        assert.equal(
            Reflect.get(table, 'grediceCloudShadowProjection'),
            uniforms.projection,
        );
        assert.equal(
            Reflect.get(table, 'grediceCloudShadowStrength'),
            uniforms.strength,
        );
        assert.equal(
            Reflect.get(table, 'grediceCloudShadowHardness'),
            uniforms.hardness,
        );
        assert.equal(table.roughness, pbr);
        assert.deepEqual(
            Object.keys(table).sort(),
            [
                'roughness',
                'grediceCloudShadowMap',
                'grediceCloudShadowBounds',
                'grediceCloudShadowProjection',
                'grediceCloudShadowStrength',
                'grediceCloudShadowHardness',
            ].sort(),
        );
        assert.equal(properties.programs, programs);
        assert.equal(properties.uniformsList, list);
        assert.deepEqual([...programs.values()], [{ usedTimes: 1 }]);
        lease.release();
        assert.equal(material.onBeforeCompile, originalHook);
        assert.equal(material.customProgramCacheKey, originalKey);
    });
    it('ignores missing or malformed renderer and uniform tables without inventing cache state', () => {
        for (const value of [
            undefined,
            null,
            3,
            [],
            { uniforms: undefined },
            { uniforms: null },
            { uniforms: 3 },
            { uniforms: [] },
        ]) {
            const material = new MeshStandardMaterial();
            const lease = retainCloudShadowAttenuationMaterial(
                material,
                uniforms,
                rendererWith(value),
            );
            lease.release();
            if (Array.isArray(value)) assert.equal(value.length, 0);
        }
    });
    it('keeps current provided uniform owners isolated between root-scoped stock candidates', () => {
        const rootA = new Object3D(),
            rootB = new Object3D();
        const a = new MeshStandardMaterial(),
            b = new MeshStandardMaterial();
        const aTable = {},
            bTable = {};
        const props = new Map([
            [a, { uniforms: aTable }],
            [b, { uniforms: bTable }],
        ]);
        const renderer = {
            properties: {
                has: (object: unknown) =>
                    props.has(
                        object instanceof MeshStandardMaterial ? object : a,
                    ),
                get: (object: unknown) =>
                    object instanceof MeshStandardMaterial
                        ? props.get(object)
                        : undefined,
                remove: () => {},
                update: () => undefined,
                dispose: () => {},
            },
        };
        const aUniforms = { ...uniforms, strength: { value: 0.2 } },
            bUniforms = { ...uniforms, strength: { value: 0.8 } };
        const leasesA: CloudShadowMaterialLeaseMap = new Map(),
            leasesB: CloudShadowMaterialLeaseMap = new Map();
        const removeA = registerCloudShadowAttenuationMaterialCandidate(
                a,
                rootA,
            ),
            removeB = registerCloudShadowAttenuationMaterialCandidate(b, rootB);
        syncCloudShadowAttenuationMaterials({
            enabled: true,
            leases: leasesA,
            root: rootA,
            uniforms: aUniforms,
            renderer,
        });
        syncCloudShadowAttenuationMaterials({
            enabled: true,
            leases: leasesB,
            root: rootB,
            uniforms: bUniforms,
            renderer,
        });
        assert.equal(
            Reflect.get(aTable, 'grediceCloudShadowStrength'),
            aUniforms.strength,
        );
        assert.equal(
            Reflect.get(bTable, 'grediceCloudShadowStrength'),
            bUniforms.strength,
        );
        assert.equal(leasesA.has(b.uuid), false);
        assert.equal(leasesB.has(a.uuid), false);
        releaseCloudShadowAttenuationMaterials(leasesA);
        assert.equal(
            Reflect.get(bTable, 'grediceCloudShadowStrength'),
            bUniforms.strength,
        );
        releaseCloudShadowAttenuationMaterials(leasesB);
        removeA();
        removeB();
    });
});
