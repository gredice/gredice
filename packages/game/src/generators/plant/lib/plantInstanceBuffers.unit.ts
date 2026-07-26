import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { PlantInstanceBufferMetrics } from './plantInstanceBufferMetrics';
import {
    applyPackedPlantBounds,
    copyPackedStaticInstancedAttribute,
    copyPackedStaticInstanceMatrices,
    createPlantGeometryShell,
    createStaticInstancedBufferAttribute,
    disposePlantGeometryShell,
    finalizeStaticInstanceMatrixUpload,
    markStaticInstancedAttributeForUpload,
} from './plantInstanceBuffers';

describe('generated plant instance buffers', () => {
    it('creates exact-capacity immutable attributes', () => {
        const attribute = createStaticInstancedBufferAttribute(3, 2);

        assert.equal(attribute.count, 3);
        assert.equal(
            attribute.array.byteLength,
            3 * 2 * Float32Array.BYTES_PER_ELEMENT,
        );
        assert.equal(attribute.usage, THREE.StaticDrawUsage);
    });

    it('marks only live components for upload', () => {
        const attribute = createStaticInstancedBufferAttribute(4, 3);

        markStaticInstancedAttributeForUpload(attribute, 2);

        assert.equal(attribute.version, 1);
        assert.equal(attribute.usage, THREE.StaticDrawUsage);
        assert.deepEqual(attribute.updateRanges, [{ count: 6, start: 0 }]);
    });

    it('finalizes exact matrix ranges and live mesh count', () => {
        const mesh = new THREE.InstancedMesh(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial(),
            2,
        );

        finalizeStaticInstanceMatrixUpload(mesh, 2);

        assert.equal(mesh.count, 2);
        assert.equal(mesh.visible, true);
        assert.equal(mesh.instanceMatrix.usage, THREE.StaticDrawUsage);
        assert.deepEqual(mesh.instanceMatrix.updateRanges, [
            { count: 32, start: 0 },
        ]);

        mesh.geometry.dispose();
        mesh.material.dispose();
    });

    it('copies packed attributes and matrices without Matrix4 reconstruction', () => {
        const attribute = createStaticInstancedBufferAttribute(2, 2);
        const values = Float32Array.of(1, 2, 3, 4);
        copyPackedStaticInstancedAttribute(attribute, values, 2);
        assert.deepEqual(Array.from(attribute.array), [1, 2, 3, 4]);

        const mesh = new THREE.InstancedMesh(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial(),
            1,
        );
        const matrices = Float32Array.from(
            new THREE.Matrix4().makeTranslation(1, 2, 3).elements,
        );
        copyPackedStaticInstanceMatrices(mesh, matrices, 1);

        assert.deepEqual(Array.from(mesh.instanceMatrix.array), [...matrices]);
        assert.equal(mesh.count, 1);
        assert.equal(mesh.visible, true);

        mesh.geometry.dispose();
        mesh.material.dispose();
    });

    it('adopts worker-computed conservative bounds', () => {
        const mesh = new THREE.InstancedMesh(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial(),
            1,
        );

        applyPackedPlantBounds(mesh, {
            boxMax: [4, 5, 6],
            boxMin: [-1, -2, -3],
            sphereCenter: [1, 1.5, 2],
            sphereRadius: 7,
        });

        assert.deepEqual(mesh.boundingBox?.min.toArray(), [-1, -2, -3]);
        assert.deepEqual(mesh.boundingBox?.max.toArray(), [4, 5, 6]);
        assert.deepEqual(mesh.boundingSphere?.center.toArray(), [1, 1.5, 2]);
        assert.equal(mesh.boundingSphere?.radius, 7);

        mesh.geometry.dispose();
        mesh.material.dispose();
    });

    it('shares immutable topology while disposing batch-local attributes', () => {
        const source = new THREE.BoxGeometry(1, 1, 1);
        const shell = createPlantGeometryShell(source);
        const instanceAttribute = createStaticInstancedBufferAttribute(2, 1);
        shell.setAttribute('instanceSwayPhase', instanceAttribute);

        assert.equal(shell.index, source.index);
        assert.equal(
            shell.getAttribute('position'),
            source.getAttribute('position'),
        );
        assert.equal(
            shell.getAttribute('instanceSwayPhase'),
            instanceAttribute,
        );

        disposePlantGeometryShell(shell, source);

        assert.ok(source.index);
        assert.ok(source.getAttribute('position'));
        source.dispose();
    });

    it('rejects overflow and late usage changes', () => {
        const attribute = createStaticInstancedBufferAttribute(1, 3);
        assert.throws(
            () => markStaticInstancedAttributeForUpload(attribute, 2),
            /exceeds capacity/,
        );
        assert.throws(
            () =>
                copyPackedStaticInstancedAttribute(
                    attribute,
                    Float32Array.of(1),
                    1,
                ),
            /expected 3/,
        );

        attribute.setUsage(THREE.DynamicDrawUsage);
        attribute.needsUpdate = true;
        assert.throws(
            () => markStaticInstancedAttributeForUpload(attribute, 1),
            /cannot change after its first upload/,
        );
    });
});

