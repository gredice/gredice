import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
    BoxGeometry,
    Float32BufferAttribute,
    Group,
    Mesh,
    MeshStandardMaterial,
    Raycaster,
    Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { configureFaunaActorCulling } from './faunaActorCulling';
import { acquireRigidFaunaBatches } from './rigidFaunaBatches';

function rig() {
    const root = new Group();
    const pivot = new Group();
    pivot.name = 'BodyPivot';
    const geometry = new BoxGeometry(0.6, 0.5, 0.4);
    geometry.clearGroups();
    const left = new Mesh(
        geometry,
        new MeshStandardMaterial({ color: '#4a362a' }),
    );
    const right = new Mesh(geometry, left.material.clone());
    left.name = 'LeftPart';
    right.name = 'RightPart';
    left.position.x = -0.5;
    right.position.x = 0.5;
    left.rotation.y = 0.2;
    right.scale.set(1.1, 0.8, 0.9);
    pivot.add(left, right);
    root.add(pivot);
    return { root, pivot, left, right, geometry };
}

function triangleVertices(mesh: Mesh) {
    mesh.updateWorldMatrix(true, false);
    const position = mesh.geometry.getAttribute('position');
    const index = mesh.geometry.index;
    return Array.from({ length: index?.count ?? position.count }, (_, i) =>
        new Vector3()
            .fromBufferAttribute(position, index?.getX(i) ?? i)
            .applyMatrix4(mesh.matrixWorld),
    );
}

test('rigid batches preserve world triangles through articulated parent motion and restore logical nodes', () => {
    const { root, pivot, left, right, geometry } = rig();
    const originalPositions = geometry.getAttribute('position').array.slice();
    const culling = configureFaunaActorCulling(root);
    culling.consumeRendered();
    const lease = acquireRigidFaunaBatches(
        root,
        root,
        ['BodyPivot'],
        culling.markRendered,
    );
    assert.equal(lease.batches.length, 1);
    const batch = lease.batches[0];
    assert.ok(batch);
    assert.equal(root.getObjectByName('LeftPart'), left);
    assert.equal(left.visible, false);
    assert.equal(right.visible, false);
    assert.equal(batch.material, left.material);
    for (const angle of [0, 0.8, 2.4]) {
        pivot.rotation.set(0.1, angle, -0.3);
        pivot.position.set(2, 0.4, -1);
        root.updateMatrixWorld(true);
        const original = [
            ...triangleVertices(left),
            ...triangleVertices(right),
        ];
        const actual = triangleVertices(batch);
        assert.equal(actual.length, original.length);
        actual.forEach((point, i) => {
            assert.ok(point.distanceTo(original[i]) < 1e-6);
        });
    }
    assert.equal(culling.consumeRendered(), false);
    Reflect.apply(batch.onBeforeRender, batch, []);
    assert.equal(culling.consumeRendered(), true);
    lease.release();
    lease.release();
    assert.equal(left.visible, true);
    assert.equal(right.visible, true);
    assert.equal(batch.parent, null);
    assert.deepEqual(
        geometry.getAttribute('position').array,
        originalPositions,
    );
});

test('independent actor leases share only immutable output geometry and release it once', () => {
    const { root, left, geometry } = rig();
    const other = root.clone(true);
    let borrowedDisposals = 0;
    geometry.addEventListener('dispose', () => borrowedDisposals++);
    left.material.addEventListener('dispose', () => borrowedDisposals++);
    const a = acquireRigidFaunaBatches(root, root, ['BodyPivot'], () => {});
    const b = acquireRigidFaunaBatches(other, root, ['BodyPivot'], () => {});
    const first = a.batches[0];
    const second = b.batches[0];
    assert.ok(first && second);
    assert.notEqual(first, second);
    assert.equal(first.geometry, second.geometry);
    let ownedDisposals = 0;
    first.geometry.addEventListener('dispose', () => ownedDisposals++);
    a.release();
    assert.equal(ownedDisposals, 0);
    b.release();
    b.release();
    assert.equal(ownedDisposals, 1);
    assert.equal(borrowedDisposals, 0);
    const replay = acquireRigidFaunaBatches(
        root,
        root,
        ['BodyPivot'],
        () => {},
    );
    assert.notEqual(replay.batches[0]?.geometry, first.geometry);
    replay.release();
});

