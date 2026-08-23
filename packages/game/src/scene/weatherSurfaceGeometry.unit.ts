import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { createMergedChunkGeometry } from '../entities/chunkedMeshGeometry';
import { createSnowOverlayGeometry } from '../snow/createSnowOverlayGeometry';
import {
    countGeometryTriangles,
    createWeatherSurfaceGeometry,
    getWeatherSurfaceGeometryMetadata,
    getWeatherSurfaceGeometryTriangleStats,
    isWeatherSurfaceGeometry,
    WEATHER_SURFACE_ATTRIBUTE_NAMES,
    WEATHER_SURFACE_BASE,
    WEATHER_SURFACE_SKIRT,
} from './weatherSurfaceGeometry';

const indexedQuadIndices = [0, 2, 1, 0, 3, 2];
const quadPositions = [-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1];
const quadNormals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];

function createIndexedQuad() {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new Float32BufferAttribute(quadPositions, 3),
    );
    geometry.setAttribute('normal', new Float32BufferAttribute(quadNormals, 3));
    geometry.setAttribute(
        'uv',
        new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
    );
    geometry.setIndex(indexedQuadIndices);
    return geometry;
}

function createNonIndexedQuad() {
    const geometry = new BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    for (const index of indexedQuadIndices) {
        positions.push(
            quadPositions[index * 3],
            quadPositions[index * 3 + 1],
            quadPositions[index * 3 + 2],
        );
        normals.push(0, 1, 0);
    }
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    return geometry;
}