describe('generated plant instance-buffer metrics', () => {
    it('tracks active allocations, peaks, and uploads', () => {
        const metrics = new PlantInstanceBufferMetrics();
        const unregisterFlower = metrics.register({
            allocatedBytes: 128,
            capacity: 2,
            kind: 'flower',
            liveCount: 2,
        });
        const unregisterThorn = metrics.register({
            allocatedBytes: 64,
            capacity: 1,
            kind: 'thorn',
            liveCount: 1,
        });
        metrics.recordUpload(96);

        assert.deepEqual(metrics.snapshot(), {
            activeAllocatedBytes: 192,
            activeCapacity: 3,
            activeEmptyMeshCount: 0,
            activeLiveCount: 3,
            activeMeshCount: 2,
            bufferUploadCount: 1,
            orphanedResourceCount: 0,
            peakAllocatedBytes: 192,
            peakCapacity: 3,
            releasedAllocationCount: 0,
            uploadedBytes: 96,
        });

        unregisterFlower();
        unregisterThorn();
        assert.deepEqual(metrics.snapshot(), {
            activeAllocatedBytes: 0,
            activeCapacity: 0,
            activeEmptyMeshCount: 0,
            activeLiveCount: 0,
            activeMeshCount: 0,
            bufferUploadCount: 1,
            orphanedResourceCount: 0,
            peakAllocatedBytes: 192,
            peakCapacity: 3,
            releasedAllocationCount: 2,
            uploadedBytes: 96,
        });
    });

    it('rejects invalid allocation counts', () => {
        const metrics = new PlantInstanceBufferMetrics();

        assert.throws(
            () =>
                metrics.register({
                    allocatedBytes: 64,
                    capacity: 1,
                    kind: 'leaf',
                    liveCount: 2,
                }),
            /cannot exceed capacity/,
        );
    });

    it('keeps the production singleton path inert until profiling enables it', () => {
        const metrics = new PlantInstanceBufferMetrics(false);
        metrics.register({
            allocatedBytes: 128,
            capacity: 2,
            kind: 'flower',
            liveCount: 2,
        });
        metrics.recordUpload(64);

        assert.equal(metrics.snapshot().activeMeshCount, 0);
        assert.equal(metrics.snapshot().bufferUploadCount, 0);

        metrics.setEnabled(true);
        const unregister = metrics.register({
            allocatedBytes: 128,
            capacity: 2,
            kind: 'flower',
            liveCount: 2,
        });
        metrics.recordUpload(64);
        assert.equal(metrics.snapshot().activeMeshCount, 1);
        assert.equal(metrics.snapshot().bufferUploadCount, 1);

        unregister();
        metrics.setEnabled(false);
        assert.equal(metrics.snapshot().activeMeshCount, 0);
        assert.equal(metrics.snapshot().bufferUploadCount, 0);
    });
});
