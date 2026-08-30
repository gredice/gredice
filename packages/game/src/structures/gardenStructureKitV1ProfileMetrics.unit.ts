import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    DataTexture,
    Matrix4,
    MeshStandardMaterial,
} from 'three';
import type { GardenStructureKitV1RuntimeBatch } from './GardenStructureKitV1AssetRenderer';
import type { GardenStructureKitV1AssetResolution } from './gardenStructureKitV1AssetResolver';
import {
    getGardenStructureGeometryCpuBytes,
    measureGardenStructureKitV1ProfileMetrics,
} from './gardenStructureKitV1ProfileMetrics';

describe('garden structure kit profile metrics', () => {
    test('counts distinct attribute views that share one GLB backing buffer', () => {
        const backing = new ArrayBuffer(48);
        const geometry = new BufferGeometry();
        geometry.setAttribute(
            'position',
            new BufferAttribute(new Float32Array(backing, 0, 6), 3),
        );
        geometry.setAttribute(
            'normal',
            new BufferAttribute(new Float32Array(backing, 24, 6), 3),
        );

        assert.equal(
            getGardenStructureGeometryCpuBytes(geometry).attributeBytes,
            48,
        );
        geometry.dispose();
    });

    test('counts resolved production primitives from real geometry and deduplicates resident bytes', () => {
        const geometry = new BoxGeometry(1, 1, 1);
        const texture = new DataTexture(new Uint8Array(2 * 2 * 4), 2, 2);
        texture.generateMipmaps = false;
        const material = new MeshStandardMaterial({ map: texture });
        const primitive = Object.freeze({
            geometry,
            material,
            nodeName: 'Primitive',
            sourceMatrix: new Matrix4(),
            sourceNodeName: 'Part',
            transparency: 'opaque',
        });
        const resolution: GardenStructureKitV1AssetResolution = Object.freeze({
            geometries: new Map([
                [
                    'floor.timber',
                    Object.freeze({
                        geometryId: 'floor.timber',
                        issues: Object.freeze([]),
                        primitives: Object.freeze([primitive]),
                        status: 'resolved',
                    }),
                ],
            ]),
            issues: Object.freeze([]),
        });
        const resolvedBatch: GardenStructureKitV1RuntimeBatch = Object.freeze({
            geometryId: 'floor.debug',
            geometryKind: 'floor-cell',
            id: 'resolved',
            instanceIds: Object.freeze(['a', 'b']),
            materialId: 'floor.timber',
            transforms: new Float32Array(6),
            transformStride: 3,
        });
        const unresolvedBatch: GardenStructureKitV1RuntimeBatch = Object.freeze(
            {
                geometryId: 'prop.missing',
                geometryKind: 'prop',
                id: 'fallback',
                instanceIds: Object.freeze(['c', 'd', 'e']),
                materialId: 'prop.missing',
                transforms: new Float32Array(9),
                transformStride: 3,
            },
        );

        const result = measureGardenStructureKitV1ProfileMetrics({
            batches: [resolvedBatch, unresolvedBatch],
            fallbackGeometry: geometry,
            previewInstanceCount: 4,
            resolution,
        });
        const resident = getGardenStructureGeometryCpuBytes(geometry);

        assert.deepEqual(result.production, {
            attributeBytes: resident.attributeBytes,
            drawCount: 1,
            indexBytes: resident.indexBytes,
            instanceBufferBytes: 152,
            instanceCount: 2,
            opaqueDrawCount: 1,
            textureCount: 1,
            textureEstimatedBytes: 16,
            transparentDrawCount: 0,
            triangleCount: 24,
            vertexCount: 48,
        });
        assert.equal(result.fallback.drawCount, 1);
        assert.equal(result.fallback.instanceCount, 3);
        assert.equal(result.fallback.triangleCount, 36);
        assert.equal(result.preview.drawCount, 1);
        assert.equal(result.preview.instanceCount, 4);
        assert.equal(result.preview.triangleCount, 48);
        assert.equal(result.unresolvedBatchCount, 1);

        const culled = measureGardenStructureKitV1ProfileMetrics({
            batches: [resolvedBatch, unresolvedBatch],
            fallbackGeometry: geometry,
            getVisibleInstanceCount: () => 0,
            previewInstanceCount: 0,
            resolution,
        });

        assert.equal(culled.production.drawCount, 0);
        assert.equal(culled.production.instanceCount, 0);
        assert.equal(culled.production.vertexCount, 0);
        assert.equal(culled.production.triangleCount, 0);
        assert.equal(culled.production.attributeBytes, resident.attributeBytes);
        assert.equal(culled.production.indexBytes, resident.indexBytes);
        assert.equal(culled.production.instanceBufferBytes, 152);
        assert.equal(culled.production.textureEstimatedBytes, 16);
        assert.equal(culled.fallback.drawCount, 0);
        assert.equal(culled.fallback.instanceCount, 0);
        assert.equal(culled.fallback.instanceBufferBytes, 228);

        geometry.dispose();
        material.dispose();
        texture.dispose();
    });
});
