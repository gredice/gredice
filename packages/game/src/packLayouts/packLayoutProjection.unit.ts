import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getGardenPackLayoutCells,
    resolveGardenPackLayoutPlacements,
} from '@gredice/js/gardenPackLayouts';
import {
    createPackLayoutFixtureBlocks,
    createPackLayoutFixtureGarden,
    createPackLayoutFixtureLayout,
    createPackLayoutFixturePack,
} from '../../tests/ownedPackLayoutFixture';
import { packLayoutGardenSignature } from './packLayoutPreviewState';
import {
    getPackLayoutQuantities,
    resolveOwnedPackLayout,
} from './packLayoutProjection';

function fixture() {
    const blockData = createPackLayoutFixtureBlocks();
    const pack = createPackLayoutFixturePack(blockData);
    return {
        blockData,
        pack,
        layout: createPackLayoutFixtureLayout(pack),
        garden: createPackLayoutFixtureGarden(),
        anchor: { x: 0, y: 0 },
    };
}
for (const rotation of [0, 1, 2, 3] as const)
    test(`turn ${rotation}: exact five cells, supported multi-cell footprints and free prepaid units`, () => {
        const input = fixture();
        const before = JSON.stringify(input);
        const result = resolveOwnedPackLayout({ ...input, rotation });
        assert.equal(result.valid, true, result.error ?? undefined);
        assert.equal(result.placements.length, 4);
        assert.equal(result.units.length, 4);
        assert.equal(
            getGardenPackLayoutCells(
                resolveGardenPackLayoutPlacements(
                    input.layout,
                    input.anchor,
                    rotation,
                ),
            ).length,
            5,
        );
        assert.deepEqual(
            result.placements[0]?.footprint,
            rotation % 2 ? { width: 1, depth: 2 } : { width: 2, depth: 1 },
        );
        assert.equal(JSON.stringify(input), before);
    });
test('collision and missing quantity keep the whole renderable group and consume nothing', () => {
    const input = fixture();
    input.garden.stacks
        .find((stack) => stack.position.x === 0 && stack.position.z === 0)
        ?.blocks.push({ id: 'existing-rake', name: 'LeafRake', rotation: 0 });
    const before = JSON.stringify(input);
    const collision = resolveOwnedPackLayout({ ...input, rotation: 0 });
    assert.equal(collision.valid, false);
    assert.equal(collision.placements.length, 4);
    input.layout.availableUnits = [];
    const missing = resolveOwnedPackLayout({ ...input, rotation: 0 });
    assert.equal(missing.valid, false);
    assert.equal(missing.placements.length, 4);
    assert.match(missing.error ?? '', /dovoljno/);
    assert.equal(getPackLayoutQuantities(input.layout)[0]?.available, 0);
    input.layout.availableUnits = fixture().layout.availableUnits;
    assert.equal(JSON.stringify(input), before);
});
test('changed geometry and duplicate aliases fail closed without sale-price gates', () => {
    const input = fixture();
    assert.equal(resolveOwnedPackLayout({ ...input, rotation: 0 }).valid, true);
    const block = input.blockData.find(
        (item) => item.information.name === 'FallenLog',
    );
    assert.ok(block);
    block.attributes.spanWidth = 1;
    assert.equal(
        resolveOwnedPackLayout({ ...input, rotation: 0 }).valid,
        false,
    );
    block.attributes.spanWidth = 2;
    input.blockData.push({ ...block, id: 99999 });
    assert.equal(
        resolveOwnedPackLayout({ ...input, rotation: 0 }).valid,
        false,
    );
});
test('review signature includes structures, support, appearance and rotation, but is order-independent', () => {
    const { garden } = fixture();
    const before = packLayoutGardenSignature(garden);
    garden.stacks.reverse();
    assert.equal(packLayoutGardenSignature(garden), before);
    const first = garden.stacks[0];
    assert.ok(first?.blocks[0]);
    first.blocks[0].rotation = 1;
    assert.notEqual(packLayoutGardenSignature(garden), before);
});

test('fixed appearance, unsupported model and nonpositive identity remain unavailable after catalogue withdrawal', () => {
    const input = fixture();
    const line = input.pack.lines[0];
    const block = input.blockData.find(
        (item) => item.information.name === line?.modelName,
    );
    assert.ok(line && block);
    block.id = -1;
    line.entityId = '-1';
    const slot = input.layout.placements[0];
    assert.ok(slot);
    slot.entityId = '-1';
    assert.equal(
        resolveOwnedPackLayout({ ...input, rotation: 0 }).valid,
        false,
    );
    line.modelName = 'UnregisteredDecoration';
    slot.modelName = line.modelName;
    block.information.name = line.modelName;
    block.id = 9001;
    line.entityId = '9001';
    slot.entityId = '9001';
    assert.equal(
        resolveOwnedPackLayout({ ...input, rotation: 0 }).valid,
        false,
    );
    const fresh = fixture();
    const fixed = fresh.layout.placements[0];
    assert.ok(fixed);
    fixed.variant = {
        versionId: 'unsupported:v1',
        appearance: { color: 'invalid' },
    };
    assert.equal(
        resolveOwnedPackLayout({ ...fresh, rotation: 0 }).valid,
        false,
    );
});

test('a rotated existing multi-cell block occupies its non-anchor cell in every group turn', () => {
    for (const rotation of [0, 1, 2, 3] as const) {
        const input = fixture();
        const target = resolveGardenPackLayoutPlacements(
            input.layout,
            input.anchor,
            rotation,
        )[1];
        assert.ok(target);
        // Existing FallenLog at (target.x,target.y-1), quarter-turned, covers the target rake cell.
        const support = input.garden.stacks.find(
            (stack) =>
                stack.position.x === target.position.x &&
                stack.position.z === target.position.y - 1,
        );
        assert.ok(support);
        support.blocks.push({
            id: 'rotated-existing',
            name: 'FallenLog',
            rotation: 1,
        });
        const result = resolveOwnedPackLayout({ ...input, rotation });
        assert.equal(
            result.valid,
            false,
            `turn ${rotation} non-anchor collision`,
        );
        assert.equal(result.placements.length, 4);
    }
});
