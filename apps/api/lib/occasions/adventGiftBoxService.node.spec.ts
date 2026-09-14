import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    createAdventGiftBoxService,
    type GiftBoxReward,
    getAdventGiftBoxOperationId,
} from './adventGiftBoxService';

const command = {
    accountId: 'account-1',
    gardenId: 7,
    blockId: '3342f25e-949c-4b4e-bcea-95b2d1809201',
    timeZone: 'Europe/Zagreb',
} as const;
const reward: GiftBoxReward = {
    kind: 'plant',
    entityTypeName: 'plantSort',
    entityId: '42',
    title: 'Rajčica',
};

function makeHarness({
    adventOver = true,
    blockDirectoryPending = false,
    blockName = 'GiftBox_RedWhite',
    dependencyPreparationTimeoutMs,
    existingReceipt,
    gardenActive = true,
    gardenAccountId = command.accountId,
    gardenIsDeleted = false,
    gardenIsSandbox = false,
    occupancyResult = { valid: true } as const,
    operationConflict = false,
    remainingBlockIds = ['ground'],
    blockDirectoryFailure = false,
    rewardFailure = false,
    rewardPending = false,
}: Readonly<{
    adventOver?: boolean;
    blockDirectoryPending?: boolean;
    blockName?: string;
    dependencyPreparationTimeoutMs?: number;
    existingReceipt?: Readonly<{ reward: GiftBoxReward }>;
    gardenActive?: boolean;
    gardenAccountId?: string;
    gardenIsDeleted?: boolean;
    gardenIsSandbox?: boolean;
    occupancyResult?:
        | Readonly<{ valid: true }>
        | Readonly<{
              valid: false;
              error: Readonly<{
                  code: 'GARDEN_OCCUPANCY_CONFLICT';
                  message: string;
                  status: 409;
              }>;
          }>;
    operationConflict?: boolean;
    remainingBlockIds?: readonly string[];
    blockDirectoryFailure?: boolean;
    rewardFailure?: boolean;
    rewardPending?: boolean;
}> = {}) {
    const calls: string[] = [];
    const transaction = { id: 'gift-transaction' };
    let transactionActive = false;
    let receipt = existingReceipt;
    const service = createAdventGiftBoxService({
        addInventoryItem: async (accountId, payload, receivedTransaction) => {
            assert.equal(accountId, command.accountId);
            assert.equal(receivedTransaction, transaction);
            assert.deepEqual(payload, {
                entityTypeName: reward.entityTypeName,
                entityId: reward.entityId,
                amount: 1,
                source: `advent-gift-box:${command.gardenId.toString()}:${command.blockId}`,
            });
            calls.push('inventory-add');
        },
        deleteGardenStack: async (gardenId, position, receivedTransaction) => {
            assert.equal(gardenId, command.gardenId);
            assert.deepEqual(position, { x: 2, y: -3 });
            assert.equal(receivedTransaction, transaction);
            calls.push('stack-delete');
        },
        dependencyPreparationTimeoutMs,
        getGardenMutationAuthorityForUpdate: async (
            gardenId,
            receivedTransaction,
        ) => {
            assert.equal(gardenId, command.gardenId);
            assert.equal(receivedTransaction, transaction);
            calls.push('authority');
            return {
                accountId: gardenAccountId,
                id: gardenId,
                isDeleted: gardenIsDeleted,
                isSandbox: gardenIsSandbox,
            };
        },
        getGardenPlacementSnapshotForUpdate: async (
            gardenId,
            receivedTransaction,
        ) => {
            assert.equal(gardenId, command.gardenId);
            assert.equal(receivedTransaction, transaction);
            calls.push('snapshot');
            if (!gardenActive) return null;
            return {
                garden: {
                    accountId: gardenAccountId,
                    id: gardenId,
                    isSandbox: gardenIsSandbox,
                },
                blocks: [
                    { id: command.blockId, name: blockName },
                    ...remainingBlockIds.map((id) => ({
                        id,
                        name: 'Block_Grass',
                    })),
                ],
                stacks: [
                    {
                        blocks: [...remainingBlockIds, command.blockId],
                        positionX: 2,
                        positionY: -3,
                    },
                ],
            };
        },
        getBlockData: async () => {
            assert.equal(transactionActive, false);
            calls.push('directory');
            if (blockDirectoryPending) {
                return new Promise(() => undefined);
            }
            if (blockDirectoryFailure) {
                throw new Error('Block directory unavailable');
            }
            return [];
        },
        isAdventSeasonOver: () => adventOver,
        listGardenStructuresForUpdate: async (
            gardenId,
            receivedTransaction,
        ) => {
            assert.equal(gardenId, command.gardenId);
            assert.equal(receivedTransaction, transaction);
            calls.push('structures');
            return [];
        },
        loadGiftBoxRewardCatalog: async () => {
            assert.equal(transactionActive, false);
            calls.push('reward-directory');
            if (rewardPending) {
                return new Promise(() => undefined);
            }
            if (rewardFailure) {
                throw new Error('Directory unavailable');
            }
            return {
                operations: [],
                plants: [{ entityId: reward.entityId, title: reward.title }],
            };
        },
        pickGiftBoxReward: async () => {
            calls.push('reward');
            return reward;
        },
        softDeleteGardenBlockOnce: async (
            gardenId,
            blockId,
            receivedTransaction,
        ) => {
            assert.equal(gardenId, command.gardenId);
            assert.equal(blockId, command.blockId);
            assert.equal(receivedTransaction, transaction);
            calls.push('block-delete');
            return 'deleted' as const;
        },
        updateGardenStack: async (gardenId, stack, receivedTransaction) => {
            assert.equal(gardenId, command.gardenId);
            assert.deepEqual(stack, {
                x: 2,
                y: -3,
                blocks: [...remainingBlockIds],
            });
            assert.equal(receivedTransaction, transaction);
            calls.push('stack-update');
        },
        validatePersistedStructuresAfterBlockMutation: (input) => {
            calls.push('occupancy');
            assert.equal(
                input.snapshot.blocks.some(
                    (candidate) => candidate.id === command.blockId,
                ),
                false,
            );
            assert.equal(
                input.snapshot.stacks.some((candidate) =>
                    candidate.blocks.includes(command.blockId),
                ),
                false,
            );
            return occupancyResult;
        },
        withAccountDeletionFenceTransaction: async (
            accountId,
            callback,
            receivedTransaction,
        ) => {
            assert.equal(accountId, command.accountId);
            assert.equal(receivedTransaction, transaction);
            calls.push('account-lock');
            return callback(transaction);
        },
        withGardenMutationOperation: async (
            operation,
            callback,
            receivedTransaction,
        ) => {
            assert.equal(receivedTransaction, transaction);
            assert.deepEqual(operation, {
                gardenId: command.gardenId,
                kind: 'gift-open',
                operationId: getAdventGiftBoxOperationId(command.blockId),
                payload: {
                    accountId: command.accountId,
                    blockId: command.blockId,
                },
            });
            calls.push('receipt');
            if (operationConflict) {
                const error = new Error(
                    'Garden mutation operation ID was reused with different input.',
                );
                error.name = 'GardenMutationOperationConflictError';
                throw error;
            }
            if (receipt) {
                return {
                    receipt: { response: receipt },
                    replayed: true,
                };
            }
            const created = await callback(transaction);
            receipt = created.response;
            return {
                receipt: { response: created.response },
                replayed: false,
            };
        },
        withGardenPlacementTransaction: async (
            gardenId,
            callback,
            receivedTransaction,
        ) => {
            assert.equal(gardenId, command.gardenId);
            assert.equal(receivedTransaction, transaction);
            calls.push('garden-lock');
            return callback(transaction);
        },
        withInventoryAccountTransaction: async (accountId, callback) => {
            assert.equal(accountId, command.accountId);
            calls.push('inventory-lock');
            transactionActive = true;
            try {
                return await callback(transaction);
            } finally {
                transactionActive = false;
            }
        },
    });
    return { calls, receipt: () => receipt, service };
}

