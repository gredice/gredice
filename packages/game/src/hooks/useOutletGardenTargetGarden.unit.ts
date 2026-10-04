import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOutletGardenTargetGarden } from './useOutletGardenTargetGarden';

test('normalizes nested owner garden stacks for Outlet target discovery', () => {
    const garden = normalizeOutletGardenTargetGarden({
        id: 7,
        isSandbox: false,
        raisedBeds: [],
        stacks: {
            '2': {
                '3': [
                    {
                        id: 'grass-1',
                        message: null,
                        name: 'Block_Grass',
                        rotation: null,
                        variant: null,
                    },
                ],
            },
        },
    });

    assert.equal(garden.id, 7);
    assert.deepEqual(garden.stacks, [
        {
            blocks: [
                {
                    id: 'grass-1',
                    message: null,
                    name: 'Block_Grass',
                    rotation: 0,
                    variant: null,
                },
            ],
            position: { x: 2, y: 0, z: 3 },
        },
    ]);
});
