import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import {
    autumnGroundCaps,
    getAutumnAccumulationYear,
    getAutumnTreeInfluence,
    resolveAutumnAccumulationWind,
} from '../../scene/autumnAccumulation';
import type { EntityBlockInstance } from '../EntityInstancesBlock';
import {
    createAutumnGroundBatches,
    getAutumnGroundBlocks,
} from './autumnGroundPlacements';

function instance(name = 'Block_Grass', id = 'ground'): EntityBlockInstance {
    const block = { name, id, rotation: 0 };
    return {
        block,
        id,
        blockIndex: 0,
        stackHeight: 0,
        pickupOutlineVisible: false,
        position: [0, 0.2, 0],
        rotation: 0,
        stack: { position: new Vector3(), blocks: [block] },
    };
}
const defaults = {
    instances: [instance()],
    trees: [{ id: 'tree', x: 0, z: 0 }],
    amount: 0.85,
    snow: 0,
    tier: 'high',
    year: 2024,
    gardenId: 1,
} as const;
function placements(
    options: Partial<Parameters<typeof createAutumnGroundBatches>[0]> = {},
) {
    return createAutumnGroundBatches({
        ...defaults,
        instances: [instance()],
        ...options,
    })
        .flatMap((batch) => batch.instances)
        .sort((a, b) => a.id.localeCompare(b.id));
}
test('only exposed supported terrain can accumulate leaves', () => {
    for (const cover of [
        'Block_Water',
        'Block_Swamp_Water',
        'Block_Grass',
        'Raised_Bed',
        'MulchWood',
    ]) {
        const stack = instance().stack;
        stack.blocks.push({ name: cover, id: 'cover', rotation: 0 });
        assert(
            !getAutumnGroundBlocks([stack]).some(
                (item) => item.block.id === 'ground',
            ),
            cover,
        );
    }
    assert.equal(
        placements({ instances: [instance('Block_Water')] }).length,
        0,
    );
    assert.equal(getAutumnGroundBlocks([instance().stack]).length, 1);
});
test('zero season, missing or distant source and full snow suppress accumulation', () => {
    for (const options of [
        { amount: 0 },
        { trees: [] },
        { trees: [{ id: 'far', x: 10, z: 10 }] },
        { snow: 1 },
    ])
        assert.equal(placements(options).length, 0);
    assert(placements({ snow: 0.4 }).length < placements().length);
});
test('density reveals a stable ordered subset and winter preserves autumn seed', () => {
    const full = placements();
    assert(full.length > 0);
    assert.deepEqual(placements(), full);
    assert.deepEqual(
        placements({ amount: 0.5 }),
        full.slice(0, placements({ amount: 0.5 }).length),
    );
    assert.equal(getAutumnAccumulationYear(new Date(2025, 0, 15)), 2024);
    assert.notDeepEqual(placements({ year: 2025 }), full);
});
test('wind only changes bounded density influence, never candidate positions', () => {
    const trees = [{ id: 'tree', x: -1, z: 0 }];
    assert(
        getAutumnTreeInfluence(0, 0, trees, 90, 3) >
            getAutumnTreeInfluence(0, 0, trees, 270, 3),
    );
    const calm = placements({ trees });
    const wind = placements({ trees, windSpeed: 3, windDirection: 90 });
    assert.deepEqual(wind.slice(0, calm.length), calm);
});
test('sloped clusters rotate with block and follow stack height and drag offsets', () => {
    const block = instance('Block_Grass_Angle');
    const original = placements({ instances: [block] });
    const moved = placements({
        instances: [{ ...block, position: [2, 1.2, 3], rotation: 1 }],
        trees: [{ id: 'tree', x: 2, z: 3 }],
    });
    for (const [index, leaf] of original.entries()) {
        assert(
            Math.abs(
                leaf.position[1] - (0.412 + (leaf.position[0] - 0.5) * 0.4),
            ) < 1e-8,
        );
        assert(
            Math.abs(moved[index].position[0] - (2 + leaf.position[2])) < 1e-8,
        );
        assert(
            Math.abs(moved[index].position[2] - (3 - leaf.position[0])) < 1e-8,
        );
        assert(
            Math.abs(moved[index].position[1] - leaf.position[1] - 1) < 1e-8,
        );
        assert.equal(moved[index].block.id, block.block.id);
    }
});
test('scene quality caps bound batched clusters', () => {
    const instances = Array.from({ length: 200 }, (_, i) =>
        instance('Block_Grass', `block:${i}`),
    );
    for (const tier of [
        'low',
        'auto-constrained',
        'medium',
        'high',
        'custom',
    ] as const) {
        const batches = createAutumnGroundBatches({
            ...defaults,
            instances,
            tier,
        });
        assert.equal(
            batches.reduce((sum, batch) => sum + batch.instances.length, 0),
            autumnGroundCaps[tier],
        );
        assert(
            batches.length <=
                (tier === 'low' || tier === 'auto-constrained' ? 1 : 4),
        );
    }
});

test('live and overridden wind share compass bearings and bounded influence', () => {
    assert.deepEqual(
        resolveAutumnAccumulationWind(undefined, {
            windSpeed: 3,
            windDirection: 'NE',
        }),
        { windSpeed: 3, windDirection: 45 },
    );
    assert.deepEqual(
        resolveAutumnAccumulationWind(
            { windSpeed: 0, windDirection: 270 },
            { windSpeed: 3, windDirection: 'N' },
        ),
        { windSpeed: 0, windDirection: 270 },
    );
    const trees = [{ id: 'tree', x: 0, z: 0 }];
    assert(
        getAutumnTreeInfluence(0, -1, trees, 0, 3) >
            getAutumnTreeInfluence(0, 1, trees, 0, 3),
    );
    assert(
        getAutumnTreeInfluence(1, 0, trees, 90, 3) >
            getAutumnTreeInfluence(-1, 0, trees, 90, 3),
    );
    assert(
        getAutumnTreeInfluence(1, -1, trees, 45, 3) >
            getAutumnTreeInfluence(-1, 1, trees, 45, 3),
    );
});