describe('openAdventGiftBoxAtomically', () => {
    test('loads reward directories before inventory, account, and garden locks', async () => {
        const harness = makeHarness();

        assert.deepEqual(await harness.service(command), {
            ok: true,
            replayed: false,
            reward,
        });
        assert.deepEqual(harness.calls, [
            'directory',
            'reward-directory',
            'inventory-lock',
            'account-lock',
            'garden-lock',
            'authority',
            'receipt',
            'snapshot',
            'structures',
            'occupancy',
            'reward',
            'inventory-add',
            'stack-update',
            'block-delete',
        ]);
    });

    test('replays the exact saved reward after soft deletion without reading active garden state', async () => {
        const harness = makeHarness({
            gardenActive: false,
            gardenIsDeleted: true,
            adventOver: false,
            existingReceipt: { reward },
        });

        assert.deepEqual(await harness.service(command), {
            ok: true,
            replayed: true,
            reward,
        });
        assert.deepEqual(harness.calls, [
            'directory',
            'reward-directory',
            'inventory-lock',
            'account-lock',
            'garden-lock',
            'authority',
            'receipt',
        ]);
    });

    test('rejects sandbox gifts before receipt, reward, or inventory effects', async () => {
        const harness = makeHarness({
            existingReceipt: { reward },
            gardenIsSandbox: true,
        });

        assert.deepEqual(await harness.service(command), {
            ok: false,
            code: 'SANDBOX_GIFT_UNAVAILABLE',
            error: 'Poklon kutije nisu dostupne u probnom vrtu.',
            status: 400,
        });
        assert.deepEqual(harness.calls, [
            'directory',
            'reward-directory',
            'inventory-lock',
            'account-lock',
            'garden-lock',
            'authority',
        ]);
    });

    test('soft-deletes an emptied stack in the same transaction', async () => {
        const harness = makeHarness({ remainingBlockIds: [] });

        assert.equal((await harness.service(command)).ok, true);
        assert.equal(harness.calls.includes('stack-delete'), true);
        assert.equal(harness.calls.includes('stack-update'), false);
        assert.ok(
            harness.calls.indexOf('stack-delete') <
                harness.calls.indexOf('block-delete'),
        );
    });

    test('rejects an unregistered block that only mimics the gift-box prefix', async () => {
        const harness = makeHarness({ blockName: 'GiftBox_Unregistered' });

        assert.deepEqual(await harness.service(command), {
            ok: false,
            code: 'INVALID_GIFT_BOX',
            error: 'Odabrani blok nije poklon kutija.',
            status: 400,
        });
        assert.equal(harness.calls.includes('reward'), false);
        assert.equal(harness.calls.includes('inventory-add'), false);
    });

    test('rejects a missing or duplicated stack occurrence before choosing a reward', async () => {
        for (const stacks of [
            [],
            [
                {
                    blocks: [command.blockId, command.blockId],
                    positionX: 2,
                    positionY: -3,
                },
            ],
        ]) {
            const calls: string[] = [];
            const transaction = { id: 'invalid-stack' };
            const service = createAdventGiftBoxService({
                addInventoryItem: async () => {
                    calls.push('inventory-add');
                },
                deleteGardenStack: async () => {},
                getGardenMutationAuthorityForUpdate: async () => ({
                    accountId: command.accountId,
                    id: command.gardenId,
                    isDeleted: false,
                    isSandbox: false,
                }),
                getGardenPlacementSnapshotForUpdate: async () => ({
                    garden: {
                        accountId: command.accountId,
                        id: command.gardenId,
                        isSandbox: false,
                    },
                    blocks: [{ id: command.blockId, name: 'GiftBox_RedWhite' }],
                    stacks,
                }),
                getBlockData: async () => [],
                isAdventSeasonOver: () => true,
                listGardenStructuresForUpdate: async () => [],
                loadGiftBoxRewardCatalog: async () => ({
                    operations: [],
                    plants: [
                        { entityId: reward.entityId, title: reward.title },
                    ],
                }),
                pickGiftBoxReward: async () => {
                    calls.push('reward');
                    return reward;
                },
                softDeleteGardenBlockOnce: async () => 'deleted' as const,
                updateGardenStack: async () => {},
                validatePersistedStructuresAfterBlockMutation: () => ({
                    valid: true,
                }),
                withAccountDeletionFenceTransaction: async (
                    _accountId,
                    callback,
                ) => callback(transaction),
                withGardenMutationOperation: async (_operation, callback) => {
                    const created = await callback(transaction);
                    return {
                        receipt: { response: created.response },
                        replayed: false,
                    };
                },
                withGardenPlacementTransaction: async (_gardenId, callback) =>
                    callback(transaction),
                withInventoryAccountTransaction: async (_accountId, callback) =>
                    callback(transaction),
            });

            assert.deepEqual(await service(command), {
                ok: false,
                code: 'GARDEN_STATE_CHANGED',
                error: 'Položaj poklon kutije se promijenio.',
                status: 409,
            });
            assert.deepEqual(calls, []);
        }
    });

    test('checks Advent only for a new receipt and rejects invalid input before locks', async () => {
        const unavailable = makeHarness({ adventOver: false });

        assert.deepEqual(await unavailable.service(command), {
            ok: false,
            code: 'GIFT_UNAVAILABLE',
            error: 'Advent još traje. Poklon kutije su dostupne 25.12.',
            status: 400,
        });
        assert.deepEqual(unavailable.calls, [
            'directory',
            'reward-directory',
            'inventory-lock',
            'account-lock',
            'garden-lock',
            'authority',
            'receipt',
            'snapshot',
        ]);

        const invalid = makeHarness();
        assert.deepEqual(
            await invalid.service({ ...command, gardenId: 2_147_483_648 }),
            {
                ok: false,
                code: 'INVALID_REQUEST',
                error: 'Neispravan zahtjev za poklon kutiju.',
                status: 400,
            },
        );
        assert.deepEqual(invalid.calls, []);
    });

    test('authorizes the locked garden before revealing an operation receipt', async () => {
        const harness = makeHarness({
            blockDirectoryPending: true,
            dependencyPreparationTimeoutMs: 5,
            existingReceipt: { reward },
            gardenAccountId: 'account-2',
            rewardPending: true,
        });

        assert.deepEqual(await harness.service(command), {
            ok: false,
            code: 'GARDEN_NOT_FOUND',
            error: 'Vrt nije pronađen.',
            status: 404,
        });
        assert.equal(harness.calls.includes('receipt'), false);
    });

    test('rejects an unsupported candidate before reward or inventory effects', async () => {
        const harness = makeHarness({
            occupancyResult: {
                valid: false,
                error: {
                    code: 'GARDEN_OCCUPANCY_CONFLICT',
                    message: 'Garden occupancy rules prevent this change.',
                    status: 409,
                },
            },
        });

        assert.deepEqual(await harness.service(command), {
            ok: false,
            code: 'GARDEN_OCCUPANCY_CONFLICT',
            error: 'Garden occupancy rules prevent this change.',
            status: 409,
        });
        assert.equal(harness.calls.includes('reward'), false);
        assert.equal(harness.calls.includes('inventory-add'), false);
    });

    test('normalizes reward-directory failures into a typed retryable response', async () => {
        const harness = makeHarness({ rewardFailure: true });

        assert.deepEqual(await harness.service(command), {
            ok: false,
            code: 'REWARD_UNAVAILABLE',
            error: 'Nagrada poklon kutije trenutačno nije dostupna.',
            status: 503,
        });
        assert.equal(harness.calls.includes('inventory-add'), false);
        assert.equal(harness.calls.includes('inventory-lock'), true);
    });

    test('normalizes a stalled reward directory into a typed retryable response without effects', async () => {
        const harness = makeHarness({
            dependencyPreparationTimeoutMs: 5,
            rewardPending: true,
        });

        assert.deepEqual(await harness.service(command), {
            ok: false,
            code: 'REWARD_UNAVAILABLE',
            error: 'Nagrada poklon kutije trenutačno nije dostupna.',
            status: 503,
        });
        assert.equal(harness.receipt(), undefined);
        assert.equal(harness.calls.includes('inventory-add'), false);
        assert.equal(harness.calls.includes('stack-update'), false);
        assert.equal(harness.calls.includes('block-delete'), false);
    });

    test('returns a retryable block-directory failure without effects when a new cold read stalls', async () => {
        const harness = makeHarness({
            blockDirectoryPending: true,
            dependencyPreparationTimeoutMs: 5,
        });

        assert.deepEqual(await harness.service(command), {
            ok: false,
            code: 'BLOCK_DIRECTORY_UNAVAILABLE',
            error: 'Podaci kataloga vrtnih blokova trenutačno nisu dostupni.',
            status: 503,
        });
        assert.equal(harness.receipt(), undefined);
        assert.equal(harness.calls.includes('reward'), false);
        assert.equal(harness.calls.includes('inventory-add'), false);
        assert.equal(harness.calls.includes('stack-update'), false);
        assert.equal(harness.calls.includes('block-delete'), false);
    });

    test('keeps Advent validation ahead of prepared catalogue timeouts', async () => {
        const harness = makeHarness({
            adventOver: false,
            blockDirectoryPending: true,
            dependencyPreparationTimeoutMs: 5,
            rewardPending: true,
        });

        assert.deepEqual(await harness.service(command), {
            ok: false,
            code: 'GIFT_UNAVAILABLE',
            error: 'Advent još traje. Poklon kutije su dostupne 25.12.',
            status: 400,
        });
        assert.equal(harness.calls.includes('reward'), false);
    });

    test('keeps operation conflicts ahead of prepared catalogue timeouts', async () => {
        const harness = makeHarness({
            blockDirectoryPending: true,
            dependencyPreparationTimeoutMs: 5,
            operationConflict: true,
            rewardPending: true,
        });

        assert.deepEqual(await harness.service(command), {
            ok: false,
            code: 'OPERATION_CONFLICT',
            error: 'Identitet otvaranja već je korišten za drugi zahtjev.',
            status: 409,
        });
        assert.equal(harness.calls.includes('snapshot'), false);
        assert.equal(harness.calls.includes('inventory-add'), false);
    });

    test('replays a committed gift when both cold directory reads fail', async () => {
        const harness = makeHarness({
            blockDirectoryFailure: true,
            existingReceipt: { reward },
            rewardFailure: true,
        });

        assert.deepEqual(await harness.service(command), {
            ok: true,
            replayed: true,
            reward,
        });
        assert.deepEqual(harness.calls, [
            'directory',
            'reward-directory',
            'inventory-lock',
            'account-lock',
            'garden-lock',
            'authority',
            'receipt',
        ]);
    });

    test('replays a committed gift when both cold directory reads stall', async () => {
        const harness = makeHarness({
            blockDirectoryPending: true,
            dependencyPreparationTimeoutMs: 5,
            existingReceipt: { reward },
            rewardPending: true,
        });

        assert.deepEqual(await harness.service(command), {
            ok: true,
            replayed: true,
            reward,
        });
        assert.deepEqual(harness.calls, [
            'directory',
            'reward-directory',
            'inventory-lock',
            'account-lock',
            'garden-lock',
            'authority',
            'receipt',
        ]);
    });
});
