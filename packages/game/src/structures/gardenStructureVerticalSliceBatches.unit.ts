import assert from 'node:assert/strict';
import test from 'node:test';
import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import { createWorstCaseGardenStructureCompileInput } from './benchmarkStructureCompiler';
import { compileGardenStructurePlan } from './compileGardenStructurePlan';
import { debugGardenStructureKitMetadata } from './debugStructureKit';
import { getGardenStructurePlanBaselineVisiblePropInstanceIds } from './gardenStructureSceneVisibility';
import {
    getGardenStructureVerticalSliceBatches,
    getGardenStructureVerticalSliceVisibleInstanceIndices,
} from './gardenStructureVerticalSliceBatches';
import type { GardenStructureSemanticPlan } from './structurePlanTypes';

function getVisiblePropIds({
    plan,
    renderProps,
    roofCutaway,
}: Readonly<{
    plan: GardenStructureSemanticPlan;
    renderProps: boolean;
    roofCutaway: boolean;
}>) {
    const baselineVisiblePropInstanceIds =
        getGardenStructurePlanBaselineVisiblePropInstanceIds(plan);
    return getGardenStructureVerticalSliceBatches({
        baselineVisiblePropInstanceIds,
        plan,
        renderProps,
        roofCutaway,
    })
        .filter((batch) => batch.category === 'props')
        .flatMap((batch) =>
            getGardenStructureVerticalSliceVisibleInstanceIndices({
                baselineVisiblePropInstanceIds,
                batch,
                renderProps,
            }).flatMap((index) => {
                const instanceId = batch.instanceIds[index];
                return instanceId === undefined ? [] : [instanceId];
            }),
        );
}

test('keeps open-door asset submissions while semantic collision is passable', () => {
    const plan = compileGardenStructurePlan({
        structureId: 'open-house',
        revision: 1,
        document: createGardenStructureTemplateSeed('house').document,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
    });
    const batches = getGardenStructureVerticalSliceBatches({
        plan,
        renderProps: false,
        roofCutaway: false,
    });
    const renderedIds = batches.flatMap((batch) => batch.instanceIds);

    assert.ok(plan.openPortals.edgeIds.includes('door-main'));
    assert.equal(renderedIds.includes('edge:open-house:door-main'), true);
    assert.ok(renderedIds.some((id) => id.startsWith('edge:open-house:')));
});

test('removes roof submissions only while cutaway is active', () => {
    const plan = compileGardenStructurePlan({
        structureId: 'roofed-house',
        revision: 1,
        document: createGardenStructureTemplateSeed('house').document,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
    });

    assert.ok(
        getGardenStructureVerticalSliceBatches({
            plan,
            renderProps: false,
            roofCutaway: false,
        }).some((batch) => batch.category === 'roof'),
    );
    assert.equal(
        getGardenStructureVerticalSliceBatches({
            plan,
            renderProps: false,
            roofCutaway: true,
        }).some((batch) => batch.category === 'roof'),
        false,
    );
});

test('keeps opaque interior props hidden until an explicit cutaway or inside view', () => {
    const plan = compileGardenStructurePlan({
        structureId: 'furnished-house',
        revision: 1,
        document: createGardenStructureTemplateSeed('house').document,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
    });

    assert.deepEqual(
        getVisiblePropIds({
            plan,
            renderProps: false,
            roofCutaway: false,
        }),
        [],
    );
    assert.deepEqual(
        getVisiblePropIds({
            plan,
            renderProps: true,
            roofCutaway: true,
        }),
        ['prop:furnished-house:prop-table'],
    );
});

test('filters opaque interiors and covered-outdoor props within one batch', () => {
    const house = createGardenStructureTemplateSeed('house');
    const plan = compileGardenStructurePlan({
        structureId: 'mixed-house',
        revision: 1,
        document: {
            ...house.document,
            props: [
                ...house.document.props,
                {
                    id: 'prop-porch-table',
                    partId: 'prop.table',
                    rotation: 0,
                    x: 1,
                    y: 3,
                },
            ],
        },
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
    });

    assert.deepEqual(
        getVisiblePropIds({
            plan,
            renderProps: false,
            roofCutaway: false,
        }),
        ['prop:mixed-house:prop-porch-table'],
    );
    assert.deepEqual(
        new Set(
            getVisiblePropIds({
                plan,
                renderProps: true,
                roofCutaway: true,
            }),
        ),
        new Set([
            'prop:mixed-house:prop-table',
            'prop:mixed-house:prop-porch-table',
        ]),
    );
});

test('keeps roofless and transparent-greenhouse props visible in normal mode', () => {
    const house = createGardenStructureTemplateSeed('house');
    const noRoofPlan = compileGardenStructurePlan({
        structureId: 'roofless-house',
        revision: 1,
        document: { ...house.document, roofRegions: [] },
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
    });
    const greenhouse = createGardenStructureTemplateSeed('greenhouse');
    const greenhousePlan = compileGardenStructurePlan({
        structureId: 'greenhouse',
        revision: 1,
        document: greenhouse.document,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
    });

    assert.deepEqual(
        getVisiblePropIds({
            plan: noRoofPlan,
            renderProps: false,
            roofCutaway: false,
        }),
        ['prop:roofless-house:prop-table'],
    );
    assert.equal(
        getVisiblePropIds({
            plan: greenhousePlan,
            renderProps: false,
            roofCutaway: false,
        }).length,
        2,
    );
});

test('admits only the 34 transparent-roof props in the normal worst-case fixture', () => {
    const plan = compileGardenStructurePlan(
        createWorstCaseGardenStructureCompileInput(),
    );

    assert.equal(
        getVisiblePropIds({
            plan,
            renderProps: false,
            roofCutaway: false,
        }).length,
        34,
    );
    assert.equal(
        getVisiblePropIds({
            plan,
            renderProps: true,
            roofCutaway: true,
        }).length,
        100,
    );
});

test('rejects a plan from a different immutable kit before visual semantics can drift', () => {
    const plan = compileGardenStructurePlan({
        structureId: 'other-kit-house',
        revision: 1,
        document: createGardenStructureTemplateSeed('house').document,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        kit: Object.freeze({
            ...debugGardenStructureKitMetadata,
            kitKey: 'other-kit',
        }),
    });

    assert.throws(
        () =>
            getGardenStructureVerticalSliceBatches({
                plan,
                renderProps: false,
                roofCutaway: false,
            }),
        /matching immutable debug kit/u,
    );
});

test('rejects same-identity metadata drift before fixture geometry can diverge', () => {
    const table = debugGardenStructureKitMetadata.propParts['prop.table'];
    assert.ok(table);
    const driftedKit = Object.freeze({
        ...debugGardenStructureKitMetadata,
        propParts: Object.freeze({
            ...debugGardenStructureKitMetadata.propParts,
            'prop.table': Object.freeze({
                ...table,
                collisionWidth: 0.7,
            }),
        }),
    });
    const plan = compileGardenStructurePlan({
        structureId: 'same-identity-drift',
        revision: 1,
        document: createGardenStructureTemplateSeed('house').document,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        kit: driftedKit,
    });

    assert.equal(plan.runtimeSafety.collisionMode, 'semantic');
    assert.equal(plan.kitKey, debugGardenStructureKitMetadata.kitKey);
    assert.equal(plan.kitVersion, debugGardenStructureKitMetadata.kitVersion);
    assert.throws(
        () =>
            getGardenStructureVerticalSliceBatches({
                plan,
                renderProps: false,
                roofCutaway: false,
            }),
        /matching immutable debug kit/u,
    );
});
