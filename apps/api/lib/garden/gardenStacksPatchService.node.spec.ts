import assert from 'node:assert/strict';
import { describe, it, test } from 'node:test';
import {
    AccountDeletionInProgressError,
    createAccount,
    createGardenBlock,
    createGardenStack as createGardenStackRecord,
    earnSunflowersOnce,
    type GardenPlacementTransaction,
    getGardenBlock,
    getGardenPlacementSnapshotForUpdate,
    getGardenStacks,
    getSunflowers,
    listGardenRaisedBedMetadataForUpdate,
    listGardenStructures,
    SunflowerEarnAmountConflictError,
    softDeleteGardenBlockOnce,
    softDeleteNewRaisedBedOnce,
    updateGardenStack as updateGardenStackRecord,
    withAccountDeletionFenceTransaction,
    withGardenPlacementTransaction,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import {
    type GardenStacksPatchDirectoryBlock,
    type GardenStacksPatchOperation,
    type GardenStacksPatchPlannerInput,
    planGardenStacksPatch,
} from './gardenStacksPatchPlanner';
import {
    createGardenStacksPatchService,
    type GardenStacksPatchCommand,
} from './gardenStacksPatchService';

function directoryBlock(
    name: string,
    options: Readonly<{ price?: number; raisedBed?: boolean }> = {},
): GardenStacksPatchDirectoryBlock {
    return {
        attributes: {
            height: 1,
            stackable: true,
        },
        functions: { raisedBed: options.raisedBed ?? false },
        information: { name },
        prices: { sunflowers: options.price ?? 50 },
    };
}

type HarnessState = {
    blocks: {
        deleted: boolean;
        id: string;
        name: string;
        rotation: number | null;
    }[];
    raisedBeds: {
        blockId: string;
        deleted: boolean;
        id: number;
        status: string;
    }[];
    refunds: {
        accountId: string;
        amount: number;
        reason: string;
    }[];
    stacks: {
        blocks: string[];
        positionX: number;
        positionY: number;
    }[];
    structures: GardenStacksPatchPlannerInput['snapshot']['structures'];
};

type HarnessOptions = Readonly<{
    accountFenceError?: boolean;
    createReturnsFalse?: boolean;
    destinationExists?: boolean;
    directoryFails?: boolean;
    failAfter?: string;
    failCacheBust?: boolean;
    gardenAccountId?: string;
    kind?: 'move' | 'recycle';
    price?: number;
    raisedBedStatus?: string;
    refundConflict?: boolean;
    sandbox?: boolean;
}>;

function makeHarness(options: HarnessOptions = {}) {
    const accountId = 'account-1';
    const gardenId = 17;
    const kind = options.kind ?? 'move';
    const recycledBlockId = 'recycled-block';
    const movingBlockId = 'moving-block';
    const transaction = Object.freeze({ id: 'shared-transaction' });
    const calls: string[] = [];
    const blockName =
        options.raisedBedStatus === undefined ? 'Block_Grass' : 'Raised_Bed';
    const directory = [
        directoryBlock('Block_Grass', { price: options.price ?? 75 }),
        directoryBlock('Raised_Bed', {
            price: options.price ?? 75,
            raisedBed: true,
        }),
    ];
    const destinationExists = options.destinationExists ?? true;
    let state: HarnessState =
        kind === 'recycle'
            ? {
                  blocks: [
                      {
                          deleted: false,
                          id: recycledBlockId,
                          name: blockName,
                          rotation: 0,
                      },
                  ],
                  raisedBeds:
                      options.raisedBedStatus === undefined
                          ? []
                          : [
                                {
                                    blockId: recycledBlockId,
                                    deleted: false,
                                    id: 91,
                                    status: options.raisedBedStatus,
                                },
                            ],
                  refunds: [],
                  stacks: [
                      {
                          blocks: [recycledBlockId],
                          positionX: 0,
                          positionY: 0,
                      },
                  ],
                  structures: [],
              }
            : {
                  blocks: [
                      {
                          deleted: false,
                          id: movingBlockId,
                          name: 'Block_Grass',
                          rotation: 0,
                      },
                      ...(destinationExists
                          ? [
                                {
                                    deleted: false,
                                    id: 'base-block',
                                    name: 'Block_Grass',
                                    rotation: 0,
                                },
                            ]
                          : []),
                  ],
                  raisedBeds: [],
                  refunds: [],
                  stacks: [
                      {
                          blocks: [movingBlockId],
                          positionX: destinationExists ? 0 : 2,
                          positionY: 0,
                      },
                      ...(destinationExists
                          ? [
                                {
                                    blocks: ['base-block'],
                                    positionX: 1,
                                    positionY: 0,
                                },
                            ]
                          : []),
                  ],
                  structures: [],
              };

    function cloneState() {
        return structuredClone(state);
    }

    function assertTransaction(received: unknown) {
        assert.equal(received, transaction);
    }

    function failAfter(label: string) {
        if (options.failAfter === label) {
            throw new Error(`Injected failure after ${label}`);
        }
    }

    const service = createGardenStacksPatchService({
        bustScheduleCache: async () => {
            calls.push('schedule-cache-bust');
            if (options.failCacheBust) {
                throw new Error('schedule cache unavailable');
            }
        },
        createGardenStack: async (
            receivedGardenId,
            position,
            receivedTransaction,
        ) => {
            assert.equal(receivedGardenId, gardenId);
            assertTransaction(receivedTransaction);
            const label = `stack-create:${position.x.toString()}:${position.y.toString()}`;
            calls.push(label);
            if (options.createReturnsFalse) return false;
            state.stacks.push({
                blocks: [],
                positionX: position.x,
                positionY: position.y,
            });
            failAfter(label);
            return true;
        },
        earnSunflowersOnce: async (
            receivedAccountId,
            amount,
            reason,
            receivedTransaction,
        ) => {
            assert.equal(receivedAccountId, accountId);
            assertTransaction(receivedTransaction);
            calls.push('refund');
            state.refunds.push({
                accountId: receivedAccountId,
                amount,
                reason,
            });
            if (options.refundConflict) {
                throw new SunflowerEarnAmountConflictError(
                    reason,
                    amount + 1,
                    amount,
                );
            }
            failAfter('refund');
        },
        getBlockData: async () => {
            calls.push('directory');
            if (options.directoryFails) {
                throw new Error('Directory unavailable');
            }
            return directory;
        },
        getGardenPlacementSnapshotForUpdate: async (
            receivedGardenId,
            receivedTransaction,
        ) => {
            assert.equal(receivedGardenId, gardenId);
            assertTransaction(receivedTransaction);
            calls.push('snapshot');
            return {
                blocks: state.blocks
                    .filter((block) => !block.deleted)
                    .map(({ id, name, rotation }) => ({ id, name, rotation })),
                garden: {
                    accountId: options.gardenAccountId ?? accountId,
                    id: gardenId,
                    isSandbox: options.sandbox ?? false,
                },
                stacks: state.stacks.map((stack) => ({
                    blocks: [...stack.blocks],
                    positionX: stack.positionX,
                    positionY: stack.positionY,
                })),
            };
        },
        listGardenRaisedBedMetadataForUpdate: async (
            receivedGardenId,
            receivedTransaction,
        ) => {
            assert.equal(receivedGardenId, gardenId);
            assertTransaction(receivedTransaction);
            calls.push('raised-beds');
            return state.raisedBeds
                .filter((raisedBed) => !raisedBed.deleted)
                .map(({ blockId, id, status }) => ({ blockId, id, status }));
        },
        listGardenStructures: async (receivedGardenId, receivedTransaction) => {
            assert.equal(receivedGardenId, gardenId);
            assertTransaction(receivedTransaction);
            calls.push('structures');
            return state.structures;
        },
        planGardenStacksPatch: (input) => {
            calls.push('plan');
            return planGardenStacksPatch(input);
        },
        softDeleteGardenBlockOnce: async (
            receivedGardenId,
            blockId,
            receivedTransaction,
        ) => {
            assert.equal(receivedGardenId, gardenId);
            assertTransaction(receivedTransaction);
            calls.push('block-delete');
            const block = state.blocks.find(
                (candidate) => candidate.id === blockId,
            );
            if (!block) return 'not-found';
            if (block.deleted) return 'already-deleted';
            block.deleted = true;
            failAfter('block-delete');
            return 'deleted';
        },
        softDeleteNewRaisedBedOnce: async (
            raisedBedId,
            receivedTransaction,
        ) => {
            assertTransaction(receivedTransaction);
            calls.push('raised-bed-delete');
            const raisedBed = state.raisedBeds.find(
                (candidate) =>
                    candidate.id === raisedBedId && !candidate.deleted,
            );
            if (raisedBed?.status !== 'new') return false;
            raisedBed.deleted = true;
            failAfter('raised-bed-delete');
            return true;
        },
        updateGardenStack: async (
            receivedGardenId,
            stack,
            receivedTransaction,
        ) => {
            assert.equal(receivedGardenId, gardenId);
            assertTransaction(receivedTransaction);
            const label = `stack-update:${stack.x.toString()}:${stack.y.toString()}`;
            calls.push(label);
            const current = state.stacks.find(
                (candidate) =>
                    candidate.positionX === stack.x &&
                    candidate.positionY === stack.y,
            );
            if (!current) throw new Error('Stack missing in harness');
            current.blocks = [...stack.blocks];
            failAfter(label);
        },
        withAccountDeletionFenceTransaction: async (
            receivedAccountId,
            callback,
            receivedTransaction,
        ) => {
            assert.equal(receivedAccountId, accountId);
            assertTransaction(receivedTransaction);
            calls.push('account-fence');
            if (options.accountFenceError) {
                throw new AccountDeletionInProgressError(receivedAccountId);
            }
            return callback(receivedTransaction);
        },
        withGardenPlacementTransaction: async (
            receivedGardenId,
            callback,
            receivedTransaction,
        ) => {
            assert.equal(receivedGardenId, gardenId);
            assertTransaction(receivedTransaction);
            calls.push('garden-lock');
            return callback(receivedTransaction);
        },
        withSunflowerAccountTransaction: async (
            receivedAccountId,
            callback,
        ) => {
            assert.equal(receivedAccountId, accountId);
            calls.push('sunflower-lock');
            const before = cloneState();
            try {
                return await callback(transaction);
            } catch (error) {
                state = before;
                throw error;
            }
        },
    });

    const moveCommand = (): GardenStacksPatchCommand => ({
        accountId,
        gardenId,
        operations: [
            {
                from: destinationExists ? '/0/0/0' : '/2/0/0',
                op: 'move',
                path: destinationExists ? '/1/0/-' : '/-1/0/-',
            },
        ],
    });
    const recycleCommand = (): GardenStacksPatchCommand => ({
        accountId,
        gardenId,
        operations: [{ op: 'remove', path: '/0/0/0' }],
    });

    return {
        accountId,
        calls,
        gardenId,
        moveCommand,
        recycleCommand,
        recycledBlockId,
        service,
        state: cloneState,
    };
}

describe('garden stack patch orchestration', () => {
    it('loads the directory before the lock chain and applies existing stack deltas in coordinate order', async () => {
        const harness = makeHarness();

        const result = await harness.service(harness.moveCommand());

        assert.deepEqual(result, {
            ok: true,
            appliedStackDeltas: 2,
            gardenId: harness.gardenId,
            recycledBlock: false,
            refundedSunflowers: 0,
        });
        assert.deepEqual(harness.calls, [
            'directory',
            'sunflower-lock',
            'account-fence',
            'garden-lock',
            'snapshot',
            'raised-beds',
            'structures',
            'plan',
            'stack-update:0:0',
            'stack-update:1:0',
        ]);
        assert.deepEqual(
            harness.state().stacks.map((stack) => stack.blocks),
            [[], ['base-block', 'moving-block']],
        );
    });

    it('creates a missing destination before updating deterministic deltas', async () => {
        const harness = makeHarness({ destinationExists: false });

        const result = await harness.service(harness.moveCommand());

        assert.equal(result.ok && result.appliedStackDeltas, 2);
        assert.deepEqual(harness.calls.slice(-3), [
            'stack-create:-1:0',
            'stack-update:-1:0',
            'stack-update:2:0',
        ]);
        assert.deepEqual(
            harness
                .state()
                .stacks.find(
                    (stack) => stack.positionX === -1 && stack.positionY === 0,
                )?.blocks,
            ['moving-block'],
        );
    });

    it('recycles a new raised bed, block, stack reference, and refund atomically', async () => {
        const harness = makeHarness({
            kind: 'recycle',
            price: 75,
            raisedBedStatus: 'new',
        });

        const result = await harness.service(harness.recycleCommand());

        assert.deepEqual(result, {
            ok: true,
            appliedStackDeltas: 1,
            gardenId: harness.gardenId,
            recycledBlock: true,
            refundedSunflowers: 75,
        });
        assert.deepEqual(harness.calls.slice(-5), [
            'stack-update:0:0',
            'raised-bed-delete',
            'block-delete',
            'refund',
            'schedule-cache-bust',
        ]);
        assert.deepEqual(harness.state().refunds, [
            {
                accountId: harness.accountId,
                amount: 75,
                reason: `gardenBlock:${harness.gardenId.toString()}:recycle:${harness.recycledBlockId}`,
            },
        ]);
        assert.equal(harness.state().blocks[0]?.deleted, true);
        assert.equal(harness.state().raisedBeds[0]?.deleted, true);
        assert.deepEqual(harness.state().stacks[0]?.blocks, []);
    });

    it('keeps sandbox recycling currency-free', async () => {
        const harness = makeHarness({ kind: 'recycle', sandbox: true });

        const result = await harness.service(harness.recycleCommand());

        assert.equal(result.ok && result.refundedSunflowers, 0);
        assert.equal(result.ok && result.recycledBlock, true);
        assert.equal(harness.calls.includes('refund'), false);
        assert.deepEqual(harness.state().refunds, []);
    });

    it('returns committed success when post-commit cache invalidation fails', async () => {
        const harness = makeHarness({
            failCacheBust: true,
            kind: 'recycle',
            raisedBedStatus: 'new',
        });
        const originalConsoleError = console.error;
        const reports: unknown[][] = [];
        console.error = (...args: unknown[]) => reports.push(args);

        try {
            const result = await harness.service(harness.recycleCommand());

            assert.equal(result.ok, true);
            assert.equal(harness.state().blocks[0]?.deleted, true);
            assert.equal(harness.state().raisedBeds[0]?.deleted, true);
            assert.equal(reports.length, 1);
        } finally {
            console.error = originalConsoleError;
        }
    });

    it('re-reads ownership before raised-bed, structure, planning, or write work', async () => {
        const harness = makeHarness({ gardenAccountId: 'other-account' });

        const result = await harness.service(harness.moveCommand());

        assert.deepEqual(result, {
            ok: false,
            code: 'GARDEN_NOT_FOUND',
            error: 'Garden not found',
            status: 404,
        });
        assert.deepEqual(harness.calls, [
            'directory',
            'sunflower-lock',
            'account-fence',
            'garden-lock',
            'snapshot',
        ]);
    });

    it('returns planner and known account or refund conflicts as bounded typed failures', async () => {
        const activeBed = makeHarness({
            kind: 'recycle',
            raisedBedStatus: 'active',
        });
        const accountUnavailable = makeHarness({ accountFenceError: true });
        const refundConflict = makeHarness({
            kind: 'recycle',
            refundConflict: true,
        });

        const activeResult = await activeBed.service(
            activeBed.recycleCommand(),
        );
        const accountResult = await accountUnavailable.service(
            accountUnavailable.moveCommand(),
        );
        const refundResult = await refundConflict.service(
            refundConflict.recycleCommand(),
        );

        assert.equal(activeResult.ok, false);
        assert.equal(
            !activeResult.ok && activeResult.code,
            'ACTIVE_RAISED_BED',
        );
        assert.equal(activeBed.calls.includes('block-delete'), false);
        assert.deepEqual(accountResult, {
            ok: false,
            code: 'ACCOUNT_UNAVAILABLE',
            error: 'The account is unavailable for garden changes.',
            status: 409,
        });
        assert.deepEqual(refundResult, {
            ok: false,
            code: 'SUNFLOWER_OPERATION_CONFLICT',
            error: 'Sunflower refund conflicts with an existing entry.',
            status: 409,
        });
        assert.equal(refundConflict.state().blocks[0]?.deleted, false);
        assert.deepEqual(refundConflict.state().stacks[0]?.blocks, [
            refundConflict.recycledBlockId,
        ]);
        assert.deepEqual(refundConflict.state().refunds, []);
    });

    it('rejects invalid envelopes and directory failures before entering locks', async () => {
        const invalid = makeHarness();
        const unsupported = makeHarness();
        const unavailable = makeHarness({ directoryFails: true });
        const unsupportedOperation: GardenStacksPatchOperation = {
            op: 'add',
            path: '/0/0/-',
            value: 'block',
        };

        const invalidResult = await invalid.service({
            ...invalid.moveCommand(),
            accountId: ' account-1',
        });
        const oversizedGardenResult = await invalid.service({
            ...invalid.moveCommand(),
            gardenId: 2_147_483_648,
        });
        const unsupportedResult = await unsupported.service({
            ...unsupported.moveCommand(),
            operations: [unsupportedOperation],
        });
        const unavailableResult = await unavailable.service(
            unavailable.moveCommand(),
        );

        assert.equal(
            !invalidResult.ok && invalidResult.code,
            'INVALID_REQUEST',
        );
        assert.deepEqual(invalid.calls, []);
        assert.equal(
            !oversizedGardenResult.ok && oversizedGardenResult.code,
            'INVALID_REQUEST',
        );
        assert.equal(
            !unsupportedResult.ok && unsupportedResult.code,
            'UNSUPPORTED_PATCH_SHAPE',
        );
        assert.deepEqual(unsupported.calls, []);
        assert.deepEqual(unavailableResult, {
            ok: false,
            code: 'BLOCK_DIRECTORY_UNAVAILABLE',
            error: 'Garden block directory data is unavailable',
            status: 503,
        });
        assert.deepEqual(unavailable.calls, ['directory']);
    });

    for (const scenario of [
        {
            label: 'stack creation',
            options: {
                destinationExists: false,
                failAfter: 'stack-create:-1:0',
            },
            command: 'move',
        },
        {
            label: 'stack update',
            options: {
                failAfter: 'stack-update:0:0',
                kind: 'recycle',
                raisedBedStatus: 'new',
            },
            command: 'recycle',
        },
        {
            label: 'raised-bed deletion',
            options: {
                failAfter: 'raised-bed-delete',
                kind: 'recycle',
                raisedBedStatus: 'new',
            },
            command: 'recycle',
        },
        {
            label: 'block deletion',
            options: {
                failAfter: 'block-delete',
                kind: 'recycle',
                raisedBedStatus: 'new',
            },
            command: 'recycle',
        },
        {
            label: 'refund',
            options: {
                failAfter: 'refund',
                kind: 'recycle',
                raisedBedStatus: 'new',
            },
            command: 'recycle',
        },
    ] as const) {
        it(`rolls back the shared transaction after an injected ${scenario.label} failure`, async () => {
            const harness = makeHarness(scenario.options);
            const before = harness.state();
            const command =
                scenario.command === 'move'
                    ? harness.moveCommand()
                    : harness.recycleCommand();

            await assert.rejects(
                harness.service(command),
                /Injected failure after/u,
            );

            assert.deepEqual(harness.state(), before);
        });
    }

    it('maps a stale create result and rolls back without updating either stack', async () => {
        const harness = makeHarness({
            createReturnsFalse: true,
            destinationExists: false,
        });
        const before = harness.state();

        const result = await harness.service(harness.moveCommand());

        assert.equal(!result.ok && result.code, 'GARDEN_STATE_CHANGED');
        assert.deepEqual(harness.state(), before);
        assert.equal(
            harness.calls.some((call) => call.startsWith('stack-update:')),
            false,
        );
    });
});

const storageIntegrationEnabled =
    process.env.TEST_ENV === '1' && Boolean(process.env.POSTGRES_URL);

test('real shared transaction rolls back stack, block, event, and refund after an injected final failure', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const { createTestGarden, ensureFarmId } = await import(
        '../../../../packages/storage/tests/helpers/testHelpers'
    );
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createGardenBlock(gardenId, 'Block_Grass');
    await createGardenStackRecord(gardenId, { x: 0, y: 0 });
    await updateGardenStackRecord(gardenId, {
        blocks: [blockId],
        x: 0,
        y: 0,
    });
    const beforeStacks = await getGardenStacks(gardenId);
    const beforeBalance = await getSunflowers(accountId);

    const service = createGardenStacksPatchService<GardenPlacementTransaction>({
        bustScheduleCache: async () => {},
        createGardenStack: createGardenStackRecord,
        earnSunflowersOnce: async (
            receivedAccountId,
            amount,
            reason,
            transaction,
        ) => {
            await earnSunflowersOnce(
                receivedAccountId,
                amount,
                reason,
                transaction,
            );
            throw new Error('Injected failure after real refund');
        },
        getBlockData: async () => [
            directoryBlock('Block_Grass', { price: 75 }),
        ],
        getGardenPlacementSnapshotForUpdate,
        listGardenRaisedBedMetadataForUpdate,
        listGardenStructures,
        planGardenStacksPatch,
        softDeleteGardenBlockOnce,
        softDeleteNewRaisedBedOnce,
        updateGardenStack: updateGardenStackRecord,
        withAccountDeletionFenceTransaction,
        withGardenPlacementTransaction,
        withSunflowerAccountTransaction,
    });

    await assert.rejects(
        service({
            accountId,
            gardenId,
            operations: [{ op: 'remove', path: '/0/0/0' }],
        }),
        /Injected failure after real refund/u,
    );

    assert.deepEqual(await getGardenStacks(gardenId), beforeStacks);
    assert.equal((await getGardenBlock(gardenId, blockId))?.id, blockId);
    assert.equal(await getSunflowers(accountId), beforeBalance);
});
