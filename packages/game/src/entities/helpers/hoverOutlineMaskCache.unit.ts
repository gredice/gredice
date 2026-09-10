import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BoxGeometry,
    Group,
    InterleavedBuffer,
    InterleavedBufferAttribute,
    Mesh,
    Object3D,
    PerspectiveCamera,
    Scene,
} from 'three';
import {
    captureHoverOutlineMaskCacheSnapshot,
    type HoverOutlineMaskCacheTarget,
    hoverOutlineMaskCacheSnapshotMatches,
} from './hoverOutlineMaskCache';

function createFixture({ interleavedPosition = false } = {}) {
    const camera = new PerspectiveCamera(45, 16 / 9, 0.1, 100);
    camera.position.set(5, 6, 7);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    const object = new Group();
    const geometry = new BoxGeometry(2, 1, 3);
    if (interleavedPosition) {
        const position = geometry.getAttribute('position');
        const values = new Float32Array(position.count * 3);
        for (let index = 0; index < position.count; index += 1) {
            values[index * 3] = position.getX(index);
            values[index * 3 + 1] = position.getY(index);
            values[index * 3 + 2] = position.getZ(index);
        }
        geometry.setAttribute(
            'position',
            new InterleavedBufferAttribute(
                new InterleavedBuffer(values, 3),
                3,
                0,
            ),
        );
    }
    const mesh = new Mesh(geometry);
    object.add(mesh);
    const scene = new Scene();
    scene.add(object);
    object.updateMatrixWorld(true);

    const target: HoverOutlineMaskCacheTarget = {
        contentKey: 'raised-bed:2:segment:0',
        object,
    };
    const input = {
        camera,
        drawingBufferHeight: 1_440,
        drawingBufferWidth: 2_560,
        registryVersion: 1,
        scene,
        targets: [target],
    };
    const snapshot = captureHoverOutlineMaskCacheSnapshot(input);
    assert.ok(snapshot);

    return { camera, geometry, input, mesh, object, scene, snapshot, target };
}

