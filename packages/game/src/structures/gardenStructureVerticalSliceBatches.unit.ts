import assert from 'node:assert/strict';
import test from 'node:test';
import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import { compileGardenStructurePlan } from './compileGardenStructurePlan';
import { debugGardenStructureKitMetadata } from './debugStructureKit';
import { getGardenStructureVerticalSliceBatches } from './gardenStructureVerticalSliceBatches';

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

test('submits interior props only for an explicit cutaway or inside view', () => {
    const plan = compileGardenStructurePlan({
        structureId: 'furnished-house',
        revision: 1,
        document: createGardenStructureTemplateSeed('house').document,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
    });

    assert.equal(
        getGardenStructureVerticalSliceBatches({
            plan,
            renderProps: false,
            roofCutaway: false,
        }).some((batch) => batch.category === 'props'),
        false,
    );
    assert.equal(
        getGardenStructureVerticalSliceBatches({
            plan,
            renderProps: true,
            roofCutaway: true,
        }).some((batch) => batch.category === 'props'),
        true,
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
