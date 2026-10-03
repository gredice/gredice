import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BufferAttribute,
    BufferGeometry,
    Group,
    Mesh,
    MeshStandardMaterial,
    Scene,
    Texture,
} from 'three';
import {
    acquireGardenPacketMaterialRoot,
    readGardenPacketMaterialLifetime,
} from '../gardenPacketMaterialLifetime';
import { acquireGardenPacketMaterial } from '../gardenPacketMaterials';
import {
    collectGameGLTFResources,
    disposeGameGLTFResources,
    getGameResourceCache,
    trackGameGLTF,
} from './gameGLTFResources';
import { isResidentGardenMaterial } from './gardenMaterialOrigins';

function createGLTF() {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array(9), 3),
    );
    geometry.setIndex(new BufferAttribute(new Uint16Array(3), 1));
    const texture = new Texture({ width: 4, height: 2 });
    texture.generateMipmaps = false;
    const material = new MeshStandardMaterial({ map: texture });
    const scene = new Group();
    // Shared geometry and material must be counted and disposed once.
    scene.add(new Mesh(geometry, material), new Mesh(geometry, [material]));
    return { geometry, material, scene, texture };
}

describe('game GLTF resources', () => {
    it('measures unique geometry and texture bytes', () => {
        const { scene } = createGLTF();
        const resources = collectGameGLTFResources({ scene });

        assert.equal(resources.geometries.size, 1);
        assert.equal(resources.materials.size, 1);
        assert.equal(resources.textures.size, 1);
        // 9 floats + 3 uint16 indices + 4x2 RGBA8 texels.
        assert.equal(resources.bytes, 36 + 6 + 32);
    });

    it('disposes every GPU-backed resource once', () => {
        const { geometry, material, scene, texture } = createGLTF();
        const disposed: string[] = [];
        geometry.addEventListener('dispose', () => disposed.push('geometry'));
        material.addEventListener('dispose', () => disposed.push('material'));
        texture.addEventListener('dispose', () => disposed.push('texture'));

        disposeGameGLTFResources(collectGameGLTFResources({ scene }));

        assert.deepEqual(disposed.sort(), ['geometry', 'material', 'texture']);
    });

    it('ignores values without a scene graph', () => {
        assert.equal(collectGameGLTFResources(null).bytes, 0);
        assert.equal(collectGameGLTFResources({ scene: 1 }).bytes, 0);
    });
    it('ties a warm owned stock clone to actual GLTF eviction without taking cache references or disposing borrowed inputs', () => {
        const source = createGLTF();
        const url = '/unit-resident-stock-origin.glb';
        trackGameGLTF(url, { scene: source.scene });
        assert.equal(isResidentGardenMaterial(source.material), true);
        const root = new Scene();
        const close = acquireGardenPacketMaterialRoot(root);
        const lease = acquireGardenPacketMaterial(source.material, root);
        assert.ok(lease);
        const disposals: string[] = [];
        source.geometry.addEventListener('dispose', () =>
            disposals.push('geometry'),
        );
        source.texture.addEventListener('dispose', () =>
            disposals.push('texture'),
        );
        source.material.addEventListener('dispose', () =>
            disposals.push('source'),
        );
        lease.material.addEventListener('dispose', () =>
            disposals.push('owned'),
        );
        lease.release();
        assert.deepEqual(disposals, []);
        assert.equal(readGardenPacketMaterialLifetime(root).idleOrigins, 1);
        assert.equal(getGameResourceCache().getSnapshot().referenced, 0);
        getGameResourceCache().evictIdle();
        assert.deepEqual(disposals.sort(), [
            'geometry',
            'owned',
            'source',
            'texture',
        ]);
        assert.equal(isResidentGardenMaterial(source.material), false);
        assert.equal(readGardenPacketMaterialLifetime(root).idleOrigins, 0);
        // An accidentally retained decoded object must never revive disposed provenance.
        trackGameGLTF(url, { scene: source.scene });
        assert.equal(isResidentGardenMaterial(source.material), false);
        getGameResourceCache().evictIdle();
        close();
    });
    it('invalidates the old exact GLTF registration on replacement without retaining signature history', () => {
        const first = createGLTF(),
            replacement = createGLTF();
        const url = '/unit-replaced-stock-origin.glb';
        trackGameGLTF(url, { scene: first.scene });
        const root = new Scene(),
            close = acquireGardenPacketMaterialRoot(root);
        const lease = acquireGardenPacketMaterial(first.material, root);
        assert.ok(lease);
        let ownedDisposals = 0;
        lease.material.addEventListener('dispose', () => ownedDisposals++);
        lease.release();
        trackGameGLTF(url, { scene: replacement.scene });
        assert.equal(ownedDisposals, 1);
        assert.equal(isResidentGardenMaterial(first.material), false);
        assert.equal(isResidentGardenMaterial(replacement.material), true);
        assert.equal(readGardenPacketMaterialLifetime(root).idleOrigins, 0);
        getGameResourceCache().evictIdle();
        close();
        disposeGameGLTFResources(
            collectGameGLTFResources({ scene: first.scene }),
        );
    });
});
