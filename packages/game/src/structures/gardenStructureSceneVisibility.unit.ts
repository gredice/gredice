import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import { Frustum, Matrix4 } from 'three';
import { compileSavedGardenStructureCollection } from './gardenStructureCollectionPlan';
import {
    getGardenStructureCollectionVisibleBatches,
    getGardenStructureCollectionVisibleInstanceIndices,
    getGardenStructureFrustumVisibleIds,
    getGardenStructureSceneSubmissionMetrics,
} from './gardenStructureSceneVisibility';

function savedHouse(id: string, anchorX: number) {
    const seed = createGardenStructureTemplateSeed('house');
    return {
        anchorX,
        anchorY: 0,
        document: seed.document,
        id,
        isDeleted: false,
        kitKey: seed.kitKey,
        kitVersion: seed.kitVersion,
        revision: 1,
        rotation: 0,
        templateKey: seed.templateKey,
    };
}

describe('garden structure scene visibility', () => {
    test('rejects whole structures outside the camera frustum before batch submission', () => {
        const { plan } = compileSavedGardenStructureCollection([
            savedHouse('near-house', 0),
            savedHouse('far-house', 50),
        ]);
        const frustum = new Frustum().setFromProjectionMatrix(new Matrix4());

        const visibleIds = getGardenStructureFrustumVisibleIds(plan, frustum);
        const allBatches = [
            ...plan.batches.opaque,
            ...plan.batches.transparent,
            ...plan.batches.roof,
            ...plan.batches.props,
        ];
        const visibleBatches = getGardenStructureCollectionVisibleBatches(
            allBatches,
            visibleIds,
            undefined,
        );

        assert.deepEqual([...visibleIds], ['near-house']);
        assert.ok(visibleBatches.length < allBatches.length);
        assert.ok(
            visibleBatches.every((batch) =>
                batch.structureIds.includes('near-house'),
            ),
        );
        assert.ok(
            visibleBatches.every(
                (batch) => !batch.structureIds.includes('far-house'),
            ),
        );
        for (const batch of visibleBatches) {
            const indices = getGardenStructureCollectionVisibleInstanceIndices(
                batch,
                visibleIds,
                undefined,
            );
            assert.ok(
                indices.every(
                    (index) => batch.structureIds[index] === 'near-house',
                ),
            );
        }
    });

    test('suppresses closed-roof exterior props and admits only explicit interior structures', () => {
        const { plan } = compileSavedGardenStructureCollection([
            savedHouse('inside-house', 0),
            savedHouse('outside-house', 8),
        ]);
        const visibleStructureIds = new Set(['inside-house', 'outside-house']);
        const visibleInteriorStructureIds = new Set(['inside-house']);

        const metrics = getGardenStructureSceneSubmissionMetrics({
            plan,
            renderProps: true,
            visibleInteriorStructureIds,
            visibleStructureIds,
        });

        assert.equal(metrics.propCount, 2);
        assert.equal(metrics.visiblePropCount, 1);
        assert.equal(metrics.detailSuppressedPropCount, 0);
        assert.equal(metrics.exteriorSuppressedPropCount, 1);
        assert.equal(metrics.frustumCulledPropCount, 0);
        assert.equal(metrics.frustumCulledStructureCount, 0);
        assert.equal(
            plan.batches.props.reduce(
                (total, batch) =>
                    total +
                    getGardenStructureCollectionVisibleInstanceIndices(
                        batch,
                        visibleStructureIds,
                        visibleInteriorStructureIds,
                    ).length,
                0,
            ),
            1,
        );
    });

    test('reports frustum and detail suppression separately from exterior suppression', () => {
        const { plan } = compileSavedGardenStructureCollection([
            savedHouse('visible-house', 0),
            savedHouse('culled-house', 8),
        ]);

        const metrics = getGardenStructureSceneSubmissionMetrics({
            plan,
            renderProps: false,
            visibleInteriorStructureIds: new Set(['visible-house']),
            visibleStructureIds: new Set(['visible-house']),
        });

        assert.equal(metrics.propCount, 2);
        assert.equal(metrics.visiblePropCount, 0);
        assert.equal(metrics.detailSuppressedPropCount, 1);
        assert.equal(metrics.exteriorSuppressedPropCount, 0);
        assert.equal(metrics.frustumCulledPropCount, 1);
        assert.equal(metrics.frustumCulledStructureCount, 1);
    });
});
