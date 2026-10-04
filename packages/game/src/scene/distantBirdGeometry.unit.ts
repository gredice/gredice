import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createDistantBirdGeometry } from './distantBirdGeometry';

test('real BirdSmall gliding pose extends attached wings with bounded existing geometry', async () => {
    const bytes = readFileSync(
        new URL(
            '../../../../apps/garden/public/assets/models/BirdSmall.glb',
            import.meta.url,
        ),
    );
    const gltf = await new GLTFLoader().parseAsync(
        bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
        ),
        '',
    );
    const cachedSource = JSON.stringify(gltf.scene.toJSON());
    const baked = createDistantBirdGeometry(gltf.scene);
    assert.equal(JSON.stringify(gltf.scene.toJSON()), cachedSource);
    baked.geometry.computeBoundingBox();
    const size = baked.geometry.boundingBox?.getSize(new Vector3());
    assert.ok(size);
    // Inward Z-folding gives width 0.53; reversing Z detaches wings and exceeds 1.3.
    assert.ok(Math.abs(size.x - 0.99916246) < 0.0001);
    assert.ok(Math.abs(size.z - 1.21000001) < 0.0001);
    assert.equal(baked.geometry.getAttribute('position').count / 3, 712);
    assert.equal(
        gltf.scene.getObjectByName('BirdSmall_WingPivot_L')?.rotation.y,
        0,
    );
    assert.equal(
        gltf.scene.getObjectByName('BirdSmall_WingPivot_R')?.rotation.y,
        0,
    );
    baked.geometry.dispose();
    baked.material.dispose();
});

test('baked flock geometry/material own their lifetime and preserve cached bird actor resources', () => {
    const source = new Group();
    const wing = new Group();
    wing.name = 'BirdSmall_WingPivot_L';
    const geometry = new BoxGeometry(0.2, 0.8, 0.1);
    const material = new MeshStandardMaterial({
        color: '#785436',
        roughness: 0.82,
    });
    let cachedDisposals = 0;
    geometry.addEventListener('dispose', () => cachedDisposals++);
    material.addEventListener('dispose', () => cachedDisposals++);
    wing.add(new Mesh(geometry, material));
    source.add(wing);
    const positions = Array.from(geometry.getAttribute('position').array);
    const baked = createDistantBirdGeometry(source);
    assert.notEqual(baked.geometry, geometry);
    assert.notEqual(baked.material, material);
    assert.equal(baked.material.roughness, material.roughness);
    assert.equal(baked.material.depthTest, true);
    assert.equal(baked.material.forceSinglePass, true);
    assert.equal(baked.material.depthWrite, false);
    assert.equal(wing.rotation.z, 0);
    assert.deepEqual(
        Array.from(geometry.getAttribute('position').array),
        positions,
    );
    assert.equal(material.vertexColors, false);
    baked.geometry.dispose();
    baked.material.dispose();
    assert.equal(cachedDisposals, 0);
    geometry.dispose();
    material.dispose();
});
