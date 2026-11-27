import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import {
    AccountDeletionInProgressError,
    GardenMutationOperationConflictError,
    type GardenMutationOperationKind,
    type GardenMutationOperationStoredResponse,
    hashGardenMutationOperationPayload,
    InsufficientSunflowersError,
} from '@gredice/storage';
import {
    type GardenBlockBatchPurchaseBody,
    gardenBlockBatchPurchaseResponseSchema,
} from '@gredice/storage/gardenBlockBatchPurchaseContract';
import {
    createGardenBlockBatchPurchaseReplayCheck,
    createGardenBlockBatchPurchaseService,
    type GardenBlockBatchPurchaseCommand,
    type GardenBlockBatchPurchaseDependencies,
    gardenBlockBatchPurchaseOperationPayload,
} from './gardenBlockBatchPurchaseService';

const timestamp = '2026-11-26T00:00:00.000Z';
const accountId = 'account-1';
const gardenId = 42;

function directoryBlock(
    id: number,
    name: string,
    options: Readonly<{
        nightOnlyPurchase?: boolean;
        price?: number;
        spanDepth?: number;
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
            stackable: options.stackable ?? false,
            type: options.type ?? 'decoration',
            nightOnlyPurchase: options.nightOnlyPurchase ?? false,
            ...(options.spanDepth ? { spanDepth: options.spanDepth } : {}),
        },
        prices: { sunflowers: options.price ?? 10 },
        functions: { raisedBed: name === 'Raised_Bed', recycler: false },
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

type TestTransaction = Readonly<{ id: 'shared-transaction' }>;

type Receipt = {
    kind: GardenMutationOperationKind;
    payloadHash: string;
    response: GardenMutationOperationStoredResponse;
};

type TestState = {
    balance: number;
    blocks: {
        id: string;
        name: string;
        paidSunflowers?: number | null;
        rotation: number | null;
    }[];
    debits: { amount: number; reason: string }[];
    receipts: Map<string, Receipt>;
    stacks: { blocks: string[]; positionX: number; positionY: number }[];
};

type HarnessOptions = Readonly<{
    availableNow?: boolean;
    balance?: number;
    blockData?: readonly BlockData[];
    directoryFails?: () => boolean;
    failAppend?: boolean;
    fenceError?: Error;
    gardenAccountId?: string;
    sandbox?: boolean;
    stacks?: TestState['stacks'];
    blocks?: TestState['blocks'];
}>;

const defaultBlockData = [
    directoryBlock(1, 'Block_Grass', {
        price: 5,
        stackable: true,
        type: 'terrain',
    }),
    directoryBlock(2, 'Bush', { price: 10 }),
    directoryBlock(3, 'ChickenCoop', { price: 100 }),
    directoryBlock(4, 'Raised_Bed', { price: 75 }),
    directoryBlock(5, 'WoodenSign', { price: 15 }),
    directoryBlock(6, 'GiftBox_Red', { price: 1 }),
    directoryBlock(7, 'FishingBoat', { price: 40, spanDepth: 2 }),
    directoryBlock(8, 'NightLantern', { nightOnlyPurchase: true, price: 20 }),
    directoryBlock(9, 'FreeStone', { price: 0 }),
    directoryBlock(10, 'BirdHouse', { price: 30 }),
    directoryBlock(11, 'HedgehogShelter', { price: 35 }),
];

function cloneState(state: TestState): TestState {
    return {
        balance: state.balance,
        blocks: state.blocks.map((block) => ({ ...block })),
        debits: state.debits.map((debit) => ({ ...debit })),
        receipts: new Map(
            [...state.receipts].map(([key, receipt]) => [key, { ...receipt }]),
        ),
        stacks: state.stacks.map((stack) => ({
            ...stack,
            blocks: [...stack.blocks],
        })),
    };
}

function isStoredResponse(
    value: unknown,
): value is GardenMutationOperationStoredResponse {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function makeHarness(options: HarnessOptions = {}) {
    const transaction: TestTransaction = { id: 'shared-transaction' };
    const calls: string[] = [];
    const createBlockCalls: unknown[][] = [];
    const appendCalls: unknown[][] = [];
    let gardenActive = true;
    let transactionActive = false;
    let nextBlockId = 1;
    let state: TestState = {
        balance: options.balance ?? 1_000,
        blocks: options.blocks ?? [
            { id: 'ground-1', name: 'Block_Grass', rotation: 0 },
            { id: 'ground-2', name: 'Block_Grass', rotation: 0 },
            { id: 'ground-3', name: 'Block_Grass', rotation: 0 },
            { id: 'ground-4', name: 'Block_Grass', rotation: 0 },
            { id: 'bush-1', name: 'Bush', rotation: 0 },
        ],
        debits: [],
        receipts: new Map(),
        stacks: options.stacks ?? [
            { blocks: ['ground-1'], positionX: 0, positionY: 0 },
            { blocks: ['ground-2'], positionX: 1, positionY: 0 },
            { blocks: ['ground-3'], positionX: 2, positionY: 0 },
            { blocks: ['ground-4', 'bush-1'], positionX: 3, positionY: 0 },
        ],
    };

    const dependencies: GardenBlockBatchPurchaseDependencies<TestTransaction> =
        {
            appendBlocksToGardenStacks: async (
                receivedGardenId,
                stacks,
                receivedTransaction,
            ) => {
                assert.equal(receivedGardenId, gardenId);
                assert.equal(receivedTransaction, transaction);
                appendCalls.push([...stacks]);
                calls.push('append-stacks');
                for (const stack of stacks) {
                    const target = state.stacks.find(
                        (candidate) =>
                            candidate.positionX === stack.x &&
                            candidate.positionY === stack.y,
                    );
                    if (target) target.blocks = [...stack.blocks];
                    else
                        state.stacks.push({
                            blocks: [...stack.blocks],
                            positionX: stack.x,
                            positionY: stack.y,
                        });
                }
                if (options.failAppend) {
                    throw new Error('Injected failure after bulk insert');
                }
            },
            createGardenBlocks: async (
                receivedGardenId,
                blocks,
                receivedTransaction,
            ) => {
                assert.equal(receivedGardenId, gardenId);
                assert.equal(receivedTransaction, transaction);
                createBlockCalls.push([...blocks]);
                calls.push('create-blocks');
                return blocks.map((block) => {
                    const id = `placed-${nextBlockId.toString()}`;
                    nextBlockId += 1;
                    state.blocks.push({
                        id,
                        name: block.name,
                        paidSunflowers: block.paidSunflowers,
                        rotation: block.rotation ?? null,
                    });
                    return id;
                });
            },
            debitSunflowers: async (
                receivedAccountId,
                amount,
                reason,
                receivedTransaction,
            ) => {
                assert.equal(receivedAccountId, accountId);
                assert.equal(receivedTransaction, transaction);
                calls.push('debit');
                if (state.balance < amount) {
                    throw new InsufficientSunflowersError(
                        state.balance,
                        amount,
                    );
                }
                state.balance -= amount;
                state.debits.push({ amount, reason });
            },
            getBlockData: async () => {
                assert.equal(transactionActive, false);
                calls.push('directory');
                if (options.directoryFails?.()) {
                    throw new Error('Directory unavailable');
                }
                return options.blockData ?? defaultBlockData;
            },
            getGardenLocation: async (_gardenId, receivedTransaction) => {
                assert.equal(receivedTransaction, transaction);
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
            now: () => new Date('2026-11-26T12:00:00.000Z'),
            withAccountDeletionFenceTransaction: async (
                _accountId,
                callback,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                calls.push('deletion-fence');
                if (options.fenceError) throw options.fenceError;
                return callback(transaction);
            },
            withGardenMutationOperation: async (
                input,
                callback,
                receivedTransaction,
            ) => {
                assert.equal(receivedTransaction, transaction);
                assert.equal(input.kind, 'block-purchase-batch');
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
                // The real repository applies the same canonical size limits
                // to the stored response.
                hashGardenMutationOperationPayload(mutation.response);
                const response = JSON.parse(JSON.stringify(mutation.response));
                if (!isStoredResponse(response)) {
                    throw new TypeError('Expected stored response object');
                }
                const receipt = { kind: input.kind, payloadHash, response };
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
                transactionActive = true;
                try {
                    const result = await callback(transaction);
                    calls.push('transaction-committed');
                    return result;
                } catch (error) {
                    state = before;
                    throw error;
                } finally {
                    transactionActive = false;
                }
            },
        };

    const service = createGardenBlockBatchPurchaseService(dependencies);
    const command = (
        overrides: Partial<GardenBlockBatchPurchaseCommand> = {},
    ): GardenBlockBatchPurchaseCommand => ({
        accountId,
        gardenId,
        operationId: '5f0c8a8e-8d4f-4b8e-9d6a-1b2c3d4e5f60',
        blockName: 'Bush',
        rotation: 0,
        expectedUnitPrice: 10,
        placements: [
            {
                position: { x: 1, y: 0 },
                expectedExistingBlocks: ['ground-2'],
            },
            {
                position: { x: 0, y: 0 },
                expectedExistingBlocks: ['ground-1'],
            },
        ],
        ...overrides,
    });

    return {
        appendCalls,
        calls,
        command,
        createBlockCalls,
        service,
        softDeleteGarden: () => {
            gardenActive = false;
        },
        state: () => cloneState(state),
        addReceipt: (operationId: string, receipt: Receipt) => {
            state.receipts.set(operationId, receipt);
        },
    };
}

function assertNoWrites(
    harness: ReturnType<typeof makeHarness>,
    before: TestState,
) {
    const after = harness.state();
    assert.equal(after.balance, before.balance);
    assert.deepEqual(after.blocks, before.blocks);
    assert.deepEqual(after.stacks, before.stacks);
    assert.deepEqual(after.debits, before.debits);
    assert.equal(after.receipts.size, before.receipts.size);
}

describe('purchaseGardenBlockBatch', () => {
    it('places every copy with one debit, one bulk insert and one stack write, in request order', async () => {
        const harness = makeHarness();
        const result = await harness.service(harness.command());

        assert.ok(result.ok);
        const { ok: _ok, ...response } = result;
        assert.deepEqual(
            gardenBlockBatchPurchaseResponseSchema.parse(response),
            {
                operationId: '5f0c8a8e-8d4f-4b8e-9d6a-1b2c3d4e5f60',
                blockName: 'Bush',
                rotation: 0,
                unitPrice: 10,
                chargedSunflowers: 20,
                placements: [
                    { id: 'placed-1', position: { x: 1, y: 0 } },
                    { id: 'placed-2', position: { x: 0, y: 0 } },
                ],
                replayed: false,
            },
        );
        const state = harness.state();
        assert.deepEqual(state.debits, [
            {
                amount: 20,
                reason: 'gardenBlock:42:expand:5f0c8a8e-8d4f-4b8e-9d6a-1b2c3d4e5f60',
            },
        ]);
        assert.equal(state.balance, 980);
        assert.equal(harness.createBlockCalls.length, 1);
        assert.deepEqual(harness.createBlockCalls[0], [
            { name: 'Bush', paidSunflowers: 10, rotation: 0, variant: null },
            { name: 'Bush', paidSunflowers: 10, rotation: 0, variant: null },
        ]);
        assert.equal(harness.appendCalls.length, 1);
        assert.deepEqual(harness.appendCalls[0], [
            { x: 1, y: 0, blocks: ['ground-2', 'placed-1'] },
            { x: 0, y: 0, blocks: ['ground-1', 'placed-2'] },
        ]);
        assert.deepEqual(harness.calls, [
            'directory',
            'sunflower-lock',
            'deletion-fence',
            'garden-lock',
            'authority',
            'operation-receipt',
            'snapshot',
            'location',
            'debit',
            'create-blocks',
            'append-stacks',
            'transaction-committed',
        ]);
        assert.equal(state.receipts.size, 1);
    });

    it('normalizes rotation 5 to 1 and null to 0 before writing, hashing and replying', async () => {
        for (const [requested, expected] of [
            [5, 1],
            [null, 0],
            [-1, 3],
        ] as const) {
            const harness = makeHarness();
            const result = await harness.service(
                harness.command({ rotation: requested }),
            );
            assert.ok(result.ok);
            assert.equal(result.rotation, expected);
            for (const block of harness.createBlockCalls[0] ?? []) {
                assert.deepEqual(block, {
                    name: 'Bush',
                    paidSunflowers: 10,
                    rotation: expected,
                    variant: null,
                });
            }
        }

        const harness = makeHarness();
        const first = await harness.service(harness.command({ rotation: 5 }));
        const replay = await harness.service(harness.command({ rotation: 1 }));
        assert.ok(first.ok && replay.ok);
        assert.equal(replay.replayed, true);
        assert.equal(harness.state().debits.length, 1);
    });

    it('is free in sandbox gardens and requires an expected price of 0 there', async () => {
        const harness = makeHarness({ sandbox: true, balance: 0 });
        const result = await harness.service(
            harness.command({ expectedUnitPrice: 0 }),
        );
        assert.ok(result.ok);
        assert.equal(result.unitPrice, 0);
        assert.equal(result.chargedSunflowers, 0);
        assert.deepEqual(harness.state().debits, []);
        assert.ok(!harness.calls.includes('debit'));
        assert.ok(!harness.calls.includes('location'));
        for (const block of harness.createBlockCalls[0] ?? []) {
            assert.equal(
                block !== null &&
                    typeof block === 'object' &&
                    'paidSunflowers' in block
                    ? block.paidSunflowers
                    : undefined,
                0,
            );
        }

        const priced = makeHarness({ sandbox: true });
        const before = priced.state();
        const rejected = await priced.service(
            priced.command({
                expectedUnitPrice: 10,
                operationId: randomUUID(),
            }),
        );
        assert.deepEqual(rejected, {
            ok: false,
            code: 'PRICE_CHANGED',
            details: { unitPrice: 0 },
            error: 'Requested block price changed',
            status: 409,
        });
        assertNoWrites(priced, before);
    });

    it('rejects an unaffordable batch with the affordable count and writes nothing', async () => {
        const harness = makeHarness({ balance: 15 });
        const before = harness.state();
        const result = await harness.service(harness.command());
        assert.deepEqual(result, {
            ok: false,
            code: 'INSUFFICIENT_SUNFLOWERS',
            details: {
                affordableCount: 1,
                availableAmount: 15,
                requiredAmount: 20,
            },
            error: 'Insufficient sunflowers',
            status: 400,
        });
        assertNoWrites(harness, before);
        assert.equal(harness.createBlockCalls.length, 0);
        assert.equal(harness.appendCalls.length, 0);
    });

    it('returns every stack and placement conflict as 409 and writes nothing', async () => {
        const harness = makeHarness();
        const before = harness.state();
        const result = await harness.service(
            harness.command({
                placements: [
                    {
                        position: { x: 0, y: 0 },
                        expectedExistingBlocks: ['ground-1'],
                    },
                    {
                        position: { x: 1, y: 0 },
                        expectedExistingBlocks: ['ground-2'],
                    },
                    {
                        position: { x: 3, y: 0 },
                        expectedExistingBlocks: ['ground-4', 'bush-1'],
                    },
                    {
                        position: { x: 2, y: 0 },
                        expectedExistingBlocks: [],
                    },
                ],
            }),
        );
        assert.deepEqual(result, {
            ok: false,
            code: 'GARDEN_STATE_CHANGED',
            details: {
                conflicts: [
                    { index: 2, reason: 'invalid-placement' },
                    { index: 3, reason: 'stack-changed' },
                ],
            },
            error: 'Garden changed since the expansion was planned',
            status: 409,
        });
        assertNoWrites(harness, before);
        assert.ok(!harness.calls.includes('debit'));
    });

    it('rejects a bounding box wider than 10 cells before any write', async () => {
        const emptyStacks = makeHarness({ stacks: [], blocks: [] });
        const before = emptyStacks.state();
        const result = await emptyStacks.service(
            emptyStacks.command({
                blockName: 'Block_Grass',
                expectedUnitPrice: 5,
                placements: Array.from({ length: 11 }, (_, x) => ({
                    position: { x, y: 0 },
                    expectedExistingBlocks: [],
                })),
            }),
        );
        assert.deepEqual(result, {
            ok: false,
            code: 'EXPANSION_AREA_TOO_LARGE',
            details: { maxPlacements: 100, maxSide: 10 },
            error: 'Expansion area is too large',
            status: 400,
        });
        assertNoWrites(emptyStacks, before);

        const fits = makeHarness({ stacks: [], blocks: [] });
        const accepted = await fits.service(
            fits.command({
                blockName: 'Block_Grass',
                expectedUnitPrice: 5,
                placements: Array.from({ length: 10 }, (_, x) => ({
                    position: { x: x - 5, y: 3 },
                    expectedExistingBlocks: [],
                })),
            }),
        );
        assert.ok(accepted.ok);
        assert.equal(accepted.chargedSunflowers, 50);
    });

    it('re-checks price, sale, night-only and Expand eligibility on the server', async () => {
        const cases: readonly [
            Partial<GardenBlockBatchPurchaseCommand>,
            HarnessOptions,
            Readonly<Record<string, unknown>>,
        ][] = [
            [
                { expectedUnitPrice: 9 },
                {},
                {
                    code: 'PRICE_CHANGED',
                    status: 409,
                    details: { unitPrice: 10 },
                },
            ],
            [
                { blockName: 'FreeStone', expectedUnitPrice: 0 },
                {},
                { code: 'BLOCK_NOT_FOR_SALE', status: 400 },
            ],
            [
                { blockName: 'NightLantern', expectedUnitPrice: 20 },
                { availableNow: false },
                { code: 'BLOCK_NOT_PURCHASABLE_NOW', status: 400 },
            ],
            [
                { blockName: 'ChickenCoop', expectedUnitPrice: 100 },
                {},
                {
                    code: 'BLOCK_NOT_EXPANDABLE',
                    status: 400,
                    details: { reason: 'animal' },
                },
            ],
            [
                { blockName: 'BirdHouse', expectedUnitPrice: 30 },
                {},
                {
                    code: 'BLOCK_NOT_EXPANDABLE',
                    status: 400,
                    details: { reason: 'animal' },
                },
            ],
            [
                { blockName: 'HedgehogShelter', expectedUnitPrice: 35 },
                {},
                {
                    code: 'BLOCK_NOT_EXPANDABLE',
                    status: 400,
                    details: { reason: 'animal' },
                },
            ],
            [
                { blockName: 'Raised_Bed', expectedUnitPrice: 75 },
                {},
                {
                    code: 'BLOCK_NOT_EXPANDABLE',
                    status: 400,
                    details: { reason: 'raised-bed' },
                },
            ],
            [
                { blockName: 'WoodenSign', expectedUnitPrice: 15 },
                {},
                {
                    code: 'BLOCK_NOT_EXPANDABLE',
                    status: 400,
                    details: { reason: 'per-block-content' },
                },
            ],
            [
                { blockName: 'GiftBox_Red', expectedUnitPrice: 1 },
                {},
                {
                    code: 'BLOCK_NOT_EXPANDABLE',
                    status: 400,
                    details: { reason: 'gift-box' },
                },
            ],
            [
                { blockName: 'FishingBoat', expectedUnitPrice: 40 },
                {},
                {
                    code: 'BLOCK_NOT_EXPANDABLE',
                    status: 400,
                    details: { reason: 'multi-cell' },
                },
            ],
            [
                { blockName: 'Unknown', expectedUnitPrice: 1 },
                {},
                { code: 'BLOCK_NOT_FOUND', status: 404 },
            ],
        ];
        for (const [overrides, options, expected] of cases) {
            const harness = makeHarness(options);
            const before = harness.state();
            const result = await harness.service(harness.command(overrides));
            assert.equal(result.ok, false, JSON.stringify(overrides));
            assert.ok(!result.ok);
            assert.equal(result.code, expected.code);
            assert.equal(result.status, expected.status);
            if (expected.details) {
                assert.deepEqual(result.details, expected.details);
            }
            assertNoWrites(harness, before);
        }
    });

    it('replays the stored receipt without a second debit, even when the directory is down', async () => {
        let directoryDown = false;
        const harness = makeHarness({ directoryFails: () => directoryDown });
        const first = await harness.service(harness.command());
        directoryDown = true;
        harness.softDeleteGarden();
        const replay = await harness.service(harness.command());

        assert.ok(first.ok && replay.ok);
        assert.equal(first.replayed, false);
        assert.equal(replay.replayed, true);
        assert.deepEqual(
            { ...replay, replayed: false },
            { ...first, replayed: false },
        );
        const state = harness.state();
        assert.equal(state.debits.length, 1);
        assert.equal(state.balance, 980);
        assert.equal(harness.createBlockCalls.length, 1);
    });

    it('rejects an operation ID reused with a different payload or by a single purchase', async () => {
        const harness = makeHarness();
        await harness.service(harness.command());
        const before = harness.state();
        const changed = await harness.service(
            harness.command({
                placements: [
                    {
                        position: { x: 2, y: 0 },
                        expectedExistingBlocks: ['ground-3'],
                    },
                ],
            }),
        );
        assert.equal(changed.ok, false);
        assert.ok(!changed.ok);
        assert.equal(changed.code, 'OPERATION_CONFLICT');
        assert.equal(changed.status, 409);
        assertNoWrites(harness, before);

        const single = makeHarness();
        const operationId = randomUUID();
        single.addReceipt(operationId, {
            kind: 'block-purchase',
            payloadHash: hashGardenMutationOperationPayload({ single: true }),
            response: { id: 'placed-single' },
        });
        const singleBefore = single.state();
        const reused = await single.service(single.command({ operationId }));
        assert.ok(!reused.ok);
        assert.equal(reused.code, 'OPERATION_CONFLICT');
        assertNoWrites(single, singleBefore);
    });

    it('keeps the receipt payload small for 99 placements on seven-high stacks', async () => {
        const stacks: TestState['stacks'] = [];
        const blocks: TestState['blocks'] = [];
        for (let x = 0; x < 10; x++) {
            for (let y = 0; y < 10; y++) {
                if (x === 0 && y === 0) continue;
                const ids = Array.from({ length: 7 }, () => randomUUID());
                for (const id of ids) {
                    blocks.push({ id, name: 'Block_Grass', rotation: 0 });
                }
                stacks.push({ blocks: ids, positionX: x, positionY: y });
            }
        }
        const harness = makeHarness({ stacks, blocks });
        const command = harness.command({
            placements: stacks.map((stack) => ({
                position: { x: stack.positionX, y: stack.positionY },
                expectedExistingBlocks: [...stack.blocks],
            })),
        });
        const payload = gardenBlockBatchPurchaseOperationPayload(
            {
                ...command,
                placements: command.placements.map((placement) => ({
                    position: { ...placement.position },
                    expectedExistingBlocks: [
                        ...placement.expectedExistingBlocks,
                    ],
                })),
            },
            0,
        );
        const payloadBytes = Buffer.byteLength(JSON.stringify(payload));
        assert.ok(payloadBytes < 12 * 1024, `payload ${payloadBytes} bytes`);
        const rawBytes = Buffer.byteLength(JSON.stringify(command.placements));
        assert.ok(rawBytes > payloadBytes * 2);

        const result = await harness.service(command);
        assert.ok(result.ok);
        assert.equal(result.placements.length, 99);
        assert.equal(result.chargedSunflowers, 990);
        assert.equal(harness.createBlockCalls.length, 1);
        assert.equal(harness.appendCalls.length, 1);
    });

    it('hides gardens of other accounts and deleted gardens as 404', async () => {
        const foreign = makeHarness({ gardenAccountId: 'account-2' });
        const foreignBefore = foreign.state();
        const foreignResult = await foreign.service(foreign.command());
        assert.ok(!foreignResult.ok);
        assert.equal(foreignResult.code, 'GARDEN_NOT_FOUND');
        assert.equal(foreignResult.status, 404);
        assert.ok(!foreign.calls.includes('operation-receipt'));
        assertNoWrites(foreign, foreignBefore);

        const deleted = makeHarness();
        deleted.softDeleteGarden();
        const deletedBefore = deleted.state();
        const deletedResult = await deleted.service(deleted.command());
        assert.ok(!deletedResult.ok);
        assert.equal(deletedResult.code, 'GARDEN_NOT_FOUND');
        assertNoWrites(deleted, deletedBefore);
    });

    it('maps a missing directory to 503 and unexpected failures to 500 with ids in the log', async () => {
        const unavailable = makeHarness({ directoryFails: () => true });
        const unavailableResult = await unavailable.service(
            unavailable.command(),
        );
        assert.ok(!unavailableResult.ok);
        assert.equal(unavailableResult.code, 'BLOCK_DIRECTORY_UNAVAILABLE');
        assert.equal(unavailableResult.status, 503);

        const failing = makeHarness({ failAppend: true });
        const before = failing.state();
        const logged: unknown[][] = [];
        const originalError = console.error;
        console.error = (...args: unknown[]) => {
            logged.push(args);
        };
        try {
            const result = await failing.service(failing.command());
            assert.deepEqual(result, {
                ok: false,
                code: 'OPERATION_FAILED',
                details: {},
                error: 'Failed to place garden block batch',
                status: 500,
            });
        } finally {
            console.error = originalError;
        }
        assertNoWrites(failing, before);
        assert.equal(logged.length, 1);
        const [message, context] = logged[0] ?? [];
        assert.equal(message, 'Failed to place garden block batch atomically');
        assert.ok(context !== null && typeof context === 'object');
        assert.ok('gardenId' in context && context.gardenId === gardenId);
        assert.ok(
            'operationId' in context &&
                context.operationId === '5f0c8a8e-8d4f-4b8e-9d6a-1b2c3d4e5f60',
        );
        assert.ok('placementCount' in context && context.placementCount === 2);
        assert.ok(!('accountId' in context));
    });

    it('rejects malformed commands before taking any lock', async () => {
        const harness = makeHarness();
        for (const overrides of [
            { operationId: 'not-a-uuid' },
            {
                placements: [
                    {
                        position: { x: 0, y: 0 },
                        expectedExistingBlocks: ['ground-1'],
                    },
                    {
                        position: { x: 0, y: 0 },
                        expectedExistingBlocks: ['ground-1'],
                    },
                ],
            },
            { placements: [] },
            { expectedUnitPrice: -1 },
            { rotation: 1.5 },
        ] satisfies Partial<GardenBlockBatchPurchaseCommand>[]) {
            const result = await harness.service(harness.command(overrides));
            assert.ok(!result.ok);
            assert.equal(result.code, 'INVALID_REQUEST');
            assert.equal(result.status, 400);
        }
        assert.deepEqual(harness.calls, []);
    });

    it('reports an account deletion in progress as a garden state change', async () => {
        const harness = makeHarness({
            fenceError: new AccountDeletionInProgressError(accountId),
        });
        const result = await harness.service(harness.command());
        assert.deepEqual(result, {
            ok: false,
            code: 'GARDEN_STATE_CHANGED',
            details: { conflicts: [] },
            error: 'Account is being deleted',
            status: 409,
        });
    });
});

describe('isGardenBlockBatchPurchaseReplay', () => {
    const body: GardenBlockBatchPurchaseBody = {
        operationId: randomUUID(),
        blockName: 'Bush',
        rotation: 5,
        expectedUnitPrice: 10,
        placements: [
            { position: { x: 1, y: 0 }, expectedExistingBlocks: ['ground-1'] },
            { position: { x: 2, y: 0 }, expectedExistingBlocks: [] },
        ],
    };
    // The service stores the hash of the normalized payload (rotation 1).
    const storedHash = hashGardenMutationOperationPayload(
        gardenBlockBatchPurchaseOperationPayload(body, 1),
    );

    function replayCheck(
        receipt: Readonly<{ kind: string; payloadHash: string }> | null,
    ) {
        const reads: Readonly<{ gardenId: number; operationId: string }>[] = [];
        const check = createGardenBlockBatchPurchaseReplayCheck({
            getGardenMutationOperationReceipt: async (input) => {
                reads.push(input);
                return receipt;
            },
            warn: () => assert.fail('Unexpected warning'),
        });
        return { check, reads };
    }

    it('recognizes an exact retry of a committed batch by its stored payload hash', async () => {
        const { check, reads } = replayCheck({
            kind: 'block-purchase-batch',
            payloadHash: storedHash,
        });

        assert.equal(await check({ body, gardenId }), true);
        // Rotation 1 is the same command as 5 after normalization.
        assert.equal(
            await check({ body: { ...body, rotation: 1 }, gardenId }),
            true,
        );
        assert.deepEqual(reads[0], { gardenId, operationId: body.operationId });
    });

    it('rejects a new command, another payload or another receipt kind', async () => {
        assert.equal(await replayCheck(null).check({ body, gardenId }), false);
        const stored = replayCheck({
            kind: 'block-purchase-batch',
            payloadHash: storedHash,
        });
        for (const changed of [
            { ...body, expectedUnitPrice: 11 },
            { ...body, rotation: 2 },
            { ...body, placements: body.placements.slice(0, 1) },
            {
                ...body,
                placements: [
                    {
                        position: { x: 1, y: 0 },
                        expectedExistingBlocks: ['ground-2'],
                    },
                    { position: { x: 2, y: 0 }, expectedExistingBlocks: [] },
                ],
            },
        ]) {
            assert.equal(
                await stored.check({ body: changed, gardenId }),
                false,
            );
        }
        assert.equal(
            await replayCheck({
                kind: 'block-purchase',
                payloadHash: storedHash,
            }).check({ body, gardenId }),
            false,
        );
    });

    it('treats a failed read as not a replay and logs no account data', async () => {
        const warnings: Readonly<Record<string, unknown>>[] = [];
        const check = createGardenBlockBatchPurchaseReplayCheck({
            getGardenMutationOperationReceipt: async () => {
                throw new TypeError('connection reset');
            },
            warn: (_message, context) => {
                warnings.push(context);
            },
        });

        assert.equal(await check({ body, gardenId }), false);
        assert.deepEqual(warnings, [
            {
                errorName: 'TypeError',
                gardenId,
                operationId: body.operationId,
            },
        ]);
    });
});
