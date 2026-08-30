import assert from 'node:assert/strict';
import test from 'node:test';
import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import { compileGardenStructurePlan } from './compileGardenStructurePlan';
import { getGardenStructureSelectablePartIds } from './gardenStructureSelectableParts';

test('offers every semantic category through the accessible DOM selector', () => {
    const plan = compileGardenStructurePlan({
        structureId: 'selectable-house',
        revision: 1,
        document: createGardenStructureTemplateSeed('house').document,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
    });

    const footprint = getGardenStructureSelectablePartIds(plan, 'footprint');
    const structure = getGardenStructureSelectablePartIds(plan, 'structure');
    const roof = getGardenStructureSelectablePartIds(plan, 'roof');
    const interior = getGardenStructureSelectablePartIds(plan, 'interior');

    assert.ok(footprint.includes('footprint:selectable-house:0|3'));
    assert.equal(footprint.includes('floor:selectable-house:0|3'), false);
    assert.ok(structure.includes('edge:selectable-house:door-main'));
    assert.ok(structure.includes('edge:selectable-house:partition-door'));
    assert.ok(roof.some((id) => id.startsWith('roof:selectable-house:')));
    assert.deepEqual(interior, ['prop:selectable-house:prop-table']);
});
