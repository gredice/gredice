import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BufferGeometry,
    Float32BufferAttribute,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    ShaderMaterial,
    Vector2,
    Vector4,
} from 'three';
import { applyGroundPatchMaterial } from '../entities/helpers/groundPatchMaterial';
import { retainCloudShadowAttenuationMaterial } from './cloudShadowAttenuation';
import {
    createStaticOpaqueSceneCacheReplay,
    isStaticOpaqueSceneCacheReplayEligible,
} from './staticOpaqueSceneCacheReplay';

function createTriangleGeometry() {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    return geometry;
}

describe('static opaque scene cache replay', () => {
    it('replays the cached color and depth with one fullscreen triangle', () => {
        const material = new ShaderMaterial();
        const replay = createStaticOpaqueSceneCacheReplay({ material });
        const mesh = replay.scene.children[0];
        const position = Reflect.get(mesh, 'geometry')?.getAttribute(
            'position',
        );

        assert.equal(replay.estimatedBytes, 36);
        assert.equal(replay.submissionCount, 1);
        assert.equal(replay.triangleCount, 1);
        assert.equal(mesh?.frustumCulled, false);
        assert.equal(mesh?.renderOrder, -999);
        assert.deepEqual(
            Array.from(position.array),
            [-1, 3, 0, -1, -1, 0, 3, -1, 0],
        );

        replay.dispose();
        assert.equal(replay.scene.children.length, 0);
        material.dispose();
    });

    it('accepts stable built-in opaque meshes', () => {
        const geometry = createTriangleGeometry();
        const material = new MeshBasicMaterial();
        const mesh = new Mesh(geometry, material);

        assert.equal(isStaticOpaqueSceneCacheReplayEligible(mesh), true);

        geometry.dispose();
        material.dispose();
    });

    it('accepts the known static ground-patch shader without accepting arbitrary hooks', () => {
        const geometry = createTriangleGeometry();
        const material = applyGroundPatchMaterial(
            new MeshStandardMaterial(),
            'grass',
            {},
        );
        const mesh = new Mesh(geometry, material);

        assert.equal(isStaticOpaqueSceneCacheReplayEligible(mesh), true);
        const cloudLease = retainCloudShadowAttenuationMaterial(material, {
            bounds: { value: new Vector4(-10, -10, 0.05, 0.05) },
            hardness: { value: 0 },
            map: { value: null },
            projection: { value: new Vector2(0.5, -0.25) },
            strength: { value: 0.8 },
        });
        assert.equal(isStaticOpaqueSceneCacheReplayEligible(mesh), true);
        cloudLease.release();

        const otherGroundPatchMaterial = applyGroundPatchMaterial(
            new MeshStandardMaterial(),
            'sand',
            {},
        );
        material.customProgramCacheKey =
            otherGroundPatchMaterial.customProgramCacheKey;
        assert.equal(isStaticOpaqueSceneCacheReplayEligible(mesh), false);

        material.onBeforeCompile = () => {};
        assert.equal(isStaticOpaqueSceneCacheReplayEligible(mesh), false);

        geometry.dispose();
        material.dispose();
        otherGroundPatchMaterial.dispose();
    });

    it('fails closed for silhouettes that need uncached shader behavior', () => {
        const geometry = createTriangleGeometry();
        const material = new MeshBasicMaterial({ alphaTest: 0.1 });
        const mesh = new Mesh(geometry, material);

        assert.equal(isStaticOpaqueSceneCacheReplayEligible(mesh), false);

        geometry.dispose();
        material.dispose();
    });
});
