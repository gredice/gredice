import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import {
    GardenMutationOperationConflictError,
    type GardenMutationOperationJson,
    type GardenMutationOperationStoredResponse,
    hashGardenMutationOperationPayload,
    InsufficientSunflowersError,
} from '@gredice/storage';
import { resolveGardenBlockPlacement } from './blockPlacementService';
import {
    createGardenOccupancyIndexFromStorageSnapshot,
    validatePersistedStructuresAfterBlockMutation,
} from './gardenOccupancyService';
import {
    createPurchaseGardenBlockService,
    type PurchaseGardenBlockCommand,
    type PurchaseGardenBlockDependencies,
} from './purchaseGardenBlockService';

const timestamp = '2026-08-30T00:00:00.000Z';

function directoryBlock(
    id: number,
    name: string,
    options: Readonly<{
        price?: number;
        stackable?: boolean;
        type?: string;
    }> = {},
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
            stackable: options.stackable ?? true,
            type: options.type ?? 'decoration',
            nightOnlyPurchase: false,
        },
        prices: { sunflowers: options.price ?? 75 },
        functions: { raisedBed: name === 'Raised_Bed', recycler: false },
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

type TestTransaction = Readonly<{ id: 'shared-transaction' }>;

type TestState = {
    balance: number;
    blocks: {
        id: string;
        name: string;
        rotation: number | null;
        variant: number | null;
    }[];
    debits: { amount: number; reason: string }[];
    raisedBeds: { blockId: string; status: 'new' }[];
    receipts: Map<
        string,
        {
            kind: 'block-purchase';
            payloadHash: string;
            response: GardenMutationOperationStoredResponse;
        }
    >;
    stacks: { blocks: string[]; positionX: number; positionY: number }[];
    structures: {
        anchorX: number;
        anchorY: number;
        document: ReturnType<typeof structureDocument>;
        id: string;
        rotation: number;
    }[];
};

type HarnessOptions = Readonly<{
    availableNow?: boolean;
    balance?: number;
    blockName?: string;
    directoryPrice?: number;
    failAfterDebit?: boolean;
    failCacheBust?: boolean;
    gardenAccountId?: string;
    sandbox?: boolean;
    structures?: TestState['structures'];
}>;

function cloneState(state: TestState): TestState {
    return {
        balance: state.balance,
        blocks: state.blocks.map((block) => ({ ...block })),
        debits: state.debits.map((debit) => ({ ...debit })),
        raisedBeds: state.raisedBeds.map((raisedBed) => ({ ...raisedBed })),
        receipts: new Map(
            [...state.receipts].map(([key, receipt]) => [
                key,
                { ...receipt, response: { ...receipt.response } },
            ]),
        ),
        stacks: state.stacks.map((stack) => ({
            ...stack,
            blocks: [...stack.blocks],
        })),
        structures: state.structures.map((structure) => ({
            ...structure,
            document: structureDocument(),
        })),
    };
}

function storedResponse(value: unknown): GardenMutationOperationStoredResponse {
    if (!isStoredResponse(value)) {
        throw new TypeError('Expected stored response object');
    }
    return value;
}

function isStoredJson(value: unknown): value is GardenMutationOperationJson {
    if (
        value === null ||
        typeof value === 'boolean' ||
        typeof value === 'string'
    ) {
        return true;
    }
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(isStoredJson);
    return (
        typeof value === 'object' && Object.values(value).every(isStoredJson)
    );
}

function isStoredResponse(
    value: unknown,
): value is GardenMutationOperationStoredResponse {
    return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        isStoredJson(value)
    );
}

