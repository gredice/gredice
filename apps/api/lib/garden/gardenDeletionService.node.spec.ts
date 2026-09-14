import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AccountDeletionInProgressError } from '@gredice/storage';
import {
    createGardenDeletionService,
    parseGardenDeletionId,
} from './gardenDeletionService';

const command = { accountId: 'account-1', gardenId: 7 } as const;

function makeHarness({
    activeRaisedBedCount = 0,
    activeStructureCount = 0,
    accountId = command.accountId,
    isDeleted = false,
    isSandbox = false,
}: Readonly<{
    activeRaisedBedCount?: number;
    activeStructureCount?: number;
    accountId?: string;
    isDeleted?: boolean;
    isSandbox?: boolean;
}> = {}) {
    const calls: string[] = [];
    const transaction = { id: 'garden-delete' };
    let deleted = false;
    const service = createGardenDeletionService({
        bustScheduleCache: async () => {
            calls.push('cache');
        },
        getGardenDeletionTargetForUpdate: async (
            gardenId,
            receivedTransaction,
        ) => {
            assert.equal(gardenId, command.gardenId);
            assert.equal(receivedTransaction, transaction);
            calls.push('target');
            return {
                accountId,
                id: gardenId,
                isDeleted,
                isSandbox,
            };
        },
        getGardenPlacementSnapshotForUpdate: async (
            gardenId,
            receivedTransaction,
        ) => {
            assert.equal(gardenId, command.gardenId);
            assert.equal(receivedTransaction, transaction);
            calls.push('snapshot');
            return {
                garden: { accountId, id: gardenId, isSandbox },
            };
        },
        listGardenRaisedBedMetadataForUpdate: async (
            gardenId,
            receivedTransaction,
        ) => {
            assert.equal(gardenId, command.gardenId);
            assert.equal(receivedTransaction, transaction);
            calls.push('raised-beds');
            return Array.from({ length: activeRaisedBedCount }, () => ({
                status: 'active',
            }));
        },
        listGardenStructuresForUpdate: async (
            gardenId,
            receivedTransaction,
        ) => {
            assert.equal(gardenId, command.gardenId);
            assert.equal(receivedTransaction, transaction);
            calls.push('structures');
            return Array.from({ length: activeStructureCount }, (_, index) => ({
                id: `structure-${index.toString()}`,
            }));
        },
        softDeleteGardenOnce: async (gardenId, receivedTransaction) => {
            assert.equal(gardenId, command.gardenId);
            assert.equal(receivedTransaction, transaction);
            calls.push('delete');
            deleted = true;
            return 'deleted' as const;
        },
        withAccountDeletionFenceTransaction: async (account, callback) => {
            assert.equal(account, command.accountId);
            calls.push('account-lock');
            return callback(transaction);
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
    });
    return {
        calls,
        get deleted() {
            return deleted;
        },
        service,
    };
}

describe('deleteRealGardenForAccount', () => {
    test('accepts only canonical positive int32 route IDs', () => {
        assert.equal(parseGardenDeletionId('1'), 1);
        assert.equal(parseGardenDeletionId('2147483647'), 2_147_483_647);
        for (const invalid of [
            '',
            '0',
            '-1',
            '01',
            '1junk',
            '2147483648',
            '9007199254740992',
        ]) {
            assert.equal(parseGardenDeletionId(invalid), null);
        }
    });

    test('locks account, garden, structures, and raised beds before deleting', async () => {
        const harness = makeHarness();

        assert.deepEqual(await harness.service(command), {
            ok: true,
            deleted: true,
        });
        assert.equal(harness.deleted, true);
        assert.deepEqual(harness.calls, [
            'account-lock',
            'garden-lock',
            'target',
            'snapshot',
            'structures',
            'raised-beds',
            'delete',
            'cache',
        ]);
    });

    test('rejects deletion while a structure could retain paid principal', async () => {
        const harness = makeHarness({ activeStructureCount: 2 });

        assert.deepEqual(await harness.service(command), {
            ok: false,
            code: 'ACTIVE_STRUCTURES',
            error: 'Garden cannot be deleted while it has active structures',
            status: 409,
            activeStructureCount: 2,
        });
        assert.equal(harness.deleted, false);
        assert.equal(harness.calls.includes('delete'), false);
        assert.equal(harness.calls.includes('cache'), false);
    });

    test('replays an already-deleted garden without another side effect', async () => {
        const harness = makeHarness({ isDeleted: true });

        assert.deepEqual(await harness.service(command), {
            ok: true,
            deleted: false,
        });
        assert.equal(harness.deleted, false);
        assert.deepEqual(harness.calls, [
            'account-lock',
            'garden-lock',
            'target',
        ]);
    });

    test('preserves the active raised-bed conflict', async () => {
        const harness = makeHarness({ activeRaisedBedCount: 1 });

        assert.deepEqual(await harness.service(command), {
            ok: false,
            code: 'ACTIVE_RAISED_BEDS',
            error: 'Garden cannot be deleted while it has active raised beds',
            status: 409,
            activeRaisedBedCount: 1,
        });
        assert.equal(harness.deleted, false);
    });

    test('fails closed for another account, sandbox, and account deletion', async () => {
        for (const harness of [
            makeHarness({ accountId: 'account-2' }),
            makeHarness({ isSandbox: true }),
        ]) {
            assert.deepEqual(await harness.service(command), {
                ok: false,
                code: 'GARDEN_NOT_FOUND',
                error: 'Garden not found',
                status: 404,
            });
            assert.equal(harness.deleted, false);
        }

        const service = createGardenDeletionService({
            bustScheduleCache: async () => {},
            getGardenDeletionTargetForUpdate: async () => null,
            getGardenPlacementSnapshotForUpdate: async () => null,
            listGardenRaisedBedMetadataForUpdate: async () => [],
            listGardenStructuresForUpdate: async () => [],
            softDeleteGardenOnce: async () => 'not-found' as const,
            withAccountDeletionFenceTransaction: async () => {
                throw new AccountDeletionInProgressError(command.accountId);
            },
            withGardenPlacementTransaction: async () => {
                throw new Error('garden lock should not run');
            },
        });
        assert.deepEqual(await service(command), {
            ok: false,
            code: 'ACCOUNT_DELETION_IN_PROGRESS',
            error: 'The account is being deleted.',
            status: 409,
        });
    });
});
