import assert from 'node:assert/strict';
import test from 'node:test';
import type { GardenStack } from '../types/Stack';
import { moveBlockOptimistically } from './useBlockMove';

test('moving a Rabbit preserves its persisted coat variant', () => {
    const stacks: GardenStack[] = [
        {
            position: { x: 0, y: 0, z: 0 },
            blocks: [
                { id: 'grass-a', name: 'Block_Grass', rotation: 0 },
                {
                    id: 'rabbit-a',
                    name: 'Rabbit',
                    rotation: 0,
                    variant: 1,
                },
            ],
        },
        {
            position: { x: 1, y: 0, z: 0 },
            blocks: [{ id: 'grass-b', name: 'Block_Grass', rotation: 0 }],
        },
    ];

    const moved = moveBlockOptimistically(
        stacks,
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        1,
        'rabbit-a',
    );

    const rabbit = moved
        .flatMap((stack) => stack.blocks)
        .find((block) => block.id === 'rabbit-a');
    assert.equal(rabbit?.variant, 1);
    assert.equal(
        moved.find((stack) => stack.position.x === 1)?.blocks.at(-1)?.id,
        'rabbit-a',
    );
});
