import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import type { EntityBlockInstance } from '../entities/EntityInstancesBlock';
import { createAutumnGroundBatches } from '../entities/groundDecorations/autumnGroundPlacements';
import { getAutumnAccumulationYear } from '../scene/autumnAccumulation';
import { getAutumnState } from '../scene/autumnState';
import { getSeasonState } from '../scene/seasonState';
import { createLeafStepCoverage } from './leafStepCoverage';

function batches({
    amount = 0.9,
    snow = 0,
    tier = 'high',
    rotation = 0,
    name = 'Block_Grass',
}: {
    amount?: number;
    snow?: number;
    tier?: 'low' | 'high';
    rotation?: number;
    name?: string;
} = {}) {
    const block = { id: 'ground', name, rotation };
    const instance: EntityBlockInstance = {
        id: block.id,
        block,
        rotation,
        blockIndex: 0,
        stackHeight: 0,
        pickupOutlineVisible: false,
        position: [0, 0.2, 0],
        stack: { position: new Vector3(), blocks: [block] },
    };
    return createAutumnGroundBatches({
        instances: [instance],
        trees: [{ id: 'tree', x: 0, z: 0 }],
        amount,
        snow,
        tier,
        year: 2024,
        gardenId: 1,
    });
}
test('coverage is exactly the rendered low/high allocation, with scene isolation and cleanup', () => {
    for (const tier of ['low', 'high'] as const) {
        const coverage = createLeafStepCoverage();
        const leaves = batches({ tier });
        const remove = coverage.register(leaves);
        assert(!coverage.hasLeaves({ x: 0.51, y: 0.4, z: 0 }));
        assert(!coverage.hasLeaves({ x: 0, y: 0.4, z: -0.51 }));
        for (const { instances } of leaves) {
            for (const {
                position: [x, y, z],
            } of instances) {
                assert(coverage.hasLeaves({ x, y: y - 0.012, z }));
                assert(!coverage.hasLeaves({ x, y: y + 1, z }));
                assert(!coverage.hasLeaves({ x: x + 10, y, z }));
                assert(!createLeafStepCoverage().hasLeaves({ x, y, z }));
            }
        }
        remove();
        assert(!coverage.hasLeaves({ x: 0, y: 0.4, z: 0 }));
    }
});
test('rotated slope contact uses the surface plane rather than a flat height', () => {
    for (const rotation of [0, 1, 2, 3]) {
        const coverage = createLeafStepCoverage();
        const leaves = batches({ name: 'Block_Grass_Angle', rotation });
        coverage.register(leaves);
        const [x, y, z] = leaves[0].instances[0].position;
        const angle = (rotation * Math.PI) / 2;
        assert(
            coverage.hasLeaves({
                x: x + Math.cos(angle) * 0.2,
                y: y - 0.012 + 0.08,
                z: z - Math.sin(angle) * 0.2,
            }),
        );
        assert(!coverage.hasLeaves({ x, y: y + 0.2, z }));
    }
});
test('summer, snow, unsupported surfaces and removed coverage are silent', () => {
    for (const options of [
        { amount: 0 },
        { snow: 1 },
        { name: 'Block_Water' },
    ]) {
        const coverage = createLeafStepCoverage();
        coverage.register(batches(options));
        assert(!coverage.hasLeaves({ x: 0, y: 0.4, z: 0 }));
    }
    assert(
        batches({ snow: 0.4 }).flatMap((batch) => batch.instances).length <
            batches().flatMap((batch) => batch.instances).length,
    );
});

test('frozen calendar dates repeat seasonal coverage and retain the preceding autumn seed in winter', () => {
    for (const date of [
        new Date(2024, 5, 21),
        new Date(2024, 9, 22),
        new Date(2024, 10, 21),
        new Date(2025, 0, 15),
    ]) {
        const amount = getAutumnState(getSeasonState(date)).settledLeafAmount;
        assert.deepEqual(batches({ amount }), batches({ amount }));
        if (date.getMonth() === 5) assert.equal(batches({ amount }).length, 0);
        else assert(batches({ amount }).length > 0);
    }
    assert.equal(getAutumnAccumulationYear(new Date(2025, 0, 15)), 2024);
});