describe('createWeatherSurfaceGeometry', () => {
    it('retains indexed base triangles once and appends only boundary skirts', () => {
        const source = createIndexedQuad();
        const prepared = createWeatherSurfaceGeometry(source);
        const metadata = getWeatherSurfaceGeometryMetadata(prepared);

        assert.ok(metadata);
        assert.equal(metadata.sourceTriangleCount, 2);
        assert.equal(metadata.boundaryEdgeCount, 4);
        assert.equal(metadata.includesSnowSkirts, true);
        assert.equal(metadata.skirtTriangleCount, 8);
        assert.equal(metadata.preparedTriangleCount, 10);
        assert.equal(metadata.sourceVertexCount, 4);
        assert.equal(metadata.appendedVertexCount, 16);
        assert.deepEqual(metadata.sourceBounds, {
            min: [-1, 0, -1],
            max: [1, 0, 1],
        });
        assert.equal(metadata.sourceTopY, 0);
        assert.deepEqual(
            Array.from(prepared.getIndex()?.array ?? []).slice(0, 6),
            indexedQuadIndices,
        );
        assert.equal(prepared.getAttribute('position').count, 20);
        assert.equal(countGeometryTriangles(prepared), 10);
        assert.equal(isWeatherSurfaceGeometry(prepared), true);
    });

    it('welds a non-indexed coplanar diagonal instead of generating an internal skirt', () => {
        const source = createNonIndexedQuad();
        const prepared = createWeatherSurfaceGeometry(source);
        const metadata = getWeatherSurfaceGeometryMetadata(prepared);

        assert.ok(metadata);
        assert.equal(metadata.sourceTriangleCount, 2);
        assert.equal(metadata.boundaryEdgeCount, 4);
        assert.equal(metadata.skirtTriangleCount, 8);
        assert.equal(metadata.preparedTriangleCount, 10);
        assert.deepEqual(
            Array.from(prepared.getIndex()?.array ?? []).slice(0, 6),
            [0, 1, 2, 3, 4, 5],
        );
    });

    it('prepares a base-only weather geometry when snow skirts are inactive', () => {
        const source = createIndexedQuad();
        const prepared = createWeatherSurfaceGeometry(source, {
            includeSnowSkirts: false,
        });
        const skirted = createWeatherSurfaceGeometry(source);
        const metadata = getWeatherSurfaceGeometryMetadata(prepared);

        assert.ok(metadata);
        assert.equal(metadata.includesSnowSkirts, false);
        assert.equal(metadata.boundaryEdgeCount, 0);
        assert.equal(metadata.skirtTriangleCount, 0);
        assert.equal(metadata.appendedVertexCount, 0);
        assert.equal(metadata.sourceTriangleCount, 2);
        assert.equal(metadata.preparedTriangleCount, 2);
        assert.equal(prepared.getAttribute('position').count, 4);
        assert.equal(countGeometryTriangles(prepared), 2);
        assert.notEqual(prepared, skirted);
        assert.equal(
            createWeatherSurfaceGeometry(source, {
                includeSnowSkirts: false,
            }),
            prepared,
        );
    });

    it('adds compact shader attributes for base and skirt vertices', () => {
        const source = createIndexedQuad();
        const prepared = createWeatherSurfaceGeometry(source);
        const localPosition = prepared.getAttribute(
            WEATHER_SURFACE_ATTRIBUTE_NAMES.localPosition,
        );
        const snowLayer = prepared.getAttribute(
            WEATHER_SURFACE_ATTRIBUTE_NAMES.snowLayer,
        );
        const snowTopDistance = prepared.getAttribute(
            WEATHER_SURFACE_ATTRIBUTE_NAMES.snowTopDistance,
        );
        const surface = prepared.getAttribute(
            WEATHER_SURFACE_ATTRIBUTE_NAMES.surface,
        );

        assert.equal(localPosition.count, 20);
        assert.equal(snowLayer.count, 20);
        assert.equal(snowTopDistance.count, 20);
        assert.equal(surface.count, 20);
        assert.deepEqual(
            Array.from(surface.array).slice(0, 4),
            new Array(4).fill(WEATHER_SURFACE_BASE),
        );
        assert.deepEqual(
            Array.from(surface.array).slice(4),
            new Array(16).fill(WEATHER_SURFACE_SKIRT),
        );
        for (let offset = 4; offset < snowLayer.count; offset += 4) {
            assert.deepEqual(
                Array.from(snowLayer.array).slice(offset, offset + 4),
                [1, 1, 0, 0],
            );
        }
        assert.deepEqual(
            Array.from(snowTopDistance.array),
            new Array(20).fill(0),
        );
        assert.deepEqual(
            Array.from(localPosition.array).slice(0, 12),
            quadPositions,
        );
    });

    it('stores nonnegative source-local distance from the source top', () => {
        const source = new BufferGeometry();
        source.setAttribute(
            'position',
            new Float32BufferAttribute([0, 2, 0, 1, -1, 0, 0, 0.5, 1], 3),
        );
        source.setIndex([0, 1, 2]);

        const prepared = createWeatherSurfaceGeometry(source);
        const distance = prepared.getAttribute(
            WEATHER_SURFACE_ATTRIBUTE_NAMES.snowTopDistance,
        );
        const metadata = getWeatherSurfaceGeometryMetadata(prepared);

        assert.ok(metadata);
        assert.equal(metadata.sourceTopY, 2);
        assert.deepEqual(Array.from(distance.array).slice(0, 3), [0, 3, 1.5]);
        assert.ok(Array.from(distance.array).every((value) => value >= 0));
    });

    it('caches by source identity without sharing, mutating, or disposing source buffers', () => {
        const source = createIndexedQuad();
        source.userData = { owner: 'source' };
        const sourcePosition = source.getAttribute('position');
        const sourceIndex = source.getIndex();
        const positionSnapshot = Array.from(sourcePosition.array);
        const indexSnapshot = Array.from(sourceIndex?.array ?? []);
        let sourceDisposeCount = 0;
        source.addEventListener('dispose', () => {
            sourceDisposeCount += 1;
        });

        const first = createWeatherSurfaceGeometry(source);
        const second = createWeatherSurfaceGeometry(source);

        assert.equal(first, second);
        assert.notEqual(first, source);
        assert.notEqual(
            first.getAttribute('position').array,
            sourcePosition.array,
        );
        assert.notEqual(first.getIndex()?.array, sourceIndex?.array);
        assert.deepEqual(Array.from(sourcePosition.array), positionSnapshot);
        assert.deepEqual(Array.from(sourceIndex?.array ?? []), indexSnapshot);
        assert.equal(source.getAttribute('aSnowLayer'), undefined);
        assert.equal(source.boundingBox, null);
        assert.deepEqual(source.userData, { owner: 'source' });
        assert.equal(sourceDisposeCount, 0);
    });

    it('accounts exactly for the base replay avoided versus the legacy overlay', () => {
        const source = createIndexedQuad();
        const legacyOverlay = createSnowOverlayGeometry(source);
        const prepared = createWeatherSurfaceGeometry(source);
        const stats = getWeatherSurfaceGeometryTriangleStats(prepared);
        const legacySeparatePassTriangles =
            countGeometryTriangles(source) +
            countGeometryTriangles(legacyOverlay);

        assert.deepEqual(stats, {
            avoidedTriangleCount: 2,
            baseTriangleCount: 2,
            separatePassTriangleCount: 12,
            singlePassTriangleCount: 10,
            skirtTriangleCount: 8,
        });
        assert.equal(
            stats.separatePassTriangleCount,
            legacySeparatePassTriangles,
        );
        assert.equal(
            legacySeparatePassTriangles - stats.singlePassTriangleCount,
            stats.avoidedTriangleCount,
        );
    });

    it('keeps legacy source-local snow-noise coordinates across merged tiles', () => {
        const source = createIndexedQuad();
        const prepared = createWeatherSurfaceGeometry(source);
        const merged = createMergedChunkGeometry({
            geometry: prepared,
            instances: [
                { position: [0, 0, 0], rotation: 0 },
                { position: [10, 3, -2], rotation: 0 },
            ],
            localTransform: {
                position: [0, 0, 0],
                rotation: [0, 0, 0],
            },
            scale: 1,
        });

        assert.equal(countGeometryTriangles(merged), 20);
        for (const name of Object.values(WEATHER_SURFACE_ATTRIBUTE_NAMES)) {
            assert.equal(merged.getAttribute(name).count, 40);
        }

        const position = merged.getAttribute('position');
        const localPosition = merged.getAttribute(
            WEATHER_SURFACE_ATTRIBUTE_NAMES.localPosition,
        );
        const snowTopDistance = merged.getAttribute(
            WEATHER_SURFACE_ATTRIBUTE_NAMES.snowTopDistance,
        );
        const preparedPosition = prepared.getAttribute('position');
        const localPositionValues = Array.from(localPosition.array);
        assert.deepEqual(
            localPositionValues.slice(0, 20 * 3),
            localPositionValues.slice(20 * 3, 40 * 3),
            'each baked tile must retain the source-local noise coordinate sampled by the legacy instanced overlay',
        );
        assert.equal(position.getX(20), preparedPosition.getX(0) + 10);
        assert.equal(position.getY(20), preparedPosition.getY(0) + 3);
        assert.equal(position.getZ(20), preparedPosition.getZ(0) - 2);
        assert.equal(
            snowTopDistance.getX(20),
            prepared
                .getAttribute(WEATHER_SURFACE_ATTRIBUTE_NAMES.snowTopDistance)
                .getX(0),
        );
    });
});
