import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getPendingBlockExpandKey,
    type PendingBlockExpand,
    type PendingBlockExpandStorage,
    readPendingBlockExpand,
    savePendingBlockExpand,
} from './pendingBlockExpand';

function createMemoryStorage() {
    const values = new Map<string, string>();
    const storage: PendingBlockExpandStorage = {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
            values.set(key, value);
        },
        removeItem: (key) => {
            values.delete(key);
        },
    };
    return { storage, values };
}

const command: PendingBlockExpand = {
    gardenId: 951,
    body: {
        operationId: '2f1d8e4c-7b6a-4c5d-8e9f-0a1b2c3d4e5f',
        blockName: 'Block_Grass',
        rotation: 1,
        expectedUnitPrice: 10,
        placements: [
            { position: { x: 2, y: -4 }, expectedExistingBlocks: [] },
            {
                position: { x: 3, y: -4 },
                expectedExistingBlocks: ['ground:3:-4'],
            },
        ],
    },
};

describe('pendingBlockExpand', () => {
    it('keys the command by user and garden', () => {
        assert.equal(
            getPendingBlockExpandKey('user-1', 951),
            'gredice:pending-block-expand:["user-1",951]',
        );
    });

    it('round-trips a command for the same user and garden only', () => {
        const { storage, values } = createMemoryStorage();
        savePendingBlockExpand('user-1', 951, command, storage);
        assert.equal(values.size, 1);
        assert.deepEqual(
            readPendingBlockExpand('user-1', 951, storage),
            command,
        );
        assert.equal(readPendingBlockExpand('user-2', 951, storage), null);
        assert.equal(readPendingBlockExpand('user-1', 952, storage), null);
    });

    it('clears the command', () => {
        const { storage, values } = createMemoryStorage();
        savePendingBlockExpand('user-1', 951, command, storage);
        savePendingBlockExpand('user-1', 951, null, storage);
        assert.equal(values.size, 0);
        assert.equal(readPendingBlockExpand('user-1', 951, storage), null);
    });

    it('rejects stored values that fail the contract schema', () => {
        const { storage, values } = createMemoryStorage();
        const key = getPendingBlockExpandKey('user-1', 951);
        const invalid: unknown[] = [
            'not json',
            JSON.stringify(null),
            JSON.stringify({ body: command.body }),
            JSON.stringify({ gardenId: 952, body: command.body }),
            JSON.stringify({
                gardenId: 951,
                body: { ...command.body, operationId: 'not-a-uuid' },
            }),
            JSON.stringify({
                gardenId: 951,
                body: { ...command.body, placements: [] },
            }),
            JSON.stringify({
                gardenId: 951,
                body: { ...command.body, accountId: 'other' },
            }),
            JSON.stringify({
                gardenId: 951,
                body: {
                    ...command.body,
                    placements: [
                        command.body.placements[0],
                        command.body.placements[0],
                    ],
                },
            }),
        ];
        for (const value of invalid) {
            values.set(key, String(value));
            assert.equal(
                readPendingBlockExpand('user-1', 951, storage),
                null,
                String(value),
            );
        }
    });

    it('tolerates storage that throws or is missing', () => {
        const throwing: PendingBlockExpandStorage = {
            getItem: () => {
                throw new Error('SecurityError');
            },
            setItem: () => {
                throw new Error('QuotaExceededError');
            },
            removeItem: () => {
                throw new Error('SecurityError');
            },
        };
        assert.equal(readPendingBlockExpand('user-1', 951, throwing), null);
        assert.doesNotThrow(() =>
            savePendingBlockExpand('user-1', 951, command, throwing),
        );
        assert.doesNotThrow(() =>
            savePendingBlockExpand('user-1', 951, null, throwing),
        );
        assert.equal(readPendingBlockExpand('user-1', 951, null), null);
        assert.doesNotThrow(() =>
            savePendingBlockExpand('user-1', 951, command, null),
        );
    });
});
