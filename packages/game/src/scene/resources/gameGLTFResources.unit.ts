import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BufferAttribute,
    BufferGeometry,
    Group,
    Mesh,
    MeshStandardMaterial,
    Texture,
} from 'three';
import {
    collectGameGLTFResources,
    disposeGameGLTFResources,
} from './gameGLTFResources';

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
});
