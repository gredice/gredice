import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import {
    createAccount,
    createGardenBlock,
    GardenMutationOperationConflictError,
    getGardenBlocks,
    getGardenMutationOperationReceipt,
    hashGardenMutationOperationPayload,
    withGardenMutationOperation,
} from '@gredice/storage';
import { createTestGarden, ensureFarmId } from './helpers/testHelpers';

async function createGardenFixture() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    return { accountId, gardenId };
}

describe('garden mutation operation receipts', () => {
    it('hashes object payloads canonically', () => {
        assert.equal(
            hashGardenMutationOperationPayload({
                blockName: 'Tree',
                position: { x: 1, y: 2 },
            }),
            hashGardenMutationOperationPayload({
                position: { y: 2, x: 1 },
                blockName: 'Tree',
            }),
        );
    });

    it('replays the exact response and rejects payload or kind conflicts', async () => {
        const { gardenId } = await createGardenFixture();
        const operationId = randomUUID();
        let callbackCalls = 0;
        const input = {
            gardenId,
            kind: 'block-purchase' as const,
            operationId,
            payload: { blockName: 'Tree', position: null },
        };

        const first = await withGardenMutationOperation(input, async () => {
            callbackCalls += 1;
            return {
                response: {
                    id: 'persisted-block-id',
                    position: { x: 4, y: -3 },
                    variant: null,
                },
            };
        });
        const replay = await withGardenMutationOperation(input, async () => {
            callbackCalls += 1;
            return { response: { id: 'must-not-run' } };
        });

        assert.equal(first.replayed, false);
        assert.equal(replay.replayed, true);
        assert.equal(callbackCalls, 1);
        assert.deepEqual(replay.receipt.response, first.receipt.response);

        await assert.rejects(
            withGardenMutationOperation(
                {
                    ...input,
                    payload: { blockName: 'Bush', position: null },
                },
                async () => ({ response: { id: 'conflict' } }),
            ),
            GardenMutationOperationConflictError,
        );
        await assert.rejects(
            withGardenMutationOperation(
                { ...input, kind: 'gift-open' },
                async () => ({ response: { id: 'conflict' } }),
            ),
            GardenMutationOperationConflictError,
        );
    });

    it('rolls back domain writes and the receipt when the callback fails', async () => {
        const { gardenId } = await createGardenFixture();
        const operationId = randomUUID();

        await assert.rejects(
            withGardenMutationOperation(
                {
                    gardenId,
                    kind: 'block-purchase',
                    operationId,
                    payload: { blockName: 'Tree' },
                },
                async (transaction) => {
                    await createGardenBlock(gardenId, 'Tree', transaction);
                    throw new Error('Injected operation failure');
                },
            ),
            /Injected operation failure/u,
        );

        assert.equal((await getGardenBlocks(gardenId)).length, 0);
        assert.equal(
            await getGardenMutationOperationReceipt({
                gardenId,
                operationId,
            }),
            null,
        );
    });
});
