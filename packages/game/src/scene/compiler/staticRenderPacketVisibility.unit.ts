import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    ArrayCamera,
    BackSide,
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    Frustum,
    FrustumArray,
    InstancedMesh,
    type Intersection,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    OrthographicCamera,
    PerspectiveCamera,
    Raycaster,
    Vector3,
    type WebGLRenderer,
} from 'three';
import {
    createChunkMatrices,
    createMeshInstanceMatrix,
} from '../../entities/chunkedMeshGeometry';
import { isStaticOpaqueSceneCacheReplayEligible } from '../staticOpaqueSceneCacheReplay';
import {
    compileMeshBufferSources,
    meshGeometryLayoutSignature,
    packMeshGeometry,
    unpackMeshGeometry,
} from './meshBuffers';
import {
    planStaticRenderPackets,
    type StaticRenderPacketContribution,
} from './staticRenderPackets';
import {
    createStaticRenderPacketVisibilityMeshes,
    guardStaticRenderPacketDrawRanges,
    StaticRenderPacketDrawRanges,
    supportsStaticPaletteVisibility,
} from './staticRenderPacketVisibility';

const localTransform = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
} satisfies StaticRenderPacketContribution['localTransform'];
function source(
    id: string,
    x: number,
    overrides: Partial<StaticRenderPacketContribution> = {},
) {
    const geometry = overrides.geometry ?? new BoxGeometry(0.2, 0.2, 0.2);
    return {
        id,
        geometry,
        material: new MeshStandardMaterial(),
        instances: [{ position: [x, 0, 0], rotation: 0 }],
        localTransform,
        scale: 1,
        castShadow: true,
        receiveShadow: true,
        renderOrder: 0,
        cacheGroup: undefined,
        chunkKey: '0:0',
        family: 'opaque',
        layoutSignature: meshGeometryLayoutSignature(geometry),
        triangleCount: 12,
        ...overrides,
    } satisfies StaticRenderPacketContribution;
}
function plan(sources: StaticRenderPacketContribution[]) {
    const material = new MeshStandardMaterial();
    const packet = planStaticRenderPackets(
        sources.map((s) => ({ ...s, material })),
    )[0];
    assert.ok(packet);
    const geometry = unpackMeshGeometry(
        compileMeshBufferSources(
            packet.sources.map((s) => ({
                source: packMeshGeometry(s.geometry),
                matrices: createChunkMatrices(
                    s.instances,
                    s.localTransform,
                    s.scale,
                ),
            })),
        ),
    );
    const ranges = new StaticRenderPacketDrawRanges();
    const meshes = createStaticRenderPacketVisibilityMeshes(
        packet,
        geometry,
        ranges,
        'test',
    );
    for (const mesh of meshes) mesh.updateMatrixWorld(true);
    return { packet, geometry, material, ranges, meshes };
}
function frustum(x = 0) {
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
    camera.position.set(x, 0, 5);
    camera.lookAt(x, 0, 0);
    camera.updateMatrixWorld(true);
    return new Frustum().setFromProjectionMatrix(
        new Matrix4().multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse,
        ),
    );
}
function visible(meshes: ReturnType<typeof plan>['meshes'], view: Frustum) {
    return meshes.map((mesh) => mesh.intersectsFrustum(view));
}