test('batched actor raycasts retain nearest positions and UVs without duplicate logical-mesh hits', () => {
    const { root, right } = rig();
    root.updateMatrixWorld(true);
    const cast = () =>
        new Raycaster(
            new Vector3(0.57, 0.08, 5),
            new Vector3(0, 0, -1),
        ).intersectObject(root, true);
    const before = cast();
    assert.ok(before.length > 0);
    const raycast = right.raycast;
    const lease = acquireRigidFaunaBatches(root, root, ['BodyPivot'], () => {});
    root.updateMatrixWorld(true);
    const after = cast();
    assert.equal(after.length, before.length);
    assert.ok(after[0].point.distanceTo(before[0].point) < 1e-6);
    assert.ok(Math.abs(after[0].distance - before[0].distance) < 1e-6);
    assert.ok(after[0].uv && before[0].uv);
    assert.ok(after[0].uv.distanceTo(before[0].uv) < 1e-6);
    lease.release();
    assert.equal(right.raycast, raycast);
});

for (const change of [
    'transparent',
    'roughness',
    'mirror',
    'morph',
    'partial',
    'children',
    'hidden',
    'render-order',
    'shadow-caster',
    'render-callback',
    'after-render-callback',
    'raycast-callback',
]) {
    test(`rigid batches retain the authored ${change} fallback`, () => {
        const { root, left, right } = rig();
        if (change === 'transparent') {
            left.material.transparent = true;
            right.material.transparent = true;
        }
        if (change === 'roughness') right.material.roughness = 0.2;
        if (change === 'mirror') right.scale.x = -1;
        if (change === 'morph') {
            for (const mesh of [left, right]) {
                mesh.geometry = mesh.geometry.clone();
                mesh.geometry.morphAttributes.position = [
                    new Float32BufferAttribute(new Float32Array(72), 3),
                ];
            }
        }
        if (change === 'partial') right.geometry = right.geometry.clone();
        if (change === 'partial') right.geometry.setDrawRange(0, 3);
        if (change === 'children') right.add(new Group());
        if (change === 'hidden') right.visible = false;
        if (change === 'render-order') right.renderOrder = 1;
        if (change === 'shadow-caster') {
            left.castShadow = true;
            right.castShadow = true;
        }
        if (change === 'render-callback') right.onBeforeRender = () => {};
        if (change === 'after-render-callback') right.onAfterRender = () => {};
        if (change === 'raycast-callback') right.raycast = () => {};
        const visible = right.visible;
        const lease = acquireRigidFaunaBatches(
            root,
            root,
            ['BodyPivot'],
            () => {},
        );
        assert.equal(lease.batches.length, 0);
        assert.equal(right.visible, visible);
        lease.release();
    });
}

test('different articulation parents never share a render batch', () => {
    const { root, pivot, right } = rig();
    const hinge = new Group();
    hinge.name = 'WingPivot';
    pivot.remove(right);
    hinge.add(right);
    root.add(hinge);
    const lease = acquireRigidFaunaBatches(
        root,
        root,
        ['BodyPivot', 'WingPivot'],
        () => {},
    );
    assert.equal(lease.batches.length, 0);
    lease.release();
});

for (const { asset, parents, savings } of [
    { asset: 'Bee', parents: ['Bee_HeadPivot', 'Bee_BodyPivot'], savings: 17 },
    {
        asset: 'Ladybug',
        parents: [
            'Ladybug_ElytraPivot_L',
            'Ladybug_ElytraPivot_R',
            'Ladybug_HeadPivot',
            'Ladybug_BodyPivot',
        ],
        savings: 6,
    },
]) {
    test(`${asset} batches actual rigid GLTF primitives without removing pivots or borrowed resources`, async () => {
        const bytes = await readFile(
            path.resolve(
                process.cwd(),
                `../../apps/garden/public/assets/models/${asset}.glb`,
            ),
        );
        const gltf = await new GLTFLoader().parseAsync(
            bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength,
            ),
            '',
        );
        const model = gltf.scene.clone(true);
        const visibleMeshes = () => {
            let count = 0;
            model.traverse((object) => {
                if (object instanceof Mesh && object.visible) count++;
            });
            return count;
        };
        const pivots = parents.map((name) => model.getObjectByName(name));
        const before = visibleMeshes();
        const lease = acquireRigidFaunaBatches(
            model,
            gltf.scene,
            parents,
            () => {},
        );
        assert.equal(before - visibleMeshes(), savings);
        parents.forEach((name, i) => {
            assert.equal(model.getObjectByName(name), pivots[i]);
        });
        lease.release();
        assert.equal(visibleMeshes(), before);
    });
}
