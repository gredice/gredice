import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import type { EntityBlockInstance } from '../EntityInstancesBlock';
import {
    autumnEntityCaps,
    createAutumnEntityBatches,
} from './autumnEntityPlacements';
import { autumnLeafEntityNames } from './autumnLeafSurfaces';

function instance(name = 'Stool', id = 'entity'): EntityBlockInstance {
    const block = { id, name, rotation: 0 };
    return {
        block,
        id,
        blockIndex: 0,
        stackHeight: 0,
        pickupOutlineVisible: false,
        rotation: 0,
        position: [0, 0, 0],
        stack: { position: new Vector3(), blocks: [block] },
    };
}
function batches(
    options: Partial<Parameters<typeof createAutumnEntityBatches>[0]> = {},
) {
    return createAutumnEntityBatches({
        instances: [instance()],
        trees: [{ id: 'tree', x: 0, z: 0 }],
        amount: 0.85,
        snow: 0,
        tier: 'high',
        year: 2024,
        gardenId: 1,
        ...options,
    });
}
const leaves = (options: Parameters<typeof batches>[0] = {}) =>
    batches(options)
        .flatMap((batch) => batch.instances)
        .sort((a, b) => a.id.localeCompare(b.id));

test('explicit static surface allowlist excludes animals, crops, water, lights and moving lids', () => {
    for (const name of [
        'Cat',
        'Tree',
        'Tulip',
        'Block_Water',
        'GardenBox',
        'GardenLamp',
        'WoodenBench',
        'OutletDisplayTable',
    ])
        assert.equal(leaves({ instances: [instance(name)] }).length, 0, name);
    for (const name of autumnLeafEntityNames)
        assert(leaves({ instances: [instance(name)] }).length > 0, name);
});
test('zero season, missing/distant trees, invalid state and snow suppress leaves', () => {
    for (const options of [
        { amount: 0 },
        { amount: Number.NaN },
        { trees: [] },
        { trees: [{ id: 'far', x: 20, z: 20 }] },
        { snow: 1 },
    ])
        assert.equal(leaves(options).length, 0);
    assert(leaves({ snow: 0.5 }).length < leaves().length);
});
test('stable anchor ordering reveals the same positions as density grows', () => {
    const full = leaves({ amount: 1 });
    assert.deepEqual(leaves({ amount: 1 }), full);
    for (const leaf of leaves({ amount: 0.5 }))
        assert.deepEqual(
            full.find((item) => item.id === leaf.id),
            leaf,
        );
    assert.notDeepEqual(leaves({ year: 2025 }), leaves());
});
test('rotation and stack/drag translation preserve local anchors and block animation identity', () => {
    const original = leaves();
    const block = instance();
    const moved = leaves({
        instances: [{ ...block, rotation: 1, position: [2, 1, 3] }],
        trees: [{ id: 'tree', x: 2, z: 3 }],
    });
    for (const [index, leaf] of original.entries()) {
        assert(
            Math.abs(moved[index].position[0] - 2 - leaf.position[2]) < 1e-9,
        );
        assert(
            Math.abs(moved[index].position[2] - 3 + leaf.position[0]) < 1e-9,
        );
        assert(
            Math.abs(moved[index].position[1] - 1 - leaf.position[1]) < 1e-9,
        );
        assert.equal(moved[index].block.id, block.block.id);
        assert.equal(moved[index].pickupOutlineVisible, false);
    }
});
test('raised bed orientations expand both U segments on their own rims', () => {
    for (const rotation of [0, 1, 2, 3]) {
        const instanceValue = instance('Raised_Bed');
        const result = leaves({ instances: [{ ...instanceValue, rotation }] });
        assert.equal(result.length, 5);
        assert.equal(
            new Set(
                result.map(
                    (leaf) => leaf.id.split(':autumn:')[1].split(':')[0],
                ),
            ).size,
            2,
        );
        for (const leaf of result) assert.equal(leaf.position[1], 0.306);
    }
});
test('covered props are excluded and quality bounds hold across repeated instances', () => {
    const covered = instance();
    covered.stack.blocks.push({
        id: 'cover',
        name: 'Block_Grass',
        rotation: 0,
    });
    assert.equal(leaves({ instances: [covered] }).length, 0);
    const instances = Array.from({ length: 100 }, (_, i) =>
        instance('Stool', `entity:${i}`),
    );
    for (const tier of [
        'low',
        'auto-constrained',
        'medium',
        'high',
        'custom',
    ] as const) {
        const result = batches({ instances, tier });
        assert.equal(
            result.reduce((sum, batch) => sum + batch.instances.length, 0),
            autumnEntityCaps[tier],
        );
        assert(
            result.length <=
                (tier === 'low' || tier === 'auto-constrained' ? 1 : 2),
        );
    }
});

test('each raised-bed segment resolves tree proximity from its own world offset', () => {
    const bed = { ...instance('Raised_Bed'), rotation: 1 };
    const leftOnly = leaves({
        instances: [bed],
        trees: [{ id: 'tree', x: -2.9, z: 0 }],
    });
    assert.equal(leftOnly.length, 1);
    assert(leftOnly.every((leaf) => leaf.id.includes(':autumn:1:')));
    const rightOnly = leaves({
        instances: [bed],
        trees: [{ id: 'tree', x: 3.4, z: 0 }],
    });
    assert.equal(rightOnly.length, 1);
    assert(rightOnly.every((leaf) => leaf.id.includes(':autumn:0:')));
});