describe('original-source visibility on shared compiled buffers', () => {
    it('uses one full packet for all-visible, source ranges for mixed, and no draw for none', () => {
        const p = plan([source('a', 0), source('b', 4)]);
        assert.deepEqual(visible(p.meshes, frustum(0)), [false, true, false]);
        assert.deepEqual(visible(p.meshes, frustum(4)), [false, false, true]);
        assert.deepEqual(visible(p.meshes, frustum(10)), [false, false, false]);
        const wide = frustum();
        wide.planes[0].constant += 10;
        wide.planes[1].constant += 10;
        assert.deepEqual(visible(p.meshes, wide), [true, false, false]);
        assert.ok(
            p.meshes.every(
                (mesh) =>
                    mesh.geometry === p.geometry &&
                    mesh.material === p.material,
            ),
        );
        assert.deepEqual(
            p.meshes.slice(1).map((mesh) => mesh.range),
            [
                {
                    start: 0,
                    count: 36,
                    positionStart: 0,
                    positionCount: 24,
                    group: 0,
                },
                {
                    start: 36,
                    count: 36,
                    positionStart: 24,
                    positionCount: 24,
                    group: 1,
                },
            ],
        );
    });
    it('rechecks mutated planes on the same frustum and keeps shadow/main caches independent', () => {
        const p = plan([source('a', 0), source('b', 4)]);
        const main = frustum(),
            shadow = frustum(4);
        assert.deepEqual(visible(p.meshes, main), [false, true, false]);
        assert.deepEqual(visible(p.meshes, shadow), [false, false, true]);
        assert.deepEqual(visible(p.meshes, main), [false, true, false]);
        main.copy(frustum(4));
        assert.deepEqual(visible(p.meshes, main), [false, false, true]);
    });
    it('retains nonindexed ranges and rechecks changed object world matrices', () => {
        const geometry = new BoxGeometry(0.2, 0.2, 0.2).toNonIndexed();
        const p = plan([
            source('a', 0, { geometry }),
            source('b', 4, { geometry }),
        ]);
        assert.deepEqual(
            p.meshes
                .slice(1)
                .map((mesh) => [mesh.range.start, mesh.range.count]),
            [
                [0, 36],
                [36, 36],
            ],
        );
        assert.deepEqual(visible(p.meshes, frustum()), [false, true, false]);
        for (const mesh of p.meshes) {
            mesh.position.x = 10;
            mesh.updateMatrixWorld(true);
        }
        assert.deepEqual(visible(p.meshes, frustum()), [false, false, false]);
        assert.deepEqual(visible(p.meshes, frustum(10)), [false, true, false]);
    });
    it('evaluates the actual array-camera union again when child cameras change', () => {
        const p = plan([source('a', 0), source('b', 4)]);
        const cameras = [0, 4].map((x) => {
            const camera = new PerspectiveCamera(25, 1, 0.1, 20);
            camera.position.set(x, 0, 5);
            camera.lookAt(x, 0, 0);
            camera.updateMatrixWorld(true);
            return camera;
        });
        const array = new ArrayCamera(cameras),
            view = new FrustumArray().setFromArrayCamera(array);
        assert.deepEqual(
            p.meshes.map((mesh) => mesh.intersectsFrustum(view)),
            [true, false, false],
        );
        cameras[1].position.set(10, 0, 5);
        cameras[1].lookAt(10, 0, 0);
        cameras[1].updateMatrixWorld(true);
        view.setFromArrayCamera(array);
        assert.deepEqual(
            p.meshes.map((mesh) => mesh.intersectsFrustum(view)),
            [false, true, false],
        );
    });
    it('never admits zero-count full or partial ranges to native drawing', () => {
        const geometry = new BufferGeometry();
        geometry.setAttribute(
            'position',
            new BufferAttribute(new Float32Array(), 3),
        );
        geometry.setAttribute(
            'normal',
            new BufferAttribute(new Float32Array(), 3),
        );
        geometry.setAttribute('uv', new BufferAttribute(new Float32Array(), 2));
        const p = plan([source('empty', 0, { geometry })]);
        assert.deepEqual(visible(p.meshes, frustum()), [false, false]);
        assert.ok(p.meshes.every((mesh) => mesh.range.count === 0));
    });
    it('raycasts each source range once with original distance, UV, face and side semantics', () => {
        const p = plan([source('a', 0), source('b', 4)]);
        const original = new Mesh(p.geometry, p.material);
        original.updateMatrixWorld(true);
        const full = { ...p.geometry.drawRange };
        const values = (hits: Intersection[]) =>
            hits.map((hit) => ({
                distance: hit.distance,
                point: hit.point.toArray(),
                uv: hit.uv?.toArray(),
                normal: hit.normal?.toArray(),
                faceIndex: hit.faceIndex,
                face: hit.face
                    ? {
                          a: hit.face.a,
                          b: hit.face.b,
                          c: hit.face.c,
                          normal: hit.face.normal.toArray(),
                          materialIndex: hit.face.materialIndex,
                      }
                    : null,
            }));
        for (const side of [p.material.side, DoubleSide, BackSide]) {
            p.material.side = side;
            for (const x of [0, 4]) {
                const raycaster = new Raycaster(
                    new Vector3(x + 0.025, 0.035, 5),
                    new Vector3(0, 0, -1),
                    0,
                    10,
                );
                const expected = raycaster.intersectObject(original, false);
                const actual = raycaster.intersectObjects(p.meshes, false);
                assert.ok(expected.length > 0);
                assert.deepEqual(values(actual), values(expected));
                assert.ok(actual.every((hit) => hit.object !== p.meshes[0]));
                assert.deepEqual(p.geometry.drawRange, full);
                raycaster.far = 1;
                assert.deepEqual(
                    raycaster.intersectObjects(p.meshes, false),
                    [],
                );
            }
        }
        assert.equal(p.meshes[2].intersectsFrustum(frustum()), false);
        assert.ok(
            new Raycaster(
                new Vector3(4.025, 0.035, 5),
                new Vector3(0, 0, -1),
            ).intersectObject(p.meshes[2], false).length > 0,
        );
        assert.deepEqual(p.geometry.drawRange, full);
    });
    it('restores raycast ranges after failure and nested main/shadow range selection', () => {
        const p = plan([source('a', 0), source('b', 4)]),
            full = { ...p.geometry.drawRange };
        const raycaster = new Raycaster(
            new Vector3(4.025, 0.035, 5),
            new Vector3(0, 0, -1),
        );
        class ThrowingHits extends Array<Intersection> {
            override push(..._hits: Intersection[]): number {
                throw new Error('intersection sink');
            }
        }
        assert.throws(
            () => p.meshes[2].raycast(raycaster, new ThrowingHits()),
            /intersection sink/,
        );
        assert.deepEqual(p.geometry.drawRange, full);
        p.meshes[1].onBeforeShadow();
        assert.throws(
            () => p.meshes[2].raycast(raycaster, new ThrowingHits()),
            /intersection sink/,
        );
        assert.deepEqual(p.geometry.drawRange, { start: 0, count: 36 });
        p.meshes[1].onAfterShadow();
        assert.deepEqual(p.geometry.drawRange, full);
        class NestedHits extends Array<Intersection> {
            override push(...hits: Intersection[]): number {
                const range = { ...p.geometry.drawRange };
                p.meshes[1].raycast(
                    new Raycaster(
                        new Vector3(0.025, 0.035, 5),
                        new Vector3(0, 0, -1),
                    ),
                    [],
                );
                assert.deepEqual(p.geometry.drawRange, range);
                return super.push(...hits);
            }
        }
        const hits = new NestedHits();
        p.meshes[2].raycast(raycaster, hits);
        assert.ok(hits.length > 0);
        assert.deepEqual(p.geometry.drawRange, full);
    });
    it('matches actual Float32 InstancedMesh source bounds with nontrivial transforms', () => {
        const a = source('a', 0, {
            instances: [
                { position: [0.9837654321, 0, 0], rotation: 1 },
                { position: [-0.2, 0, 0.1], rotation: 3 },
            ],
            localTransform: {
                position: [0.3, 0.2, 0.1],
                rotation: [0.2, 0.4, 0.1],
            },
            scale: [1.25, 0.75, 0.5],
        });
        const p = plan([a, source('b', 4)]);
        const old = new InstancedMesh(
            a.geometry,
            a.material,
            a.instances.length,
        );
        a.instances.forEach((instance, index) => {
            old.setMatrixAt(
                index,
                createMeshInstanceMatrix(instance, a.localTransform, a.scale),
            );
        });
        old.computeBoundingSphere();
        old.updateMatrixWorld(true);
        for (let x = -4; x < 5; x += 0.05) {
            const view = frustum(x);
            assert.equal(
                p.meshes[1].intersectsFrustum(view),
                old.intersectsFrustum(view) &&
                    !p.meshes[0].intersectsFrustum(view),
            );
        }
        assert.equal(a.geometry.boundingSphere !== null, true);
    });
    it('preserves old compiled group bounds rather than culling members separately', () => {
        const p = plan([
            source('a', 0, {
                originalVisibilityMode: 'compiled',
                originalVisibilityGroup: 'old',
            }),
            source('b', 4, {
                originalVisibilityMode: 'compiled',
                originalVisibilityGroup: 'old',
            }),
            source('c', 10),
        ]);
        assert.deepEqual(visible(p.meshes, frustum()), [
            false,
            true,
            true,
            false,
        ]);
        assert.deepEqual(visible(p.meshes, frustum(4)), [
            false,
            true,
            true,
            false,
        ]);
    });
    it('rejects morph and partial-range palette migration while leaving borrowed geometry untouched', () => {
        const geometry = new BoxGeometry();
        assert.equal(supportsStaticPaletteVisibility(geometry), true);
        geometry.morphAttributes.position = [
            geometry.getAttribute('position').clone(),
        ];
        assert.equal(supportsStaticPaletteVisibility(geometry), false);
        geometry.morphAttributes = {};
        geometry.setDrawRange(3, 6);
        assert.equal(supportsStaticPaletteVisibility(geometry), false);
        assert.deepEqual(geometry.drawRange, { start: 3, count: 6 });
        const s = source('a', 0);
        const original = s.geometry.getAttribute('position').array.slice();
        const sphere = s.geometry.boundingSphere;
        plan([s, source('b', 4)]);
        assert.deepEqual(s.geometry.getAttribute('position').array, original);
        assert.equal(s.geometry.boundingSphere, sphere);
    });
    it('restores ranges after main and shadow draws and excludes callback meshes from cache replay', () => {
        const p = plan([source('a', 0), source('b', 4)]);
        const range = p.meshes[2];
        const original = { ...p.geometry.drawRange };
        range.onBeforeRender();
        assert.deepEqual(p.geometry.drawRange, { start: 36, count: 36 });
        range.onAfterRender();
        assert.deepEqual(p.geometry.drawRange, original);
        range.onBeforeShadow();
        assert.deepEqual(p.geometry.drawRange, { start: 36, count: 36 });
        range.onAfterShadow();
        assert.deepEqual(p.geometry.drawRange, original);
        assert.ok(
            p.meshes.every(
                (mesh) => !isStaticOpaqueSceneCacheReplayEligible(mesh),
            ),
        );
    });
    it('restores interrupted and nested render ranges without disposing borrowed resources', () => {
        const p = plan([source('a', 0), source('b', 4)]);
        const original = { ...p.geometry.drawRange };
        let disposed = 0;
        p.geometry.addEventListener('dispose', () => disposed++);
        p.material.addEventListener('dispose', () => disposed++);
        p.ranges.render(() => {
            p.meshes[1].onBeforeRender();
            assert.throws(
                () =>
                    p.ranges.render(() => {
                        p.meshes[2].onBeforeShadow();
                        throw new Error('native draw');
                    }),
                /native draw/,
            );
            assert.deepEqual(p.geometry.drawRange, { start: 0, count: 36 });
            p.meshes[1].onAfterRender();
        });
        assert.deepEqual(p.geometry.drawRange, original);
        assert.throws(
            () =>
                p.ranges.render(() => {
                    p.meshes[2].onBeforeRender();
                    throw new Error('material callback');
                }),
            /material callback/,
        );
        assert.deepEqual(p.geometry.drawRange, original);
        assert.equal(disposed, 0);
    });
    it('detaches same-renderer sibling guards in either order and after idempotent StrictMode cleanup', () => {
        for (const order of [
            [0, 1],
            [1, 0],
        ]) {
            const a = new StaticRenderPacketDrawRanges(),
                b = new StaticRenderPacketDrawRanges();
            const original = () => {};
            const renderer = { render: original } satisfies Pick<
                WebGLRenderer,
                'render'
            >;
            const releases = [
                guardStaticRenderPacketDrawRanges(renderer, a),
                guardStaticRenderPacketDrawRanges(renderer, b),
            ];
            const guarded = renderer.render;
            releases[order[0]]();
            assert.equal(renderer.render, guarded);
            releases[order[1]]();
            assert.equal(renderer.render, original);
            releases[order[1]]();
            assert.equal(renderer.render, original);
            const remount = guardStaticRenderPacketDrawRanges(renderer, a);
            assert.notEqual(renderer.render, guarded);
            remount();
            assert.equal(renderer.render, original);
        }
    });

    it('keeps an active range while another lease retains the same owner', () => {
        const p = plan([source('a', 0), source('b', 4)]);
        const renderer = { render: () => {} } satisfies Pick<
            WebGLRenderer,
            'render'
        >;
        const first = guardStaticRenderPacketDrawRanges(renderer, p.ranges);
        const second = guardStaticRenderPacketDrawRanges(renderer, p.ranges);
        const full = { ...p.geometry.drawRange };
        p.meshes[2].onBeforeRender();
        first();
        assert.deepEqual(p.geometry.drawRange, { start: 36, count: 36 });
        p.meshes[2].onAfterRender();
        assert.deepEqual(p.geometry.drawRange, full);
        second();
    });
});
