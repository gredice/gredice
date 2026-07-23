import assert from 'node:assert/strict';
import test from 'node:test';
import type { Block } from '../types/Block';
import {
    readGameProfileCloseupCommand,
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
