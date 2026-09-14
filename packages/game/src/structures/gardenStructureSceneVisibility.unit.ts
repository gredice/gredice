import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import { Frustum, Matrix4 } from 'three';
import { compileSavedGardenStructureCollection } from './gardenStructureCollectionPlan';
import {
    getGardenStructureBaselineVisiblePropInstanceIds,
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
                undefined,
            );
            assert.ok(
                indices.every(
                    (index) => batch.structureIds[index] === 'near-house',
                ),
            );
        }
    });

    test('keeps exterior-visible props while opaque interiors require avatar admission', () => {
        const house = createGardenStructureTemplateSeed('house');
        const greenhouse = createGardenStructureTemplateSeed('greenhouse');
        const coveredOutdoorHouse = {
            ...savedHouse('covered-outdoor-house', 8),
            document: {
                ...house.document,
                props: [
                    {
                        id: 'prop-table',
                        partId: 'prop.table',
                        rotation: 0,
                        x: 1,
                        y: 3,
                    },
                ],
            },
        };
        const noRoofHouse = {
            ...savedHouse('no-roof-house', 16),
            document: { ...house.document, roofRegions: [] },
        };
        const transparentGreenhouse = {
            ...savedHouse('transparent-greenhouse', 24),
            document: greenhouse.document,
            templateKey: 'greenhouse',
        };
        const { plan } = compileSavedGardenStructureCollection([
            savedHouse('opaque-house', 0),
            coveredOutdoorHouse,
            noRoofHouse,
            transparentGreenhouse,
        ]);
        const baselineVisiblePropInstanceIds =
            getGardenStructureBaselineVisiblePropInstanceIds(plan);

        assert.equal(
            baselineVisiblePropInstanceIds.has('prop:opaque-house:prop-table'),
            false,
        );
        assert.equal(
            baselineVisiblePropInstanceIds.has(
                'prop:covered-outdoor-house:prop-table',
            ),
            true,
        );
        assert.equal(
            baselineVisiblePropInstanceIds.has('prop:no-roof-house:prop-table'),
            true,
        );
        assert.equal(
            baselineVisiblePropInstanceIds.has(
                'prop:transparent-greenhouse:prop-planter-west',
            ),
            true,
        );
        assert.equal(
            baselineVisiblePropInstanceIds.has(
                'prop:transparent-greenhouse:prop-planter-east',
            ),
            true,
        );

        const visibleStructureIds = new Set(
            plan.structures.map(({ structureId }) => structureId),
        );
        const baselineIndices = plan.batches.props.flatMap((batch) =>
            getGardenStructureCollectionVisibleInstanceIndices(
                batch,
                visibleStructureIds,
                baselineVisiblePropInstanceIds,
                new Set(),
            ).map((index) => batch.instanceIds[index]),
        );
        assert.deepEqual(
            new Set(baselineIndices),
            baselineVisiblePropInstanceIds,
        );

        const baselineMetrics = getGardenStructureSceneSubmissionMetrics({
            plan,
            baselineVisiblePropInstanceIds,
            renderProps: true,
            visibleInteriorStructureIds: new Set(),
            visibleStructureIds,
        });
        assert.equal(baselineMetrics.propCount, 5);
        assert.equal(baselineMetrics.visiblePropCount, 4);
        assert.equal(baselineMetrics.exteriorSuppressedPropCount, 1);
        assert.equal(baselineMetrics.frustumCulledPropCount, 0);

        const admittedStructureIds = new Set(['opaque-house']);
        const admittedIndices = plan.batches.props.flatMap((batch) =>
            getGardenStructureCollectionVisibleInstanceIndices(
                batch,
                visibleStructureIds,
                baselineVisiblePropInstanceIds,
                admittedStructureIds,
            ).map((index) => batch.instanceIds[index]),
        );
        assert.equal(admittedIndices.length, 5);
        assert.ok(admittedIndices.includes('prop:opaque-house:prop-table'));

        const metrics = getGardenStructureSceneSubmissionMetrics({
            plan,
            baselineVisiblePropInstanceIds,
            renderProps: true,
            visibleInteriorStructureIds: admittedStructureIds,
            visibleStructureIds,
        });
        assert.equal(metrics.propCount, 5);
        assert.equal(metrics.visiblePropCount, 5);
        assert.equal(metrics.exteriorSuppressedPropCount, 0);
        assert.equal(metrics.frustumCulledPropCount, 0);
    });

    test('suppresses closed-roof exterior props and admits only explicit interior structures', () => {
        const { plan } = compileSavedGardenStructureCollection([
            savedHouse('inside-house', 0),
            savedHouse('outside-house', 8),
        ]);
        const visibleStructureIds = new Set(['inside-house', 'outside-house']);
        const visibleInteriorStructureIds = new Set(['inside-house']);
        const baselineVisiblePropInstanceIds =
            getGardenStructureBaselineVisiblePropInstanceIds(plan);

        const metrics = getGardenStructureSceneSubmissionMetrics({
            plan,
            baselineVisiblePropInstanceIds,
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
                        baselineVisiblePropInstanceIds,
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
        const baselineVisiblePropInstanceIds =
            getGardenStructureBaselineVisiblePropInstanceIds(plan);

        const metrics = getGardenStructureSceneSubmissionMetrics({
            plan,
            baselineVisiblePropInstanceIds,
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