function makeHarness(options: HarnessOptions = {}) {
    const accountId = 'account-1';
    const gardenId = 42;
    const blockName = options.blockName ?? 'Shade';
    const transaction: TestTransaction = { id: 'shared-transaction' };
    const calls: string[] = [];
    let gardenActive = true;
    const blockData = [
        directoryBlock(1, 'Block_Grass', {
            price: 0,
            stackable: true,
            type: 'terrain',
        }),
        directoryBlock(2, blockName, {
            price: options.directoryPrice ?? 75,
            stackable: false,
        }),
    ];
    let nextBlockId = 1;
    let state: TestState = {
        balance: options.balance ?? 1_000,
        blocks: [
            {
                id: 'ground-1',
                name: 'Block_Grass',
                rotation: 0,
                variant: null,
            },
        ],
        debits: [],
        raisedBeds: [],
        receipts: new Map(),
        stacks: [{ blocks: ['ground-1'], positionX: 0, positionY: 0 }],
        structures:
            options.structures?.map((structure) => ({
                ...structure,
            })) ?? [],
    };

    const dependencies: PurchaseGardenBlockDependencies<TestTransaction> = {
        bustScheduleCache: async () => {
            calls.push('cache-bust');
            if (options.failCacheBust) {
                throw new Error('Schedule cache unavailable');
            }
        },
        createAppearanceVariant: () => undefined,
        createGardenBlock: async (
            _gardenId,
            requestedBlockName,
            variant,
            receivedTransaction,
        ) => {
            assert.equal(receivedTransaction, transaction);
            const id = `placed-${nextBlockId.toString()}`;
            nextBlockId += 1;
            state.blocks.push({
                id,
                name: requestedBlockName,
                rotation: null,
                variant,
            });
            calls.push('create-block');
            return id;
        },
        createGardenOccupancyIndexFromStorageSnapshot,
        createGardenStack: async (_gardenId, position, receivedTransaction) => {
            assert.equal(receivedTransaction, transaction);
            state.stacks.push({
                blocks: [],
                positionX: position.x,
                positionY: position.y,
            });
            calls.push('create-stack');
        },
        createRaisedBedInTransaction: async (input, receivedTransaction) => {
            assert.equal(receivedTransaction, transaction);
            state.raisedBeds.push({
                blockId: input.blockId,
                status: input.status,
            });
            calls.push('create-raised-bed');
            return state.raisedBeds.length;
        },
        debitSunflowers: async (
            _accountId,
            amount,
            reason,
            receivedTransaction,
        ) => {
            assert.equal(receivedTransaction, transaction);
            if (state.balance < amount) {
                throw new InsufficientSunflowersError(state.balance, amount);
            }
            state.balance -= amount;
            state.debits.push({ amount, reason });
            calls.push('debit');
            if (options.failAfterDebit) {
                throw new Error('Injected failure after debit');
            }
        },
        getBlockData: async () => {
            calls.push('directory');
            return blockData;
        },
        getGardenLocation: async () => {
            calls.push('location');
            return { lat: 45, lon: 16 };
        },
        getGardenMutationAuthorityForUpdate: async (
            _gardenId,
            receivedTransaction,
        ) => {
            assert.equal(receivedTransaction, transaction);
            calls.push('authority');
            return {
                accountId: options.gardenAccountId ?? accountId,
                id: gardenId,
                isDeleted: !gardenActive,
                isSandbox: options.sandbox ?? false,
            };
        },
        getGardenPlacementSnapshotForUpdate: async (
            _gardenId,
            receivedTransaction,
        ) => {
            assert.equal(receivedTransaction, transaction);
            calls.push('snapshot');
            if (!gardenActive) return null;
            return {
                garden: {
                    id: gardenId,
                    accountId: options.gardenAccountId ?? accountId,
                    isSandbox: options.sandbox ?? false,
                },
                blocks: state.blocks,
                stacks: state.stacks,
            };
        },
        isBlockPurchaseAvailableNow: () => options.availableNow ?? true,
        listGardenStructures: async (_gardenId, receivedTransaction) => {
            assert.equal(receivedTransaction, transaction);
            calls.push('structures');
            return state.structures;
        },
        now: () => new Date('2026-08-30T23:00:00.000Z'),
        random: () => 0.25,
        resolveGardenBlockPlacement,
        updateGardenStack: async (_gardenId, stack, receivedTransaction) => {
            assert.equal(receivedTransaction, transaction);
            const target = state.stacks.find(
                (candidate) =>
                    candidate.positionX === stack.x &&
                    candidate.positionY === stack.y,
            );
            if (!target) throw new Error('Missing target stack');
            target.blocks = [...stack.blocks];
            calls.push('update-stack');
        },
        validatePersistedStructuresAfterBlockMutation,
        withAccountDeletionFenceTransaction: async (
            _accountId,
            callback,
            receivedTransaction,
        ) => {
            assert.equal(receivedTransaction, transaction);
            calls.push('deletion-fence');
            return callback(transaction);
        },
        withGardenMutationOperation: async (
            input,
            callback,
            receivedTransaction,
        ) => {
            assert.equal(receivedTransaction, transaction);
            calls.push('operation-receipt');
            const payloadHash = hashGardenMutationOperationPayload(
                input.payload,
            );
            const existing = state.receipts.get(input.operationId);
            if (existing) {
                if (
                    existing.kind !== input.kind ||
                    existing.payloadHash !== payloadHash
                ) {
                    throw new GardenMutationOperationConflictError(
                        input.gardenId,
                        input.operationId,
                    );
                }
                return {
                    replayed: true,
                    receipt: {
                        createdAt: new Date(),
                        gardenId: input.gardenId,
                        operationId: input.operationId,
                        ...existing,
                    },
                };
            }
            const mutation = await callback(transaction);
            const response = storedResponse(mutation.response);
            const receipt = {
                kind: input.kind,
                payloadHash,
                response,
            };
            state.receipts.set(input.operationId, receipt);
            return {
                replayed: false,
                receipt: {
                    createdAt: new Date(),
                    gardenId: input.gardenId,
                    operationId: input.operationId,
                    ...receipt,
                },
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
        withSunflowerAccountTransaction: async (_accountId, callback) => {
            calls.push('sunflower-lock');
            const before = cloneState(state);
            try {
                const result = await callback(transaction);
                calls.push('transaction-committed');
                return result;
            } catch (error) {
                state = before;
                throw error;
            }
        },
    };

    const service = createPurchaseGardenBlockService(dependencies);
    const command = (
        overrides: Partial<PurchaseGardenBlockCommand> = {},
    ): PurchaseGardenBlockCommand => ({
        accountId,
        blockName,
        expectedExistingBlocks: ['ground-1'],
        gardenId,
        operationId: 'purchase-1',
        position: { x: 0, y: 0 },
        ...overrides,
    });

    return {
        calls,
        command,
        service,
        softDeleteGarden: () => {
            gardenActive = false;
        },
        state: () => cloneState(state),
    };
}

describe('purchaseGardenBlock', () => {
    it('uses the global lock order and commits placement, raised-bed projection, debit, and receipt atomically', async () => {
        const harness = makeHarness({ blockName: 'Raised_Bed' });

        const result = await harness.service(harness.command());

        assert.deepEqual(result, {
            ok: true,
            blockId: 'placed-1',
            position: { x: 0, y: 0 },
            replayed: false,
            variant: null,
        });
        assert.deepEqual(harness.calls, [
            'sunflower-lock',
            'deletion-fence',
            'garden-lock',
            'authority',
            'operation-receipt',
            'snapshot',
            'directory',
            'location',
            'structures',
            'create-block',
            'update-stack',
            'create-raised-bed',
            'debit',
            'transaction-committed',
            'cache-bust',
        ]);
        const state = harness.state();
        assert.equal(state.balance, 925);
        assert.deepEqual(state.raisedBeds, [
            { blockId: 'placed-1', status: 'new' },
        ]);
        assert.deepEqual(state.debits, [
            {
                amount: 75,
                reason: 'gardenBlock:42:purchase:purchase-1',
            },
        ]);
        assert.equal(state.receipts.size, 1);
    });

    it('replays the exact response without duplicating placement or debit', async () => {
        const harness = makeHarness();
        const first = await harness.service(harness.command());
        harness.softDeleteGarden();
        const replay = await harness.service(harness.command());

        assert.equal(first.ok && first.replayed, false);
        assert.equal(replay.ok && replay.replayed, true);
        assert.deepEqual(
            replay.ok ? replay.blockId : null,
            first.ok ? first.blockId : null,
        );
        const state = harness.state();
        assert.equal(state.blocks.length, 2);
        assert.equal(state.debits.length, 1);
        assert.equal(state.receipts.size, 1);
        assert.equal(
            harness.calls.filter((call) => call === 'directory').length,
            1,
        );
        assert.equal(
            harness.calls.filter((call) => call === 'snapshot').length,
            1,
        );
        assert.equal(harness.calls.includes('cache-bust'), false);
    });

    it('denies a foreign account before consulting the operation receipt', async () => {
        const harness = makeHarness({ gardenAccountId: 'account-2' });

        assert.deepEqual(await harness.service(harness.command()), {
            ok: false,
            code: 'GARDEN_NOT_FOUND',
            error: 'Garden not found',
            status: 404,
        });
        assert.equal(harness.calls.includes('operation-receipt'), false);
        assert.equal(harness.calls.includes('snapshot'), false);
        assert.equal(harness.calls.includes('cache-bust'), false);
    });

    it('allows identical purchases when each explicit command has a different operation ID', async () => {
        const harness = makeHarness();
        const first = await harness.service(
            harness.command({
                expectedExistingBlocks: undefined,
                position: undefined,
            }),
        );
        const second = await harness.service(
            harness.command({
                expectedExistingBlocks: undefined,
                operationId: 'purchase-2',
                position: undefined,
            }),
        );

        assert.equal(first.ok, true);
        assert.equal(second.ok, true);
        const state = harness.state();
        assert.equal(state.blocks.length, 3);
        assert.equal(state.debits.length, 2);
        assert.equal(state.receipts.size, 2);
    });

    it('rejects same-garden operation ID payload reuse with a conflict', async () => {
        const harness = makeHarness();
        assert.equal((await harness.service(harness.command())).ok, true);

        const conflict = await harness.service(
            harness.command({ position: { x: 1, y: 0 } }),
        );

        assert.equal(!conflict.ok && conflict.code, 'OPERATION_CONFLICT');
        assert.equal(!conflict.ok && conflict.status, 409);
        assert.equal(harness.state().debits.length, 1);
    });

    it('rejects structure-occupied placement before any write or debit', async () => {
        const harness = makeHarness({
            structures: [
                {
                    anchorX: 0,
                    anchorY: 0,
                    document: structureDocument(),
                    id: 'house-1',
                    rotation: 0,
                },
            ],
        });

        const result = await harness.service(harness.command());

        assert.equal(!result.ok && result.code, 'BLOCK_PLACEMENT_INVALID');
        const state = harness.state();
        assert.equal(state.blocks.length, 1);
        assert.equal(state.debits.length, 0);
        assert.equal(state.receipts.size, 0);
    });

    it('rolls every write back when a later debit step fails', async () => {
        const harness = makeHarness({
            blockName: 'Raised_Bed',
            failAfterDebit: true,
        });

        const result = await harness.service(harness.command());

        assert.equal(!result.ok && result.code, 'OPERATION_FAILED');
        const state = harness.state();
        assert.equal(state.balance, 1_000);
        assert.equal(state.blocks.length, 1);
        assert.equal(state.raisedBeds.length, 0);
        assert.equal(state.debits.length, 0);
        assert.equal(state.receipts.size, 0);
        assert.equal(harness.calls.includes('transaction-committed'), false);
        assert.equal(harness.calls.includes('cache-bust'), false);
    });

    it('keeps the committed purchase successful when post-commit cache invalidation fails', async (testContext) => {
        testContext.mock.method(console, 'error', () => undefined);
        const harness = makeHarness({
            blockName: 'Raised_Bed',
            failCacheBust: true,
        });

        const result = await harness.service(harness.command());

        assert.equal(result.ok, true);
        assert.deepEqual(harness.calls.slice(-2), [
            'transaction-committed',
            'cache-bust',
        ]);
        const state = harness.state();
        assert.equal(state.balance, 925);
        assert.equal(state.blocks.length, 2);
        assert.equal(state.raisedBeds.length, 1);
        assert.equal(state.debits.length, 1);
        assert.equal(state.receipts.size, 1);
    });

    it('keeps sandbox purchases free and ignores sale and night restrictions', async () => {
        const harness = makeHarness({
            availableNow: false,
            directoryPrice: 0,
            sandbox: true,
        });

        const result = await harness.service(harness.command());

        assert.equal(result.ok, true);
        assert.equal(harness.state().balance, 1_000);
        assert.equal(harness.state().debits.length, 0);
    });

    it('revalidates sale and night restrictions for normal gardens before writing', async () => {
        for (const [options, expectedCode] of [
            [{ directoryPrice: 0 }, 'BLOCK_NOT_FOR_SALE'],
            [{ availableNow: false }, 'BLOCK_NOT_PURCHASABLE_NOW'],
        ] as const) {
            const harness = makeHarness(options);

            const result = await harness.service(harness.command());

            assert.equal(!result.ok && result.code, expectedCode);
            const state = harness.state();
            assert.equal(state.blocks.length, 1);
            assert.equal(state.debits.length, 0);
            assert.equal(state.receipts.size, 0);
        }
    });

    it('returns insufficient balance without placement or receipt effects', async () => {
        const harness = makeHarness({ balance: 50, directoryPrice: 75 });

        const result = await harness.service(harness.command());

        assert.equal(!result.ok && result.code, 'INSUFFICIENT_SUNFLOWERS');
        const state = harness.state();
        assert.equal(state.balance, 50);
        assert.equal(state.blocks.length, 1);
        assert.equal(state.receipts.size, 0);
    });
});
