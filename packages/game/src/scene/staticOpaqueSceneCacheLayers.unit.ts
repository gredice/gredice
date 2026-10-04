import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BoxGeometry,
    Group,
    type Material,
    Mesh,
    MeshStandardMaterial,
    Scene,
    ShaderMaterial,
} from 'three';
import {
    countBoundaryLayerChanges,
    resolveLayerState,
    type StaticOpaqueSceneCacheGroup,
    StaticOpaqueSceneCacheRegistry,
} from './StaticOpaqueSceneCache';

function createBoundary(group: StaticOpaqueSceneCacheGroup, scene: Scene) {
    const root = new Group();
    const mesh = new Mesh<BoxGeometry, Material>(
        new BoxGeometry(),
        new MeshStandardMaterial(),
    );
    root.add(mesh);
    scene.add(root);
    return {
        entry: {
            contentKey: mesh.uuid,
            group,
            instanceCount: 1,
            root,
            submissionCount: 1,
            triangleCount: 12,
        },
        mesh,
    };
}

function createLayeredScene() {
    let invalidations = 0;
    const registry = new StaticOpaqueSceneCacheRegistry(() => {
        invalidations += 1;
    });
    const scene = new Scene();
    const terrain = createBoundary('base-terrain', scene);
    const props = createBoundary('static-props', scene);
    registry.setBoundary(Symbol('terrain'), terrain.entry);
    registry.setBoundary(Symbol('props'), props.entry);
    return {
        invalidations: () => invalidations,
        props,
        registry,
        terrain,
    };
}

describe('layered static opaque scene cache', () => {
    it('caches every eligible layer', () => {
        const { registry } = createLayeredScene();
        const snapshot = registry.getSnapshot();
        assert.equal(snapshot.boundaries.length, 2);
        assert.equal(snapshot.liveBoundaries.length, 0);
        assert.equal(
            resolveLayerState(
                'base-terrain',
                snapshot.boundaries,
                snapshot.liveBoundaries,
                true,
            ),
            'cached',
        );
        assert.deepEqual(
            countBoundaryLayerChanges(
                snapshot.boundaries,
                snapshot.liveBoundaries,
            ),
            { becameCached: 0, becameLive: 0 },
        );
    });

    it('moves only the layer whose material stops being cacheable', () => {
        const { invalidations, props, registry, terrain } =
            createLayeredScene();
        const cachedMaterial = terrain.mesh.material;
        // Integrated rain, snow, and frost surfaces swap base ground to a
        // custom shader material, which the cache cannot replay.
        terrain.mesh.material = new ShaderMaterial();

        const before = registry.getSnapshot();
        assert.deepEqual(
            countBoundaryLayerChanges(before.boundaries, before.liveBoundaries),
            { becameCached: 0, becameLive: 1 },
        );

        const invalidationsBefore = invalidations();
        registry.invalidate('layer-change');
        const during = registry.getSnapshot();
        assert.equal(invalidations(), invalidationsBefore + 1);
        assert.equal(during.lastInvalidationReason, 'layer-change');
        assert.deepEqual(
            during.boundaries.map((boundary) => boundary.root),
            [props.entry.root],
        );
        assert.deepEqual(
            during.liveBoundaries.map((boundary) => boundary.root),
            [terrain.entry.root],
        );
        assert.equal(
            resolveLayerState(
                'base-terrain',
                during.boundaries,
                during.liveBoundaries,
                true,
            ),
            'live',
        );
        assert.equal(
            resolveLayerState(
                'static-props',
                during.boundaries,
                during.liveBoundaries,
                true,
            ),
            'cached',
        );
        assert.deepEqual(
            countBoundaryLayerChanges(during.boundaries, during.liveBoundaries),
            { becameCached: 0, becameLive: 0 },
        );

        terrain.mesh.material = cachedMaterial;
        assert.deepEqual(
            countBoundaryLayerChanges(during.boundaries, during.liveBoundaries),
            { becameCached: 1, becameLive: 0 },
        );
        registry.invalidate('layer-change');
        const after = registry.getSnapshot();
        assert.equal(after.boundaries.length, 2);
        assert.equal(after.liveBoundaries.length, 0);
    });

    it('reports split, live, and absent layers', () => {
        const { registry, terrain } = createLayeredScene();
        const scene = terrain.entry.root.parent;
        assert.ok(scene instanceof Scene);
        const liveTerrain = createBoundary('base-terrain', scene);
        liveTerrain.mesh.material = new MeshStandardMaterial({
            opacity: 0.5,
            transparent: true,
        });
        registry.setBoundary(Symbol('live-terrain'), liveTerrain.entry);

        const snapshot = registry.getSnapshot();
        assert.equal(
            resolveLayerState(
                'base-terrain',
                snapshot.boundaries,
                snapshot.liveBoundaries,
                true,
            ),
            'mixed',
        );
        assert.equal(
            resolveLayerState(
                'base-terrain',
                snapshot.boundaries,
                snapshot.liveBoundaries,
                false,
            ),
            'live',
        );
        assert.equal(resolveLayerState('static-props', [], [], true), 'absent');
    });

    it('ignores live boundaries that were unmounted', () => {
        const { registry, terrain } = createLayeredScene();
        terrain.mesh.material = new ShaderMaterial();
        registry.invalidate('layer-change');
        terrain.entry.root.removeFromParent();
        terrain.mesh.material = new MeshStandardMaterial();

        const snapshot = registry.getSnapshot();
        assert.deepEqual(
            countBoundaryLayerChanges(
                snapshot.boundaries,
                snapshot.liveBoundaries,
            ),
            { becameCached: 0, becameLive: 0 },
        );
    });
});
