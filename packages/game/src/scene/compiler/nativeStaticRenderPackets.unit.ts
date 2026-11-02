import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    BoxGeometry,
    Frustum,
    Group,
    Matrix4,
    MeshStandardMaterial,
    OrthographicCamera,
    Raycaster,
    Vector3,
} from 'three';
import { createChunkMatrices } from '../../entities/chunkedMeshGeometry';
import { isStaticOpaqueSceneCacheReplayEligible } from '../staticOpaqueSceneCacheReplay';
import { meshGeometryLayoutSignature } from './meshBuffers';
import {
    planStaticRenderPackets,
    type StaticRenderPacketContribution,
} from './staticRenderPackets';
import {
    createNativeStaticRenderPacketMeshes,
    StaticRenderPacketDrawRanges,
    supportsNativeStaticRenderPacket,
} from './staticRenderPacketVisibility';

function fixture() {
    const geometry = new BoxGeometry(0.2, 0.2, 0.2);
    const material = new MeshStandardMaterial();
    const source = (id: string, x: number): StaticRenderPacketContribution => ({
        id,
        geometry,
        material,
        instances: [{ position: [x, 0, 0], rotation: 0 }],
        localTransform: { position: [0, 0, 0], rotation: [0, 0, 0] },
        scale: 1,
        castShadow: true,
        receiveShadow: true,
        renderOrder: 0,
        cacheGroup: 'static-props',
        chunkKey: '0:0',
        family: 'opaque',
        layoutSignature: meshGeometryLayoutSignature(geometry),
        triangleCount: 12,
        sourceBoundsCulling: true,
        originalVisibilityMode: 'instanced',
    });
    const sources = [source('a', 0), source('b', 3)];
    const packet = planStaticRenderPackets(sources)[0];
    assert.ok(packet);
    return { geometry, material, packet, sources };
}

function view(x = 0, half = 1) {
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 20);
    camera.position.set(x, 0, 5);
    camera.lookAt(x, 0, 0);
    camera.updateMatrixWorld();
    return new Frustum().setFromProjectionMatrix(
        new Matrix4().multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse,
        ),
    );
}

test('native packets preserve exact uploaded matrices with borrowed geometry and no baked output', () => {
    const { geometry, packet } = fixture();
    const meshes = createNativeStaticRenderPacketMeshes(packet, 'native');
    assert.equal(meshes.length, 3);
    assert.equal(meshes[0].count, 2);
    assert.ok(meshes.every((mesh) => mesh.geometry === geometry));
    const expected = packet.sources.flatMap((source) =>
        Array.from(
            new Float32Array(
                createChunkMatrices(
                    source.instances,
                    source.localTransform,
                    source.scale,
                ),
            ),
        ),
    );
    assert.deepEqual(Array.from(meshes[0].instanceMatrix.array), expected);
    assert.ok(meshes.every(isStaticOpaqueSceneCacheReplayEligible));
});

test('native aggregate and authored groups preserve main/shadow and changing-frustum culling', () => {
    const { packet } = fixture();
    const meshes = createNativeStaticRenderPacketMeshes(packet, 'native');
    for (const mesh of meshes) mesh.updateMatrixWorld();
    const flags = (frustum: Frustum) =>
        meshes.map((mesh) => mesh.intersectsFrustum(frustum));
    const main = view(0, 5),
        shadow = view();
    assert.deepEqual(flags(main), [true, false, false]);
    assert.deepEqual(flags(shadow), [false, true, false]);
    shadow.copy(view(3));
    assert.deepEqual(flags(shadow), [false, false, true]);
    assert.deepEqual(flags(main), [true, false, false]);
});

test('native picking tests each authored instance once regardless of render visibility', () => {
    const { packet } = fixture();
    const meshes = createNativeStaticRenderPacketMeshes(packet, 'native');
    const root = new Group();
    root.add(...meshes);
    root.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(3, 0, 5), new Vector3(0, 0, -1));
    const hits = ray.intersectObject(root, true);
    assert.ok(hits.length > 0);
    assert.ok(
        hits.every((hit) => hit.object === meshes[2] && hit.instanceId === 0),
    );
    assert.ok(Math.abs(hits[0].point.z - 0.1) < 1e-6);
    assert.ok(hits[0].uv);
});

