import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import { woodenSignBlockName } from '@gredice/js/woodenSign';
import {
    createGardenBlockMutationService,
    type ValidateRotatedBlockPlacementInput,
    type ValidateRotatedBlockPlacementResult,
} from './gardenBlockMutationService';
import type {
    GardenOccupancyStorageSnapshotLike,
    ValidatePersistedStructuresAfterBlockMutationResult,
} from './gardenOccupancyService';

const timestamp = '2026-08-30T00:00:00.000Z';

function directoryBlock(
    id: number,
    name: string,
    sunflowers: number,
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
        },
        prices: { sunflowers },
        functions: { raisedBed: name === 'Raised_Bed', recycler: false },
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

type HarnessOptions = Readonly<{
    blockName?: string;
    combinedValidation?: (
        snapshot: GardenOccupancyStorageSnapshotLike,
    ) => ValidatePersistedStructuresAfterBlockMutationResult;
    failRefund?: boolean;
    failCacheBust?: boolean;
    gardenAccountId?: string;
    price?: number;
    raisedBedStatus?: string;
    rotationValidation?: (
        input: ValidateRotatedBlockPlacementInput,
    ) => Promise<ValidateRotatedBlockPlacementResult>;
    sandbox?: boolean;
}>;

type HarnessState = {
    blocks: {
        id: string;
        message: string | null;
        name: string;
        rotation: number | null;
        variant: number | null;
    }[];
    cacheBusts: number;
    raisedBeds: {
        blockId: string;
        deleted: boolean;
        id: number;
        orientation: 'horizontal' | 'vertical';
        status: string;
    }[];
    refunds: {
        accountId: string;
        amount: number;
        reason: string;
    }[];
    stacks: {
        blocks: string[];
        id: number;
        positionX: number;
        positionY: number;
    }[];
};

