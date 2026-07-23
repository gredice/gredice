import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { PlantInstanceBufferMetrics } from './plantInstanceBufferMetrics';
import {
    createStaticInstancedBufferAttribute,
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

    it('rejects overflow and late usage changes', () => {
        const attribute = createStaticInstancedBufferAttribute(1, 3);
        assert.throws(
            () => markStaticInstancedAttributeForUpload(attribute, 2),
            /exceeds capacity/,
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
            peakAllocatedBytes: 192,
            peakCapacity: 3,
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
            peakAllocatedBytes: 192,
            peakCapacity: 3,
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
});
