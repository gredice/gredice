import assert from 'node:assert/strict';
import test from 'node:test';
import type { Block } from '../types/Block';
import {
    readGameProfileCloseupCommand,
    readGameProfilePlacementCommand,
    resolveGameProfilePlacementBlockIds,
    resolveGameProfileRaisedBedTarget,
} from './GameProfileController';

const firstBlock: Block = {
    id: 'profile-raised-bed:29:0',
    name: 'Raised_Bed',
    rotation: 0,
};

test('profile closeup command validates the deterministic raised bed id', () => {
    assert.deepEqual(
        readGameProfileCloseupCommand({ action: 'open', raisedBedId: 1 }),
        { action: 'open', raisedBedId: 1 },
    );
    assert.deepEqual(readGameProfileCloseupCommand({ action: 'close' }), {
        action: 'close',
    });
    assert.deepEqual(readGameProfileCloseupCommand({ action: 'reset' }), {
        action: 'reset',
    });
    assert.equal(
        readGameProfileCloseupCommand({ action: 'open', raisedBedId: 0 }),
        null,
    );
    assert.equal(
        readGameProfileCloseupCommand({ action: 'open', raisedBedId: '1' }),
        null,
    );
});

test('profile target resolution uses the raised bed primary block', () => {
    const target = resolveGameProfileRaisedBedTarget(
        {
            raisedBeds: [
                {
                    blockId: firstBlock.id,
                    id: 29,
                    name: '  Profile raised bed 29  ',
                },
            ],
            stacks: [{ blocks: [firstBlock] }],
        },
        29,
    );

    assert.deepEqual(target, {
        block: firstBlock,
        blockId: firstBlock.id,
        raisedBedName: 'Profile raised bed 29',
        raisedBedId: 29,
    });
    assert.equal(
        resolveGameProfileRaisedBedTarget(
            {
                raisedBeds: [
                    {
                        blockId: 'missing',
                        id: 2,
                        name: 'Missing profile bed',
                    },
                ],
                stacks: [{ blocks: [firstBlock] }],
            },
            2,
        ),
        null,
    );
    assert.equal(
        resolveGameProfileRaisedBedTarget(
            {
                raisedBeds: [
                    {
                        blockId: firstBlock.id,
                        id: 3,
                        name: '   ',
                    },
                ],
                stacks: [{ blocks: [firstBlock] }],
            },
            3,
        ),
        null,
    );
});

test('profile placement command validates the repeatable stagger', () => {
    assert.deepEqual(readGameProfilePlacementCommand({ action: 'run' }), {
        action: 'run',
        staggerMs: 120,
    });
    assert.deepEqual(
        readGameProfilePlacementCommand({ action: 'run', staggerMs: 80 }),
        {
            action: 'run',
            staggerMs: 80,
        },
    );
    assert.deepEqual(readGameProfilePlacementCommand({ action: 'reset' }), {
        action: 'reset',
    });
    assert.equal(
        readGameProfilePlacementCommand({ action: 'run', staggerMs: -1 }),
        null,
    );
});

test('profile placement targets use one entity batch across separate chunks', () => {
    const blockA: Block = {
        id: 'grass-a',
        name: 'Block_Grass',
        rotation: 0,
    };
    const blockB: Block = {
        id: 'grass-b',
        name: 'Block_Grass',
        rotation: 0,
    };

    assert.deepEqual(
        resolveGameProfilePlacementBlockIds({
            raisedBeds: [],
            stacks: [
                {
                    blocks: [blockA],
                    position: { x: 0, z: 0 },
                },
                {
                    blocks: [
                        {
                            id: 'non-instanced',
                            name: 'Unknown',
                            rotation: 0,
                        },
                    ],
                    position: { x: 8, z: 0 },
                },
                {
                    blocks: [blockB],
                    position: { x: 9, z: 0 },
                },
            ],
        }),
        ['grass-a', 'grass-b'],
    );
});
