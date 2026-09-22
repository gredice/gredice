import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import type { EntityBlockInstance } from '../entities/EntityInstancesBlock';
import { getAutumnGroundBlocks } from '../entities/groundDecorations/autumnGroundPlacements';
import {
    autumnGustCaps,
    createAutumnGustAnchors,
    resolveAutumnGustCount,
    sampleAutumnGustLeaf,
    sampleAutumnGustWindow,
} from './autumnLeafGusts';
import {
    autumnLeafCaps,
    writeAutumnLeafSourceCounts,
} from './autumnLeafMotion';

function instance(
    id: string,
    name = 'Block_Grass',
    x = 0,
): EntityBlockInstance {
    const block = { id, name, rotation: 0 };
    return {
        block,
        blockIndex: 0,
        id,
        pickupOutlineVisible: false,
        position: [x, 0.2, 0],
        rotation: 0,
        stack: { position: new Vector3(x, 0, 0), blocks: [block] },
        stackHeight: 0,
    };
}

const trees = [{ id: 'tree', x: 0, z: 0 }];
function anchors(instances: EntityBlockInstance[]) {
    const exposedBlockIds = new Set(
        getAutumnGroundBlocks(instances.map(({ stack }) => stack)).map(
            ({ block }) => block.id,
        ),
    );
    return createAutumnGustAnchors({
        instances,
        exposedBlockIds,
        trees,
        gardenId: 7,
        year: 2024,
    });
}

test('gust anchors use only exposed eligible ground near trees', () => {
    const covered = instance('covered');
    covered.stack.blocks.push({
        id: 'water',
        name: 'Block_Water',
        rotation: 0,
    });
    const found = anchors([
        instance('grass'),
        instance('sand', 'Block_Sand', 1),
        covered,
        instance('water', 'Block_Water'),
        instance('far', 'Block_Grass', 10),
    ]);
    assert.deepEqual(found.map(({ id }) => id).sort(), [
        '7:2024:grass',
        '7:2024:sand',
    ]);
    assert(found.every(({ y }) => y >= 0.4 && y < 0.5));
    assert.deepEqual(
        anchors([instance('grass')]),
        anchors([instance('grass')]),
    );
    assert.notDeepEqual(
        anchors([instance('grass')]),
        createAutumnGustAnchors({
            instances: [instance('grass')],
            exposedBlockIds: new Set(['grass']),
            trees,
            gardenId: 7,
            year: 2025,
        }),
    );
});

test('gust anchors follow rotated slopes and stay bounded in dense gardens', () => {
    const slope = instance('slope', 'Block_Grass_Angle');
    const original = anchors([slope])[0];
    const moved = anchors([
        {
            ...slope,
            position: [2, 1.2, 3],
            rotation: 1,
        },
    ]);
    assert.equal(moved.length, 0);
    const nearby = createAutumnGustAnchors({
        instances: [{ ...slope, position: [2, 1.2, 3], rotation: 1 }],
        exposedBlockIds: new Set(['slope']),
        trees: [{ id: 'tree', x: 2, z: 3 }],
        gardenId: 7,
        year: 2024,
    })[0];
    assert(Math.abs(nearby.x - (2 + original.z)) < 1e-8);
    assert(Math.abs(nearby.z - (3 - original.x)) < 1e-8);
    assert(Math.abs(nearby.y - original.y - 1) < 1e-8);
    const dense = anchors(
        Array.from({ length: 500 }, (_, index) => instance(`block:${index}`)),
    );
    assert.equal(dense.length, 64);
    assert.deepEqual(
        dense,
        anchors(
            Array.from({ length: 500 }, (_, index) =>
                instance(`block:${index}`),
            ).reverse(),
        ),
    );
});

test('calm, heavy rain, snow and disabled weather produce no gusts', () => {
    const base = {
        tier: 'high',
        windSpeed: 2,
        rain: 0,
        snow: 0,
        settledLeafAmount: 0.7,
        anchorCount: 3,
        enabled: true,
    } as const;
    assert.equal(resolveAutumnGustCount(base), autumnGustCaps.high);
    for (const options of [
        { windSpeed: 0 },
        { rain: 0.8 },
        { snow: 0.5 },
        { settledLeafAmount: 0 },
        { anchorCount: 0 },
        { enabled: false },
    ])
        assert.equal(resolveAutumnGustCount({ ...base, ...options }), 0);
    assert(
        resolveAutumnGustCount({ ...base, rain: 0.3 }) <
            resolveAutumnGustCount(base),
    );
    assert(
        resolveAutumnGustCount({ ...base, snow: 0.15 }) <
            resolveAutumnGustCount(base),
    );
});

test('frozen scene time repeats short gusts and the shared pool remains capped', () => {
    const window = sampleAutumnGustWindow(10.7, 7, 2024, 12);
    assert(window);
    assert.deepEqual(window, sampleAutumnGustWindow(10.7, 7, 2024, 12));
    assert.equal(sampleAutumnGustWindow(14, 7, 2024, 12), null);
    assert.equal(sampleAutumnGustWindow(10.7, 7, 2024, 0), null);
    assert.notDeepEqual(
        sampleAutumnGustWindow(10.7, 7, 2024, 12),
        sampleAutumnGustWindow(22.7, 7, 2024, 12),
    );
    const leaf = sampleAutumnGustLeaf('ground', 0, window.progress, 2, 90);
    assert.deepEqual(
        leaf,
        sampleAutumnGustLeaf('ground', 0, window.progress, 2, 90),
    );
    assert(leaf.y > 0 && leaf.y < 0.15);
    assert(leaf.scale > 0 && leaf.scale <= 0.85);
    const allocations: number[] = [];
    for (const tier of ['low', 'high'] as const) {
        const gustCount = autumnGustCaps[tier];
        writeAutumnLeafSourceCounts(
            allocations,
            50,
            8,
            autumnLeafCaps[tier] - gustCount,
        );
        assert(
            allocations.reduce((sum, value) => sum + value, gustCount) <=
                autumnLeafCaps[tier],
        );
    }
});
