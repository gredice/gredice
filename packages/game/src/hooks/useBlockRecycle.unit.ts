import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecyclePatchOperations } from './useBlockRecycle';

test('guards a recycle with the expected source block', () => {
    assert.deepEqual(
        createRecyclePatchOperations({
            position: { x: -4, z: 7 },
            blockId: 'block-to-recycle',
            blockIndex: 3,
        }),
        [
            {
                op: 'test',
                path: '/-4/7/3',
                value: 'block-to-recycle',
            },
            {
                op: 'remove',
                path: '/-4/7/3',
            },
        ],
    );
});
