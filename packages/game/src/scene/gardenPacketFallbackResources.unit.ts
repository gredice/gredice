import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BoxGeometry,
    Float32BufferAttribute,
    MeshStandardMaterial,
    Scene,
} from 'three';
import { readSharedGardenMaterialMetrics } from './gardenMaterials';
import { acquireGardenPacketFallbackResources as acquireInRoot } from './gardenPacketFallbackResources';
import { createWeatherSurfaceGeometry } from './weatherSurfaceGeometry';

const root = new Scene();
function acquireGardenPacketFallbackResources(
    geometry: Parameters<typeof acquireInRoot>[0],
    material: Parameters<typeof acquireInRoot>[1],
) {
    return acquireInRoot(geometry, material, root);
}

describe('paired transient stock fallback ownership', () => {
    it('copies all vertex/index/weather inputs and retains exact groups, draw range and bounds', () => {
        const source = createWeatherSurfaceGeometry(new BoxGeometry(), {
            includeSnowSkirts: true,
        });
        source.setAttribute(
            'color',
            new Float32BufferAttribute(
                new Float32Array(
                    source.getAttribute('position').count * 3,
                ).fill(0.7),
                3,
            ),
        );
        source.computeBoundingBox();
        source.computeBoundingSphere();
        const lease = acquireGardenPacketFallbackResources(
            source,
            new MeshStandardMaterial(),
        );
        assert.ok(lease);
        assert.notEqual(lease.geometry, source);
        assert.notEqual(lease.geometry.index?.array, source.index?.array);
        assert.deepEqual(lease.geometry.index?.array, source.index?.array);
        for (const [name, attribute] of Object.entries(source.attributes)) {
            const cloned: ReturnType<typeof lease.geometry.getAttribute> =
                lease.geometry.getAttribute(name);
            assert.notEqual(cloned, attribute);
            assert.notEqual(cloned.array, attribute.array);
            assert.deepEqual(cloned.array, attribute.array);
            assert.equal(cloned.itemSize, attribute.itemSize);
            assert.equal(cloned.normalized, attribute.normalized);
        }
        assert.deepEqual(lease.geometry.groups, source.groups);
        assert.deepEqual(lease.geometry.drawRange, source.drawRange);
        assert.deepEqual(lease.geometry.boundingBox, source.boundingBox);
        assert.deepEqual(lease.geometry.boundingSphere, source.boundingSphere);
        lease.release();
    });

    it('shares one geometry clone across independent pending material sources and disposes after the last user', () => {
        const geometry = new BoxGeometry();
        const firstMaterial = new MeshStandardMaterial({ color: '#3273bc' });
        const secondMaterial = new MeshStandardMaterial({ color: '#bc7332' });
        let borrowedDisposals = 0;
        for (const resource of [geometry, firstMaterial, secondMaterial])
            resource.addEventListener('dispose', () => borrowedDisposals++);
        const first = acquireGardenPacketFallbackResources(
            geometry,
            firstMaterial,
        );
        const second = acquireGardenPacketFallbackResources(
            geometry,
            secondMaterial,
        );
        assert.ok(first && second);
        assert.equal(first.geometry, second.geometry);
        assert.notEqual(first.material, second.material);
        let clonedGeometryDisposals = 0;
        first.geometry.addEventListener(
            'dispose',
            () => clonedGeometryDisposals++,
        );
        first.release();
        first.release();
        assert.equal(clonedGeometryDisposals, 0);
        assert.equal(borrowedDisposals, 0);
        second.release();
        second.release();
        assert.equal(clonedGeometryDisposals, 1);
        assert.equal(borrowedDisposals, 0);
    });

    it('reacquires fresh buffers and shaders after final release or source-object replacement', () => {
        const geometry = new BoxGeometry();
        const material = new MeshStandardMaterial();
        const first = acquireGardenPacketFallbackResources(geometry, material);
        assert.ok(first);
        first.release();
        const remounted = acquireGardenPacketFallbackResources(
            geometry,
            material,
        );
        assert.ok(remounted);
        assert.notEqual(remounted.geometry, first.geometry);
        assert.notEqual(remounted.material, first.material);
        const replacement = acquireGardenPacketFallbackResources(
            new BoxGeometry(2, 1, 1),
            material,
        );
        assert.ok(replacement);
        assert.notEqual(replacement.geometry, remounted.geometry);
        assert.equal(replacement.material, remounted.material);
        replacement.release();
        remounted.release();
    });

    it('keeps cloned arrays independent from borrowed inputs', () => {
        const geometry = new BoxGeometry();
        const lease = acquireGardenPacketFallbackResources(
            geometry,
            new MeshStandardMaterial(),
        );
        assert.ok(lease);
        const originalX = geometry.getAttribute('position').getX(0);
        lease.geometry.getAttribute('position').setX(0, originalX + 10);
        assert.equal(geometry.getAttribute('position').getX(0), originalX);
        lease.release();
    });

    it('does not clone unsupported geometry/material paths', () => {
        const geometry = new BoxGeometry();
        geometry.clone = () => {
            throw new Error('Unsupported source must not be cloned.');
        };
        const unknown = new MeshStandardMaterial();
        unknown.onBeforeCompile = () => {};
        assert.equal(
            acquireGardenPacketFallbackResources(geometry, unknown),
            undefined,
        );
    });

    it('releases the committed shader lease when geometry cloning fails', () => {
        const geometry = new BoxGeometry();
        geometry.clone = () => {
            throw new Error('Injected clone failure.');
        };
        const before = readSharedGardenMaterialMetrics();
        assert.throws(
            () =>
                acquireGardenPacketFallbackResources(
                    geometry,
                    new MeshStandardMaterial(),
                ),
            /Injected clone failure/,
        );
        assert.deepEqual(readSharedGardenMaterialMetrics(), before);
    });
});
