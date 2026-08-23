import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import { createButterflyHabitats } from './Butterflies';

function stackWithBlocks(
    x: number,
    z: number,
    blocks: Array<{ id: string; name: string }>,
): Stack {
    return {
        blocks: blocks.map((block) => ({ ...block, rotation: 0 })),
        position: new Vector3(x, 0, z),
    };
}

test('creates butterfly habitat only for flowers with valid ground support', () => {
    const supportedFlower = stackWithBlocks(0, 0, [
        { id: 'grass', name: 'Block_Grass' },
        { id: 'tulip', name: 'Tulip' },
    ]);
    const unsupportedFlower = stackWithBlocks(3, 0, [
        { id: 'unsupported-tulip', name: 'Tulip' },
    ]);

    const habitats = createButterflyHabitats({
        blockData: undefined,
        garden: {
            id: 14,
            raisedBeds: [],
            stacks: [supportedFlower, unsupportedFlower],
        },
        groundDecorationDensity: 0,
    });

    assert.equal(habitats.length, 1);
    assert.ok(habitats[0]?.targets.length);
    assert.ok(
        habitats[0]?.targets.every((target) =>
            target.blockIds?.includes('tulip'),
        ),
    );
});

test('does not create a butterfly habitat without flowers', () => {
    const habitats = createButterflyHabitats({
        blockData: undefined,
        garden: {
            id: 14,
            raisedBeds: [],
            stacks: [
                stackWithBlocks(0, 0, [
                    { id: 'grass', name: 'Block_Grass' },
                    { id: 'tree', name: 'Tree' },
                ]),
            ],
        },
        groundDecorationDensity: 0,
    });

    assert.deepEqual(habitats, []);
});
