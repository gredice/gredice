import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';
import { AnimationMixer, Box3, Mesh, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

async function model(name: string) {
    const bytes = readFileSync(
        new URL(
            `../../../../../apps/garden/public/assets/models/${name}.glb`,
            import.meta.url,
        ),
    );
    return new GLTFLoader().parseAsync(
        bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
        ),
        '',
    );
}
it('exports readable independent idle/walk/sniff clips within the bounded actor footprint', async () => {
    const gltf = await model('Hedgehog');
    assert.deepEqual(gltf.animations.map((a) => a.name).sort(), [
        'HedgehogIdle',
        'HedgehogSniff',
        'HedgehogWalk',
    ]);
    let triangles = 0,
        meshes = 0;
    gltf.scene.traverse((n) => {
        if (n instanceof Mesh) {
            meshes++;
            triangles +=
                (n.geometry.index?.count ??
                    n.geometry.getAttribute('position').count) / 3;
        }
    });
    assert.equal(meshes, 6);
    assert.equal(triangles, 444);
    for (const clip of gltf.animations) {
        const root = gltf.scene.clone(true);
        const mixer = new AnimationMixer(root);
        mixer.clipAction(clip).play();
        const snapshots = [];
        for (const t of [0, 0.25, 0.5, 0.75]) {
            mixer.setTime(t);
            root.updateMatrixWorld(true);
            const b = new Box3().setFromObject(root);
            assert.ok(b.min.y >= -0.012, `${clip.name}: ${b.min.y}`);
            assert.ok(
                b.getSize(new Vector3()).x <= 0.25 &&
                    b.getSize(new Vector3()).z <= 0.46 &&
                    b.max.y <= 0.27,
            );
            snapshots.push(
                root
                    .getObjectByName(
                        clip.name === 'HedgehogWalk'
                            ? 'Hedgehog_LegPivot0'
                            : clip.name === 'HedgehogSniff'
                              ? 'Hedgehog_HeadPivot'
                              : 'Hedgehog_BodyPivot',
                    )
                    ?.matrixWorld.elements.join(','),
            );
        }
        assert.ok(
            new Set(snapshots).size > 1,
            `${clip.name} must animate its intended part`,
        );
        mixer.stopAllAction();
        mixer.uncacheRoot(root);
    }
});
it('keeps the authored shelter corridor open for the hedgehog body', async () => {
    const gltf = await model('HedgehogShelter');
    gltf.scene.updateMatrixWorld(true);
    for (const x of [-0.12, 0, 0.12])
        for (const y of [0.05, 0.14, 0.25]) {
            const ray = new Raycaster(
                new Vector3(x, y, -0.8),
                new Vector3(0, 0, 1),
                0,
                0.95,
            );
            assert.equal(
                ray.intersectObject(gltf.scene, true).length,
                0,
                'The corridor from entrance to interior must be clear of roof and walls',
            );
        }
});