describe('hover outline mask cache snapshots', () => {
    it('matches unchanged keyed static content', () => {
        const fixture = createFixture();

        assert.equal(
            hoverOutlineMaskCacheSnapshotMatches(
                fixture.snapshot,
                fixture.input,
            ),
            true,
        );

        fixture.geometry.dispose();
    });

    it('invalidates camera, target, content, registry, and buffer changes', () => {
        const cases: ((fixture: ReturnType<typeof createFixture>) => void)[] = [
            ({ camera }) => {
                camera.position.x += 1;
                camera.updateMatrixWorld(true);
            },
            ({ camera }) => {
                camera.aspect = 4 / 3;
                camera.updateProjectionMatrix();
            },
            ({ input }) => {
                input.drawingBufferWidth += 1;
            },
            ({ input }) => {
                input.registryVersion += 1;
            },
            ({ camera, input }) => {
                input.camera = camera.clone();
            },
            ({ input }) => {
                input.scene = new Scene();
            },
            ({ object }) => {
                object.position.y += 1;
                object.updateMatrixWorld(true);
            },
            ({ mesh, object }) => {
                mesh.position.z += 1;
                object.updateMatrixWorld(true);
            },
            ({ mesh }) => {
                mesh.visible = false;
            },
            ({ mesh }) => {
                mesh.frustumCulled = false;
            },
            ({ mesh }) => {
                mesh.onBeforeRender = () => {};
            },
            ({ scene }) => {
                scene.visible = false;
            },
            ({ target }) => {
                target.contentKey = 'raised-bed:2:segment:0:changed';
            },
            ({ geometry }) => {
                geometry.setDrawRange(1, 3);
            },
            ({ geometry }) => {
                geometry.addGroup(0, 3, 0);
            },
            ({ geometry }) => {
                const position = geometry.getAttribute('position');
                position.needsUpdate = true;
            },
        ];

        for (const mutate of cases) {
            const fixture = createFixture();
            mutate(fixture);

            assert.equal(
                hoverOutlineMaskCacheSnapshotMatches(
                    fixture.snapshot,
                    fixture.input,
                ),
                false,
            );

            fixture.geometry.dispose();
        }
    });

    it('rejects unkeyed and dynamic geometry', () => {
        const camera = new PerspectiveCamera();
        camera.updateMatrixWorld(true);
        const createInput = (object: Object3D, contentKey: unknown) => {
            const scene = new Scene();
            scene.add(object);
            object.updateMatrixWorld(true);
            return {
                camera,
                drawingBufferHeight: 720,
                drawingBufferWidth: 1_280,
                registryVersion: 1,
                scene,
                targets: [{ contentKey, object }],
            };
        };

        assert.equal(
            captureHoverOutlineMaskCacheSnapshot(
                createInput(new Object3D(), null),
            ),
            null,
        );
        assert.equal(
            captureHoverOutlineMaskCacheSnapshot(
                createInput(
                    Object.assign(new Object3D(), { isSkinnedMesh: true }),
                    'skinned',
                ),
            ),
            null,
        );
        assert.equal(
            captureHoverOutlineMaskCacheSnapshot(
                createInput(
                    Object.assign(new Object3D(), {
                        morphTargetInfluences: [0],
                    }),
                    'morphed',
                ),
            ),
            null,
        );
        assert.equal(
            captureHoverOutlineMaskCacheSnapshot(
                createInput(
                    Object.assign(new Object3D(), { isInstancedMesh: true }),
                    'instanced',
                ),
            ),
            null,
        );
    });

    it('invalidates same-version position, index, and interleaved-buffer replacements', () => {
        const positionFixture = createFixture();
        const position = positionFixture.geometry.getAttribute('position');
        assert.ok(!(position instanceof InterleavedBufferAttribute));
        const replacementPosition = position.clone();
        assert.equal(replacementPosition.version, position.version);
        positionFixture.geometry.setAttribute('position', replacementPosition);
        assert.equal(
            hoverOutlineMaskCacheSnapshotMatches(
                positionFixture.snapshot,
                positionFixture.input,
            ),
            false,
        );
        positionFixture.geometry.dispose();

        const indexFixture = createFixture();
        const index = indexFixture.geometry.getIndex();
        assert.ok(index);
        const replacementIndex = index.clone();
        assert.equal(replacementIndex.version, index.version);
        indexFixture.geometry.setIndex(replacementIndex);
        assert.equal(
            hoverOutlineMaskCacheSnapshotMatches(
                indexFixture.snapshot,
                indexFixture.input,
            ),
            false,
        );
        indexFixture.geometry.dispose();

        const interleavedFixture = createFixture({
            interleavedPosition: true,
        });
        const interleavedPosition =
            interleavedFixture.geometry.getAttribute('position');
        assert.ok(interleavedPosition instanceof InterleavedBufferAttribute);
        const replacementInterleavedBuffer = new InterleavedBuffer(
            interleavedPosition.data.array.slice(),
            interleavedPosition.data.stride,
        );
        assert.equal(
            replacementInterleavedBuffer.version,
            interleavedPosition.data.version,
        );
        interleavedPosition.data = replacementInterleavedBuffer;
        assert.equal(
            hoverOutlineMaskCacheSnapshotMatches(
                interleavedFixture.snapshot,
                interleavedFixture.input,
            ),
            false,
        );
        interleavedFixture.geometry.dispose();
    });

    it('invalidates child additions and removals', () => {
        const additionFixture = createFixture();
        const addedGeometry = new BoxGeometry(1, 1, 1);
        additionFixture.object.add(new Mesh(addedGeometry));
        additionFixture.object.updateMatrixWorld(true);
        assert.equal(
            hoverOutlineMaskCacheSnapshotMatches(
                additionFixture.snapshot,
                additionFixture.input,
            ),
            false,
        );
        addedGeometry.dispose();
        additionFixture.geometry.dispose();

        const removalFixture = createFixture();
        removalFixture.object.remove(removalFixture.mesh);
        assert.equal(
            hoverOutlineMaskCacheSnapshotMatches(
                removalFixture.snapshot,
                removalFixture.input,
            ),
            false,
        );
        removalFixture.geometry.dispose();
    });

    it('invalidates target identity and reparenting', () => {
        const fixture = createFixture();
        const replacement = new Group();
        replacement.updateMatrixWorld(true);
        fixture.input.targets = [
            {
                contentKey: fixture.target.contentKey,
                object: replacement,
            },
        ];

        assert.equal(
            hoverOutlineMaskCacheSnapshotMatches(
                fixture.snapshot,
                fixture.input,
            ),
            false,
        );

        fixture.geometry.dispose();

        const reparentFixture = createFixture();
        const replacementParent = new Group();
        reparentFixture.scene.add(replacementParent);
        replacementParent.add(reparentFixture.object);
        reparentFixture.scene.updateMatrixWorld(true);
        assert.equal(
            hoverOutlineMaskCacheSnapshotMatches(
                reparentFixture.snapshot,
                reparentFixture.input,
            ),
            false,
        );
        reparentFixture.geometry.dispose();
    });
});
