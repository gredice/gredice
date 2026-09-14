import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import {
    GardenBoxInventoryInsufficientError,
    GardenMutationOperationConflictError,
} from '@gredice/storage';
import { resolveGardenBlockPlacement } from './blockPlacementService';
import {
    createGardenBoxBlockPlacementService,
    type GardenBoxBlockPlacementCommand,
} from './gardenBoxBlockPlacementService';
import {
    createGardenOccupancyIndexFromStorageSnapshot,
    validatePersistedStructuresAfterBlockMutation,
} from './gardenOccupancyService';

const timestamp = '2026-08-30T00:00:00.000Z';

function directoryBlock(
    id: number,
    name: string,
    attributes: Partial<BlockData['attributes']> = {},
): BlockData {
    return {
        id,
        entityType: { id: 8, name: 'block', label: 'Blok' },
        slug: name.toLowerCase(),
        information: {
            name,
            label: name,
            shortDescription: name,
            fullDescription: name,
        },
        attributes: {
            height: 1,
            stackable: true,
            type: 'decoration',
            nightOnlyPurchase: false,
            ...attributes,
        },
        prices: { sunflowers: 1 },
        functions: { raisedBed: false, recycler: false },
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

function structureDocument() {
    return {
        schemaVersion: 1,
        footprint: {
            cells: [{ spaceKind: 'interior' as const, x: 0, y: 0 }],
        },
        floors: [],
        edges: [],
        roofRegions: [],
        props: [],
    };
}

const command: GardenBoxBlockPlacementCommand = {
    accountId: 'account-1',
    gardenId: 7,
    gardenBoxBlockId: 'box-1',
    entityId: '101',
    operationId: 'garden-box-place-1',
};

describe('placeGardenBoxBlock', () => {
    test('fails a stalled new operation closed before writes, then preserves ordering, replay, and precedence', async () => {
        const calls: string[] = [];
        const transaction = { id: 'shared-transaction' };
        let transactionActive = false;
        const blockData = [
            directoryBlock(1, 'Block_Grass'),
            directoryBlock(2, 'GardenBox', { stackable: false }),
            directoryBlock(101, 'Shade', { stackable: false }),
        ];
        const structures = [
            {
                anchorX: 0,
                anchorY: 0,
                document: structureDocument(),
                id: 'house-1',
                rotation: 0,
            },
        ];
        const preSnapshot = {
            garden: { id: 7, accountId: 'account-1', isSandbox: false },
            blocks: [
                { id: 'ground-1', name: 'Block_Grass', rotation: 0 },
                { id: 'box-1', name: 'GardenBox', rotation: 0 },
            ],
            stacks: [{ blocks: ['ground-1'], positionX: 0, positionY: 0 }],
        };
        const postSnapshot = {
            ...preSnapshot,
            blocks: [
                ...preSnapshot.blocks,
                { id: 'placed-1', name: 'Shade', rotation: 0 },
            ],
            stacks: [
                ...preSnapshot.stacks,
                { blocks: ['placed-1'], positionX: 0, positionY: -1 },
            ],
        };
        let snapshotReadCount = 0;
        const storedResponse = {
            blockId: 'placed-1',
            position: { x: 0, y: -1 },
            item: { entityTypeName: 'block', entityId: '101', amount: 1 },
        } as const;
        let storedPayload: unknown;
        let directoryUnavailable = false;
        let directoryPending = false;

        const place = createGardenBoxBlockPlacementService({
            consumeGardenBoxInventoryItem: async (
                _accountId,
                _gardenId,
                _gardenBoxBlockId,
                _payload,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                calls.push('consume');
            },
            createGardenBlock: async (
                _gardenId,
                _blockName,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                calls.push('create-block');
                return 'placed-1';
            },
            createGardenOccupancyIndexFromStorageSnapshot,
            createGardenStack: async (
                _gardenId,
                position,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                assert.deepEqual(position, { x: 0, y: -1 });
                calls.push('create-stack');
            },
            dependencyPreparationTimeoutMs: 5,
            getBlockData: async () => {
                assert.equal(transactionActive, false);
                calls.push('catalog');
                if (directoryPending) {
                    return new Promise(() => undefined);
                }
                if (directoryUnavailable) {
                    throw new Error('Directory unavailable');
                }
                return blockData;
            },
            getGardenBlockForUpdate: async () => {
                calls.push('box-authority');
                return { id: command.gardenBoxBlockId, name: 'GardenBox' };
            },
            getGardenMutationAuthorityForUpdate: async (
                _gardenId,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                calls.push('authority');
                return {
                    accountId: command.accountId,
                    id: command.gardenId,
                    isDeleted: snapshotReadCount > 0,
                    isSandbox: false,
                };
            },
            getGardenPlacementSnapshotForUpdate: async (
                _gardenId,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                snapshotReadCount += 1;
                calls.push(
                    snapshotReadCount === 1 ? 'snapshot-pre' : 'snapshot-post',
                );
                return snapshotReadCount === 1 ? preSnapshot : postSnapshot;
            },
            listGardenStructures: async (_gardenId, receivedTransaction) => {
                assert.equal(receivedTransaction, transaction);
                calls.push('structures');
                return structures;
            },
            resolveGardenBlockPlacement,
            updateGardenStack: async (
                _gardenId,
                stack,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                assert.deepEqual(stack, {
                    x: 0,
                    y: -1,
                    blocks: ['placed-1'],
                });
                calls.push('update-stack');
            },
            validatePersistedStructuresAfterBlockMutation,
            withGardenBoxInventoryTransaction: async (
                _accountId,
                _gardenId,
                _gardenBoxBlockId,
                callback,
            ) => {
                calls.push('inventory-lock');
                calls.push('account-lock');
                transactionActive = true;
                try {
                    return await callback(transaction);
                } finally {
                    transactionActive = false;
                }
            },
            withGardenMutationOperation: async (
                operation,
                callback,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                calls.push('receipt');
                assert.equal(operation.kind, 'garden-box-block-place');
                if (storedPayload !== undefined) {
                    if (
                        JSON.stringify(storedPayload) !==
                        JSON.stringify(operation.payload)
                    ) {
                        throw new GardenMutationOperationConflictError(
                            operation.gardenId,
                            operation.operationId,
                        );
                    }
                    return {
                        receipt: {
                            createdAt: new Date(),
                            gardenId: operation.gardenId,
                            kind: operation.kind,
                            operationId: operation.operationId,
                            payloadHash: '0'.repeat(64),
                            response: storedResponse,
                        },
                        replayed: true,
                    };
                }
                const mutation = await callback(transaction);
                assert.deepEqual(mutation.response, storedResponse);
                storedPayload = operation.payload;
                return {
                    receipt: {
                        createdAt: new Date(),
                        gardenId: operation.gardenId,
                        kind: operation.kind,
                        operationId: operation.operationId,
                        payloadHash: '0'.repeat(64),
                        response: storedResponse,
                    },
                    replayed: false,
                };
            },
            withGardenPlacementTransaction: async (
                _gardenId,
                callback,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                calls.push('garden-lock');
                return callback(transaction);
            },
        });

        directoryPending = true;
        assert.deepEqual(
            await place({
                ...command,
                operationId: 'garden-box-place-timeout',
            }),
            {
                ok: false,
                code: 'BLOCK_DIRECTORY_UNAVAILABLE',
                error: 'Garden block directory data is unavailable',
                status: 503,
            },
        );
        assert.deepEqual(calls, [
            'catalog',
            'inventory-lock',
            'account-lock',
            'garden-lock',
            'authority',
            'box-authority',
            'receipt',
            'snapshot-pre',
        ]);
        assert.equal(storedPayload, undefined);
        assert.equal(calls.includes('create-stack'), false);
        assert.equal(calls.includes('create-block'), false);
        assert.equal(calls.includes('consume'), false);

        calls.length = 0;
        directoryPending = false;
        snapshotReadCount = 0;
        const result = await place(command);

        assert.deepEqual(result, {
            ok: true,
            blockId: 'placed-1',
            position: { x: 0, y: -1 },
            item: { entityTypeName: 'block', entityId: '101', amount: 1 },
            replayed: false,
        });
        assert.deepEqual(calls, [
            'catalog',
            'inventory-lock',
            'account-lock',
            'garden-lock',
            'authority',
            'box-authority',
            'receipt',
            'snapshot-pre',
            'structures',
            'create-stack',
            'create-block',
            'update-stack',
            'snapshot-post',
            'consume',
        ]);

        calls.length = 0;
        directoryUnavailable = true;
        assert.deepEqual(await place(command), {
            ok: true,
            ...storedResponse,
            replayed: true,
        });
        assert.deepEqual(calls, [
            'catalog',
            'inventory-lock',
            'account-lock',
            'garden-lock',
            'authority',
            'box-authority',
            'receipt',
        ]);

        calls.length = 0;
        directoryUnavailable = false;
        directoryPending = true;
        assert.deepEqual(await place(command), {
            ok: true,
            ...storedResponse,
            replayed: true,
        });
        assert.deepEqual(calls, [
            'catalog',
            'inventory-lock',
            'account-lock',
            'garden-lock',
            'authority',
            'box-authority',
            'receipt',
        ]);

        calls.length = 0;
        assert.deepEqual(await place({ ...command, entityId: '102' }), {
            ok: false,
            code: 'OPERATION_CONFLICT',
            error: 'Garden mutation operation ID was reused with different input.',
            status: 409,
        });
        assert.equal(calls.at(0), 'catalog');

        calls.length = 0;
        assert.deepEqual(await place({ ...command, accountId: 'account-2' }), {
            ok: false,
            code: 'GARDEN_BOX_NOT_FOUND',
            error: 'Garden box not found',
            status: 404,
        });
        assert.equal(calls.at(0), 'catalog');
        assert.equal(calls.includes('receipt'), false);
    });

    test('rolls placement writes back when post-mutation structure validation fails', async () => {
        const transaction = { id: 'rollback-transaction' };
        const blockData = [
            directoryBlock(2, 'GardenBox', { stackable: false }),
            directoryBlock(101, 'Shade', { stackable: false }),
        ];
        const state = { blockCreated: false, stackCreated: false };
        let consumed = false;
        const snapshot = {
            garden: { id: 7, accountId: 'account-1', isSandbox: false },
            blocks: [{ id: 'box-1', name: 'GardenBox', rotation: 0 }],
            stacks: [],
        };

        const place = createGardenBoxBlockPlacementService({
            consumeGardenBoxInventoryItem: async () => {
                consumed = true;
            },
            createGardenBlock: async () => {
                state.blockCreated = true;
                return 'placed-1';
            },
            createGardenOccupancyIndexFromStorageSnapshot,
            createGardenStack: async () => {
                state.stackCreated = true;
            },
            getBlockData: async () => blockData,
            getGardenBlockForUpdate: async () => ({
                id: command.gardenBoxBlockId,
                name: 'GardenBox',
            }),
            getGardenMutationAuthorityForUpdate: async () => ({
                accountId: command.accountId,
                id: command.gardenId,
                isDeleted: false,
                isSandbox: false,
            }),
            getGardenPlacementSnapshotForUpdate: async () => snapshot,
            listGardenStructures: async () => [],
            resolveGardenBlockPlacement,
            updateGardenStack: async () => {},
            validatePersistedStructuresAfterBlockMutation: () => ({
                valid: false,
                error: {
                    code: 'GARDEN_OCCUPANCY_CONFLICT',
                    issues: [],
                    message: 'Garden occupancy rules prevent this change.',
                    status: 409,
                    truncated: false,
                },
            }),
            withGardenBoxInventoryTransaction: async (
                _accountId,
                _gardenId,
                _gardenBoxBlockId,
                callback,
            ) => {
                const before = { ...state };
                try {
                    return await callback(transaction);
                } catch (error) {
                    Object.assign(state, before);
                    throw error;
                }
            },
            withGardenMutationOperation: async (
                operation,
                callback,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                const mutation = await callback(transaction);
                return {
                    receipt: {
                        createdAt: new Date(),
                        gardenId: operation.gardenId,
                        kind: operation.kind,
                        operationId: operation.operationId,
                        payloadHash: '0'.repeat(64),
                        response: {
                            blockId: 'placed-1',
                            item: {
                                amount: 1,
                                entityId: command.entityId,
                                entityTypeName: 'block',
                            },
                            position: { x: 0, y: 0 },
                        },
                    },
                    replayed: false,
                    mutation,
                };
            },
            withGardenPlacementTransaction: async (
                _gardenId,
                callback,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                return callback(transaction);
            },
        });

        const result = await place(command);

        assert.deepEqual(result, {
            ok: false,
            code: 'GARDEN_OCCUPANCY_CONFLICT',
            error: 'Garden occupancy rules prevent this change.',
            status: 409,
        });
        assert.deepEqual(state, { blockCreated: false, stackCreated: false });
        assert.equal(consumed, false);
    });

    test('rolls placement writes back when the GardenBox item is gone', async () => {
        const transaction = { id: 'inventory-rollback-transaction' };
        const blockData = [
            directoryBlock(2, 'GardenBox', { stackable: false }),
            directoryBlock(101, 'Shade', { stackable: false }),
        ];
        const state = { blockCreated: false, stackCreated: false };
        const snapshot = {
            garden: { id: 7, accountId: 'account-1', isSandbox: false },
            blocks: [{ id: 'box-1', name: 'GardenBox', rotation: 0 }],
            stacks: [],
        };

        const place = createGardenBoxBlockPlacementService({
            consumeGardenBoxInventoryItem: async () => {
                throw new GardenBoxInventoryInsufficientError(0, 1);
            },
            createGardenBlock: async () => {
                state.blockCreated = true;
                return 'placed-1';
            },
            createGardenOccupancyIndexFromStorageSnapshot,
            createGardenStack: async () => {
                state.stackCreated = true;
            },
            getBlockData: async () => blockData,
            getGardenBlockForUpdate: async () => ({
                id: command.gardenBoxBlockId,
                name: 'GardenBox',
            }),
            getGardenMutationAuthorityForUpdate: async () => ({
                accountId: command.accountId,
                id: command.gardenId,
                isDeleted: false,
                isSandbox: false,
            }),
            getGardenPlacementSnapshotForUpdate: async () => snapshot,
            listGardenStructures: async () => [],
            resolveGardenBlockPlacement,
            updateGardenStack: async () => {},
            validatePersistedStructuresAfterBlockMutation: () => ({
                valid: true,
            }),
            withGardenBoxInventoryTransaction: async (
                _accountId,
                _gardenId,
                _gardenBoxBlockId,
                callback,
            ) => {
                const before = { ...state };
                try {
                    return await callback(transaction);
                } catch (error) {
                    Object.assign(state, before);
                    throw error;
                }
            },
            withGardenMutationOperation: async (
                operation,
                callback,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                const mutation = await callback(transaction);
                return {
                    receipt: {
                        createdAt: new Date(),
                        gardenId: operation.gardenId,
                        kind: operation.kind,
                        operationId: operation.operationId,
                        payloadHash: '0'.repeat(64),
                        response: {
                            blockId: 'placed-1',
                            item: {
                                amount: 1,
                                entityId: command.entityId,
                                entityTypeName: 'block',
                            },
                            position: { x: 0, y: 0 },
                        },
                    },
                    replayed: false,
                    mutation,
                };
            },
            withGardenPlacementTransaction: async (
                _gardenId,
                callback,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                return callback(transaction);
            },
        });

        const result = await place(command);

        assert.deepEqual(result, {
            ok: false,
            code: 'GARDEN_BOX_INVENTORY_INSUFFICIENT',
            error: 'Nedovoljno predmeta u vrtnoj kutiji',
            status: 400,
        });
        assert.deepEqual(state, { blockCreated: false, stackCreated: false });
    });
});