function makeHarness(options: HarnessOptions = {}) {
    const accountId = 'account-1';
    const blockName = options.blockName ?? 'Shade';
    const blockId = 'block-1';
    const gardenId = 7;
    const transaction = { id: 'shared-transaction' };
    const calls: string[] = [];
    const blockData = [
        directoryBlock(1, 'Block_Grass', 0),
        directoryBlock(2, blockName, options.price ?? 25),
    ];
    let state: HarnessState = {
        blocks: [
            {
                id: 'support-1',
                message: null,
                name: 'Block_Grass',
                rotation: 0,
                variant: null,
            },
            {
                id: blockId,
                message: null,
                name: blockName,
                rotation: 0,
                variant: blockName === 'Rabbit' ? 1 : null,
            },
        ],
        cacheBusts: 0,
        raisedBeds:
            options.raisedBedStatus === undefined
                ? []
                : [
                      {
                          blockId,
                          deleted: false,
                          id: 91,
                          orientation: 'horizontal',
                          status: options.raisedBedStatus,
                      },
                  ],
        refunds: [],
        stacks: [
            {
                blocks: ['support-1', blockId],
                id: 11,
                positionX: 2,
                positionY: -3,
            },
        ],
    };

    function cloneState() {
        return structuredClone(state);
    }

    function assertTransaction(received: typeof transaction) {
        assert.equal(received, transaction);
    }

    const service = createGardenBlockMutationService<typeof transaction>({
        bustScheduleCache: async () => {
            calls.push('cache-bust');
            state.cacheBusts += 1;
            if (options.failCacheBust) {
                throw new Error('schedule cache unavailable');
            }
        },
        earnSunflowersOnce: async (
            receivedAccountId,
            amount,
            reason,
            receivedTransaction,
        ) => {
            assertTransaction(receivedTransaction);
            calls.push('refund');
            if (options.failRefund) {
                throw new Error('refund failed');
            }
            state.refunds.push({
                accountId: receivedAccountId,
                amount,
                reason,
            });
        },
        getBlockData: async () => {
            calls.push('catalog');
            return blockData;
        },
        getGardenPlacementSnapshotForUpdate: async (
            receivedGardenId,
            receivedTransaction,
        ) => {
            assert.equal(receivedGardenId, gardenId);
            assertTransaction(receivedTransaction);
            calls.push('snapshot');
            return {
                garden: {
                    accountId: options.gardenAccountId ?? accountId,
                    id: gardenId,
                    isSandbox: options.sandbox ?? false,
                },
                blocks: structuredClone(state.blocks),
                stacks: structuredClone(state.stacks),
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
                .map(({ deleted: _deleted, ...raisedBed }) => ({
                    ...raisedBed,
                }));
        },
        listGardenStructures: async (receivedGardenId, receivedTransaction) => {
            assert.equal(receivedGardenId, gardenId);
            assertTransaction(receivedTransaction);
            calls.push('structures');
            return [];
        },
        softDeleteGardenBlockOnce: async (
            receivedGardenId,
            receivedBlockId,
            receivedTransaction,
        ) => {
            assert.equal(receivedGardenId, gardenId);
            assertTransaction(receivedTransaction);
            calls.push('block-delete');
            const blockIndex = state.blocks.findIndex(
                (block) => block.id === receivedBlockId,
            );
            if (blockIndex < 0) return 'not-found';
            state.blocks.splice(blockIndex, 1);
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
                    candidate.id === raisedBedId &&
                    !candidate.deleted &&
                    candidate.status === 'new',
            );
            if (!raisedBed) return false;
            raisedBed.deleted = true;
            return true;
        },
        updateGardenBlock: async (
            receivedGardenId,
            update,
            receivedTransaction,
        ) => {
            assert.equal(receivedGardenId, gardenId);
            assertTransaction(receivedTransaction);
            calls.push('block-update');
            const block = state.blocks.find(
                (candidate) => candidate.id === update.id,
            );
            if (!block) return false;
            if (update.message !== undefined) block.message = update.message;
            if (update.rotation !== undefined) block.rotation = update.rotation;
            if (update.variant !== undefined) block.variant = update.variant;
            return true;
        },
        updateGardenStack: async (
            receivedGardenId,
            update,
            receivedTransaction,
        ) => {
            assert.equal(receivedGardenId, gardenId);
            assertTransaction(receivedTransaction);
            calls.push('stack-update');
            const stack = state.stacks.find(
                (candidate) =>
                    candidate.positionX === update.x &&
                    candidate.positionY === update.y,
            );
            assert.ok(stack);
            stack.blocks = [...update.blocks];
        },
        updateRaisedBedOrientation: async (
            raisedBedId,
            orientation,
            receivedTransaction,
        ) => {
            assertTransaction(receivedTransaction);
            calls.push('raised-bed-orientation');
            const raisedBed = state.raisedBeds.find(
                (candidate) =>
                    candidate.id === raisedBedId && !candidate.deleted,
            );
            if (!raisedBed) return false;
            raisedBed.orientation = orientation;
            return true;
        },
        validatePersistedStructuresAfterBlockMutation: ({ snapshot }) => {
            calls.push('combined-validation');
            return options.combinedValidation?.(snapshot) ?? { valid: true };
        },
        validateRotatedBlockPlacement:
            options.rotationValidation ??
            (async () => {
                calls.push('rotation-validation');
                return { valid: true };
            }),
        withAccountDeletionFenceTransaction: async (
            receivedAccountId,
            callback,
            receivedTransaction,
        ) => {
            assert.equal(receivedAccountId, accountId);
            assertTransaction(receivedTransaction);
            calls.push('account-fence');
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

    return {
        accountId,
        blockId,
        calls,
        gardenId,
        service,
        state: () => cloneState(),
    };
}

describe('recycleGardenBlockForAccount', () => {
    it('locks account then garden and commits stack, bed, block, and idempotent refund together', async () => {
        const harness = makeHarness({ raisedBedStatus: 'new' });

        const result = await harness.service.recycleGardenBlockForAccount({
            accountId: harness.accountId,
            blockId: harness.blockId,
            gardenId: harness.gardenId,
        });

        assert.deepEqual(result, {
            ok: true,
            blockId: harness.blockId,
            refundedSunflowers: 25,
        });
        assert.deepEqual(harness.calls, [
            'catalog',
            'sunflower-lock',
            'account-fence',
            'garden-lock',
            'snapshot',
            'raised-beds',
            'structures',
            'combined-validation',
            'stack-update',
            'raised-bed-delete',
            'block-delete',
            'refund',
            'cache-bust',
        ]);
        const state = harness.state();
        assert.deepEqual(state.stacks[0]?.blocks, ['support-1']);
        assert.equal(
            state.blocks.some((block) => block.id === harness.blockId),
            false,
        );
        assert.equal(state.raisedBeds[0]?.deleted, true);
        assert.deepEqual(state.refunds, [
            {
                accountId: harness.accountId,
                amount: 25,
                reason: `gardenBlock:${harness.gardenId.toString()}:recycle:${harness.blockId}`,
            },
        ]);
        assert.equal(state.cacheBusts, 1);
    });

    it('uses the legacy 10-Sunflower fallback and keeps sandbox recycling currency-free', async () => {
        const real = makeHarness({ price: 0 });
        const sandbox = makeHarness({ price: 0, sandbox: true });

        const realResult = await real.service.recycleGardenBlockForAccount({
            accountId: real.accountId,
            blockId: real.blockId,
            gardenId: real.gardenId,
        });
        const sandboxResult =
            await sandbox.service.recycleGardenBlockForAccount({
                accountId: sandbox.accountId,
                blockId: sandbox.blockId,
                gardenId: sandbox.gardenId,
            });

        assert.equal(realResult.ok && realResult.refundedSunflowers, 10);
        assert.equal(sandboxResult.ok && sandboxResult.refundedSunflowers, 0);
        assert.equal(real.state().refunds[0]?.amount, 10);
        assert.deepEqual(sandbox.state().refunds, []);
    });

    it('rejects active raised beds before any placement or economic write', async () => {
        const harness = makeHarness({ raisedBedStatus: 'active' });

        const result = await harness.service.recycleGardenBlockForAccount({
            accountId: harness.accountId,
            blockId: harness.blockId,
            gardenId: harness.gardenId,
        });

        assert.deepEqual(result, {
            ok: false,
            code: 'ACTIVE_RAISED_BED',
            error: 'Cannot delete active raised bed',
            status: 400,
        });
        assert.equal(harness.calls.includes('stack-update'), false);
        assert.equal(harness.calls.includes('block-delete'), false);
        assert.equal(harness.calls.includes('refund'), false);
    });

    it('returns bounded combined-occupancy conflicts without writing', async () => {
        const issues = Array.from({ length: 30 }, (_, index) => ({
            code: 'missing-support' as const,
            path: `structures[0].worldFootprint.${index.toString()}|0`,
            structureId: 'structure-1',
        }));
        const harness = makeHarness({
            combinedValidation: () => ({
                valid: false,
                error: {
                    code: 'GARDEN_OCCUPANCY_CONFLICT',
                    issues,
                    message: 'Structure loses support.',
                    status: 409,
                    truncated: false,
                },
            }),
        });

        const result = await harness.service.recycleGardenBlockForAccount({
            accountId: harness.accountId,
            blockId: harness.blockId,
            gardenId: harness.gardenId,
        });

        assert.equal(result.ok, false);
        if (result.ok) return;
        assert.equal(result.code, 'GARDEN_OCCUPANCY_CONFLICT');
        assert.equal(result.status, 409);
        assert.equal(result.issues?.length, 24);
        assert.equal(harness.calls.includes('stack-update'), false);
        assert.equal(harness.calls.includes('refund'), false);
    });

    it('rolls every mutation back when the refund write fails', async () => {
        const harness = makeHarness({
            failRefund: true,
            raisedBedStatus: 'new',
        });
        const before = harness.state();

        await assert.rejects(
            harness.service.recycleGardenBlockForAccount({
                accountId: harness.accountId,
                blockId: harness.blockId,
                gardenId: harness.gardenId,
            }),
            /refund failed/,
        );

        assert.deepEqual(harness.state(), before);
        assert.equal(harness.calls.includes('cache-bust'), false);
    });

    it('returns committed success when post-commit cache invalidation fails', async () => {
        const harness = makeHarness({
            failCacheBust: true,
            raisedBedStatus: 'new',
        });
        const originalConsoleError = console.error;
        const reports: unknown[][] = [];
        console.error = (...args: unknown[]) => reports.push(args);

        try {
            const result = await harness.service.recycleGardenBlockForAccount({
                accountId: harness.accountId,
                blockId: harness.blockId,
                gardenId: harness.gardenId,
            });

            assert.equal(result.ok, true);
            assert.equal(harness.state().blocks.length, 1);
            assert.equal(reports.length, 1);
        } finally {
            console.error = originalConsoleError;
        }
    });
});

describe('updateGardenBlockForAccount', () => {
    it('rejects non-integer and out-of-range storage values as typed failures', async () => {
        const fractionalRotation = makeHarness();
        const oversizedVariant = makeHarness();
        const oversizedGarden = makeHarness();

        const rotationResult =
            await fractionalRotation.service.updateGardenBlockForAccount({
                accountId: fractionalRotation.accountId,
                blockId: fractionalRotation.blockId,
                gardenId: fractionalRotation.gardenId,
                rotation: 0.5,
            });
        const variantResult =
            await oversizedVariant.service.updateGardenBlockForAccount({
                accountId: oversizedVariant.accountId,
                blockId: oversizedVariant.blockId,
                gardenId: oversizedVariant.gardenId,
                variant: 2_147_483_648,
            });
        const gardenResult =
            await oversizedGarden.service.updateGardenBlockForAccount({
                accountId: oversizedGarden.accountId,
                blockId: oversizedGarden.blockId,
                gardenId: 2_147_483_648,
                rotation: 1,
            });

        assert.deepEqual(rotationResult, {
            ok: false,
            code: 'INVALID_REQUEST',
            error: 'Invalid garden block rotation',
            status: 400,
        });
        assert.deepEqual(variantResult, {
            ok: false,
            code: 'INVALID_REQUEST',
            error: 'Invalid garden block variant',
            status: 400,
        });
        assert.equal(!gardenResult.ok && gardenResult.code, 'INVALID_REQUEST');
        assert.deepEqual(fractionalRotation.calls, []);
        assert.deepEqual(oversizedVariant.calls, []);
        assert.deepEqual(oversizedGarden.calls, []);
    });

    it('preserves sign and immutable animal appearance rules', async () => {
        const ordinary = makeHarness();
        const rabbit = makeHarness({ blockName: 'Rabbit' });
        const horse = makeHarness({ blockName: 'Horse' });

        const messageResult =
            await ordinary.service.updateGardenBlockForAccount({
                accountId: ordinary.accountId,
                blockId: ordinary.blockId,
                gardenId: ordinary.gardenId,
                message: 'hello',
            });
        const variantResult = await rabbit.service.updateGardenBlockForAccount({
            accountId: rabbit.accountId,
            blockId: rabbit.blockId,
            gardenId: rabbit.gardenId,
            variant: 2,
        });
        const rotationResult = await horse.service.updateGardenBlockForAccount({
            accountId: horse.accountId,
            blockId: horse.blockId,
            gardenId: horse.gardenId,
            rotation: 1,
        });

        assert.equal(messageResult.ok, false);
        assert.equal(
            !messageResult.ok && messageResult.code,
            'MESSAGE_NOT_ALLOWED',
        );
        assert.equal(variantResult.ok, false);
        assert.equal(!variantResult.ok && variantResult.code, 'VARIANT_LOCKED');
        assert.equal(rotationResult.ok, false);
        assert.equal(
            !rotationResult.ok && rotationResult.code,
            'ROTATION_LOCKED',
        );
    });

    it('normalizes wooden-sign messages without loading or validating occupancy', async () => {
        const harness = makeHarness({ blockName: woodenSignBlockName });

        const result = await harness.service.updateGardenBlockForAccount({
            accountId: harness.accountId,
            blockId: harness.blockId,
            gardenId: harness.gardenId,
            message: '  Prvi red  \n  Drugi red  ',
            variant: 3,
        });

        assert.deepEqual(result, {
            ok: true,
            blockId: harness.blockId,
        });
        const block = harness
            .state()
            .blocks.find((candidate) => candidate.id === harness.blockId);
        assert.equal(block?.message, 'Prvi red\nDrugi red');
        assert.equal(block?.variant, 3);
        assert.equal(harness.calls.includes('catalog'), false);
        assert.equal(harness.calls.includes('rotation-validation'), false);
        assert.equal(harness.calls.includes('combined-validation'), false);
    });

    it('validates candidate rotation, combined structures, block write, and raised-bed projection in one transaction', async () => {
        const rotatedInputs: ValidateRotatedBlockPlacementInput[] = [];
        const harness = makeHarness({
            blockName: 'Raised_Bed',
            raisedBedStatus: 'new',
            rotationValidation: async (input) => {
                harness.calls.push('rotation-validation');
                rotatedInputs.push(input);
                return { valid: true };
            },
            combinedValidation: (snapshot) => {
                const candidate = snapshot.blocks.find(
                    (block) => block.id === 'block-1',
                );
                assert.equal(candidate?.rotation, 1);
                return { valid: true };
            },
        });

        const result = await harness.service.updateGardenBlockForAccount({
            accountId: harness.accountId,
            blockId: harness.blockId,
            gardenId: harness.gardenId,
            rotation: 1,
        });

        assert.deepEqual(result, {
            ok: true,
            blockId: harness.blockId,
        });
        assert.equal(rotatedInputs[0]?.candidateRotation, 1);
        assert.equal(rotatedInputs[0]?.placement.stackIndex, 1);
        assert.deepEqual(harness.calls.slice(-5), [
            'rotation-validation',
            'combined-validation',
            'block-update',
            'raised-bed-orientation',
            'cache-bust',
        ]);
        const state = harness.state();
        assert.equal(
            state.blocks.find((block) => block.id === harness.blockId)
                ?.rotation,
            1,
        );
        assert.equal(state.raisedBeds[0]?.orientation, 'vertical');
    });

    it('fails closed when rotated placement validation is unavailable', async () => {
        const harness = makeHarness({
            rotationValidation: async () => ({
                valid: false,
                code: 'ROTATION_VALIDATION_UNAVAILABLE',
                error: 'Garden block rotation validation is unavailable.',
                status: 503,
            }),
        });

        const result = await harness.service.updateGardenBlockForAccount({
            accountId: harness.accountId,
            blockId: harness.blockId,
            gardenId: harness.gardenId,
            rotation: 1,
        });

        assert.deepEqual(result, {
            ok: false,
            code: 'ROTATION_VALIDATION_UNAVAILABLE',
            error: 'Garden block rotation validation is unavailable.',
            status: 503,
        });
        assert.equal(harness.calls.includes('block-update'), false);
        assert.equal(harness.calls.includes('combined-validation'), false);
    });
});