test('native instance-buffer cleanup never disposes borrowed source geometry or material', () => {
    const { packet, geometry, material } = fixture();
    let borrowedDisposals = 0,
        ownedDisposals = 0;
    geometry.addEventListener('dispose', () => borrowedDisposals++);
    material.addEventListener('dispose', () => borrowedDisposals++);
    const meshes = createNativeStaticRenderPacketMeshes(packet, 'native');
    for (const mesh of meshes) {
        mesh.addEventListener('dispose', () => ownedDisposals++);
        mesh.dispose();
    }
    assert.equal(ownedDisposals, meshes.length);
    assert.equal(borrowedDisposals, 0);
});

for (const unsupported of [
    'different-geometry',
    'compiled',
    'unknown-culling',
    'shared-visibility-group',
    'partial',
]) {
    test(`native packets retain the existing path for ${unsupported}`, () => {
        const { sources, geometry } = fixture();
        if (unsupported === 'different-geometry')
            sources[1].geometry = geometry.clone();
        if (unsupported === 'compiled')
            sources[1].originalVisibilityMode = 'compiled';
        if (unsupported === 'unknown-culling')
            sources[1].sourceBoundsCulling = false;
        if (unsupported === 'shared-visibility-group')
            for (const source of sources)
                source.originalVisibilityGroup = 'shared';
        if (unsupported === 'partial') geometry.setDrawRange(0, 3);
        const packet = planStaticRenderPackets(sources)[0];
        assert.ok(packet);
        assert.equal(supportsNativeStaticRenderPacket(packet), false);
    });
}

test('native visible spans share immutable storage and restore counts across nested, interrupted and picking work', () => {
    const { sources } = fixture();
    sources.push({
        ...sources[0],
        id: 'c',
        instances: [{ position: [6, 0, 0], rotation: 0 }],
    });
    const packet = planStaticRenderPackets(sources)[0];
    assert.ok(packet);
    const ranges = new StaticRenderPacketDrawRanges();
    const meshes = createNativeStaticRenderPacketMeshes(
        packet,
        'native',
        ranges,
    );
    const root = new Group();
    root.position.set(2, 1, 0);
    root.add(...meshes);
    root.updateMatrixWorld(true);
    assert.ok(
        meshes.every(
            (mesh) =>
                mesh.instanceMatrix.array.buffer ===
                meshes[0].instanceMatrix.array.buffer,
        ),
    );
    assert.deepEqual(
        meshes.map((mesh) => mesh.instanceMatrix.array.byteOffset),
        [0, 0, 64, 128],
    );
    const camera = (x: number, half: number) => {
        const result = new OrthographicCamera(-half, half, 2, -2, 0.1, 20);
        result.position.set(x + 2, 1, 5);
        result.lookAt(x + 2, 1, 0);
        result.updateMatrixWorld();
        return result;
    };
    const main = camera(1.5, 2),
        shadow = camera(4.5, 2),
        narrow = camera(0, 1);
    const frustum = (camera: OrthographicCamera) =>
        new Frustum().setFromProjectionMatrix(
            new Matrix4().multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse,
            ),
        );
    assert.deepEqual(
        meshes.map((mesh) => mesh.intersectsFrustum(frustum(main))),
        [false, true, false, false],
    );
    assert.deepEqual(
        meshes.map((mesh) => mesh.intersectsFrustum(frustum(shadow))),
        [false, false, true, false],
    );
    const [, first, second] = meshes;
    ranges.beginRender(main);
    first.onBeforeRender(undefined, undefined, main);
    assert.equal(first.count, 2);
    const hits: import('three').Intersection[] = [];
    first.raycast(
        new Raycaster(new Vector3(5, 1, 5), new Vector3(0, 0, -1)),
        hits,
    );
    assert.equal(
        hits.length,
        0,
        'coalesced draws must not duplicate a later source during picking',
    );
    assert.equal(first.count, 2);
    ranges.beginRender(narrow);
    first.onBeforeRender(undefined, undefined, narrow);
    assert.equal(first.count, 1);
    // Restore the interrupted nested submission without an onAfterRender call.
    ranges.endRender();
    assert.equal(first.count, 2);
    second.onBeforeShadow(undefined, undefined, main, shadow);
    assert.equal(second.count, 2);
    second.onAfterShadow();
    assert.equal(second.count, 1);
    ranges.endRender();
    assert.equal(first.count, 1);
    ranges.beginRender(main);
    first.onBeforeRender(undefined, undefined, main);
    ranges.restoreAll();
    assert.equal(first.count, 1);
    ranges.endRender();
});
