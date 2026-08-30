import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    bustScheduleCache,
    createGardenStack,
    earnSunflowersOnce,
    type GardenPlacementTransaction,
    getGardenPlacementSnapshotForUpdate,
    listGardenRaisedBedMetadataForUpdate,
    listGardenStructures,
    SunflowerEarnAmountConflictError,
    softDeleteGardenBlockOnce,
    softDeleteNewRaisedBedOnce,
    updateGardenStack,
    withAccountDeletionFenceTransaction,
    withGardenPlacementTransaction,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import { getBlockData } from '../blocks/blockDataService';
import {
    type GardenStacksPatchDirectoryBlock,
    type GardenStacksPatchOperation,
    type GardenStacksPatchPlannerErrorCode,
    type GardenStacksPatchPlannerInput,
    type GardenStacksPatchPlannerResult,
    gardenStacksPatchMaxBlockIdentifierLength,
    gardenStacksPatchMaxMutations,
    gardenStacksPatchMaxOperations,
    gardenStacksPatchMaxPathLength,
    planGardenStacksPatch,
} from './gardenStacksPatchPlanner';

const maximumAccountIdentifierLength = 128;
const maximumGardenIdentifier = 2_147_483_647;
export const gardenStacksPatchServiceMaxErrorLength = 512;

type GardenStacksPatchServiceStatus = 400 | 404 | 409 | 503;

export type GardenStacksPatchServiceFailureCode =
    | GardenStacksPatchPlannerErrorCode
    | 'ACCOUNT_UNAVAILABLE'
    | 'BLOCK_DIRECTORY_UNAVAILABLE'
    | 'GARDEN_NOT_FOUND'
    | 'GARDEN_STATE_CHANGED'
    | 'INVALID_REQUEST'
    | 'SUNFLOWER_OPERATION_CONFLICT';

export type GardenStacksPatchCommand = Readonly<{
    accountId: string;
    gardenId: number;
    operations: readonly GardenStacksPatchOperation[];
}>;

export type GardenStacksPatchServiceResult =
    | Readonly<{
          ok: true;
          appliedStackDeltas: number;
          gardenId: number;
          recycledBlock: boolean;
          refundedSunflowers: number;
      }>
    | Readonly<{
          ok: false;
          code: GardenStacksPatchServiceFailureCode;
          error: string;
          status: GardenStacksPatchServiceStatus;
      }>;

type GardenStacksPatchSnapshot = Readonly<{
    blocks: GardenStacksPatchPlannerInput['snapshot']['blocks'];
    garden: Readonly<{
        accountId: string;
        id: number;
        isSandbox: boolean;
    }>;
    stacks: GardenStacksPatchPlannerInput['snapshot']['stacks'];
}>;

type GardenStacksPatchRaisedBed = NonNullable<
    GardenStacksPatchPlannerInput['snapshot']['raisedBeds']
>[number];

export type GardenStacksPatchServiceDependencies<Transaction> = Readonly<{
    bustScheduleCache: () => Promise<void>;
    createGardenStack: (
        gardenId: number,
        position: Readonly<{ x: number; y: number }>,
        transaction: Transaction,
    ) => Promise<boolean>;
    earnSunflowersOnce: (
        accountId: string,
        amount: number,
        reason: string,
        transaction: Transaction,
    ) => Promise<unknown>;
    getBlockData: () => Promise<readonly GardenStacksPatchDirectoryBlock[]>;
    getGardenPlacementSnapshotForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<GardenStacksPatchSnapshot | null>;
    listGardenRaisedBedMetadataForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<readonly GardenStacksPatchRaisedBed[]>;
    listGardenStructures: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<GardenStacksPatchPlannerInput['snapshot']['structures']>;
    planGardenStacksPatch: (
        input: GardenStacksPatchPlannerInput,
    ) => GardenStacksPatchPlannerResult;
    softDeleteGardenBlockOnce: (
        gardenId: number,
        blockId: string,
        transaction: Transaction,
    ) => Promise<'already-deleted' | 'deleted' | 'not-found'>;
    softDeleteNewRaisedBedOnce: (
        raisedBedId: number,
        transaction: Transaction,
    ) => Promise<boolean>;
    updateGardenStack: (
        gardenId: number,
        stack: Readonly<{ blocks: string[]; x: number; y: number }>,
        transaction: Transaction,
    ) => Promise<void>;
    withAccountDeletionFenceTransaction: <Result>(
        accountId: string,
        callback: (transaction: Transaction) => Promise<Result>,
        transaction: Transaction,
    ) => Promise<Result>;
    withGardenPlacementTransaction: <Result>(
        gardenId: number,
        callback: (transaction: Transaction) => Promise<Result>,
        transaction: Transaction,
    ) => Promise<Result>;
    withSunflowerAccountTransaction: <Result>(
        accountId: string,
        callback: (transaction: Transaction) => Promise<Result>,
    ) => Promise<Result>;
}>;

class GardenStacksPatchServiceError extends Error {
    override readonly name = 'GardenStacksPatchServiceError';

    constructor(
        readonly code: GardenStacksPatchServiceFailureCode,
        readonly status: GardenStacksPatchServiceStatus,
        message: string,
    ) {
        super(message.slice(0, gardenStacksPatchServiceMaxErrorLength));
    }
}

function fail(
    code: GardenStacksPatchServiceFailureCode,
    status: GardenStacksPatchServiceStatus,
    message: string,
): never {
    throw new GardenStacksPatchServiceError(code, status, message);
}

function assertPathEnvelope(path: string) {
    if (path.length === 0 || path.length > gardenStacksPatchMaxPathLength) {
        fail('INVALID_PATH', 400, 'Garden stack patch path is invalid');
    }
}

function snapshotOperations(
    operations: readonly GardenStacksPatchOperation[],
): readonly GardenStacksPatchOperation[] {
    if (operations.length === 0) {
        fail(
            'EMPTY_PATCH',
            400,
            'No garden stack patch operations were provided',
        );
    }
    if (operations.length > gardenStacksPatchMaxOperations) {
        fail(
            'TOO_MANY_OPERATIONS',
            400,
            'Garden stack patch operation limit was exceeded',
        );
    }

    let mutationCount = 0;
    const snapshot: GardenStacksPatchOperation[] = [];
    for (const operation of operations) {
        assertPathEnvelope(operation.path);
        if (operation.op !== 'test') {
            mutationCount += 1;
        }

        switch (operation.op) {
            case 'test':
                if (
                    typeof operation.value !== 'string' ||
                    operation.value.trim().length === 0 ||
                    operation.value.length >
                        gardenStacksPatchMaxBlockIdentifierLength
                ) {
                    fail(
                        'UNSUPPORTED_PATCH_SHAPE',
                        400,
                        'Garden stack tests require one bounded block identifier',
                    );
                }
                snapshot.push({
                    op: 'test',
                    path: operation.path,
                    value: operation.value,
                });
                break;
            case 'move':
                assertPathEnvelope(operation.from);
                snapshot.push({
                    from: operation.from,
                    op: 'move',
                    path: operation.path,
                });
                break;
            case 'remove':
                snapshot.push({ op: 'remove', path: operation.path });
                break;
            case 'add':
            case 'copy':
            case 'replace':
                fail(
                    'UNSUPPORTED_PATCH_SHAPE',
                    400,
                    `Garden stack patch operation ${operation.op} is not supported`,
                );
        }
    }
    if (mutationCount > gardenStacksPatchMaxMutations) {
        fail(
            'TOO_MANY_MUTATIONS',
            400,
            'Garden stack patch mutation limit was exceeded',
        );
    }
    return Object.freeze(snapshot);
}

function normalizeCommand(command: GardenStacksPatchCommand) {
    if (
        typeof command.accountId !== 'string' ||
        command.accountId.trim() !== command.accountId ||
        command.accountId.length === 0 ||
        command.accountId.length > maximumAccountIdentifierLength ||
        !Number.isInteger(command.gardenId) ||
        command.gardenId <= 0 ||
        command.gardenId > maximumGardenIdentifier ||
        !Array.isArray(command.operations)
    ) {
        fail('INVALID_REQUEST', 400, 'Invalid garden stack patch request');
    }
    return Object.freeze({
        accountId: command.accountId,
        gardenId: command.gardenId,
        operations: snapshotOperations(command.operations),
    });
}

async function loadBlockData<Transaction>(
    dependencies: GardenStacksPatchServiceDependencies<Transaction>,
) {
    try {
        const blockData = await dependencies.getBlockData();
        if (!Array.isArray(blockData)) {
            fail(
                'BLOCK_DIRECTORY_UNAVAILABLE',
                503,
                'Garden block directory data is unavailable',
            );
        }
        return blockData;
    } catch (error) {
        if (error instanceof GardenStacksPatchServiceError) throw error;
        fail(
            'BLOCK_DIRECTORY_UNAVAILABLE',
            503,
            'Garden block directory data is unavailable',
        );
    }
}

function failureFrom(error: unknown): GardenStacksPatchServiceResult | null {
    if (error instanceof GardenStacksPatchServiceError) {
        return {
            ok: false,
            code: error.code,
            error: error.message,
            status: error.status,
        };
    }
    if (
        error instanceof AccountDeletionInProgressError ||
        error instanceof AccountNotFoundError
    ) {
        return {
            ok: false,
            code: 'ACCOUNT_UNAVAILABLE',
            error: 'The account is unavailable for garden changes.',
            status: 409,
        };
    }
    if (error instanceof SunflowerEarnAmountConflictError) {
        return {
            ok: false,
            code: 'SUNFLOWER_OPERATION_CONFLICT',
            error: 'Sunflower refund conflicts with an existing entry.',
            status: 409,
        };
    }
    return null;
}

export function createGardenStacksPatchService<Transaction>(
    dependencies: GardenStacksPatchServiceDependencies<Transaction>,
) {
    return async function patchGardenStacksForAccount(
        rawCommand: GardenStacksPatchCommand,
    ): Promise<GardenStacksPatchServiceResult> {
        try {
            const command = normalizeCommand(rawCommand);
            const blockData = await loadBlockData(dependencies);

            const committed =
                await dependencies.withSunflowerAccountTransaction(
                    command.accountId,
                    (sunflowerTransaction) =>
                        dependencies.withAccountDeletionFenceTransaction(
                            command.accountId,
                            (accountTransaction) =>
                                dependencies.withGardenPlacementTransaction(
                                    command.gardenId,
                                    async (gardenTransaction) => {
                                        const snapshot =
                                            await dependencies.getGardenPlacementSnapshotForUpdate(
                                                command.gardenId,
                                                gardenTransaction,
                                            );
                                        if (
                                            !snapshot ||
                                            snapshot.garden.accountId !==
                                                command.accountId
                                        ) {
                                            fail(
                                                'GARDEN_NOT_FOUND',
                                                404,
                                                'Garden not found',
                                            );
                                        }

                                        const raisedBeds =
                                            await dependencies.listGardenRaisedBedMetadataForUpdate(
                                                command.gardenId,
                                                gardenTransaction,
                                            );
                                        const structures =
                                            await dependencies.listGardenStructures(
                                                command.gardenId,
                                                gardenTransaction,
                                            );
                                        const planned =
                                            dependencies.planGardenStacksPatch({
                                                blockData,
                                                operations: command.operations,
                                                snapshot: {
                                                    blocks: snapshot.blocks,
                                                    garden: {
                                                        isSandbox:
                                                            snapshot.garden
                                                                .isSandbox,
                                                    },
                                                    raisedBeds,
                                                    stacks: snapshot.stacks,
                                                    structures,
                                                },
                                            });
                                        if (!planned.ok) {
                                            fail(
                                                planned.code,
                                                planned.status,
                                                planned.error,
                                            );
                                        }

                                        for (const delta of planned.plan
                                            .stackDeltas) {
                                            if (delta.create) {
                                                const created =
                                                    await dependencies.createGardenStack(
                                                        command.gardenId,
                                                        {
                                                            x: delta.x,
                                                            y: delta.y,
                                                        },
                                                        gardenTransaction,
                                                    );
                                                if (!created) {
                                                    fail(
                                                        'GARDEN_STATE_CHANGED',
                                                        409,
                                                        'Garden stack changed while applying the patch',
                                                    );
                                                }
                                            }
                                            await dependencies.updateGardenStack(
                                                command.gardenId,
                                                {
                                                    blocks: [
                                                        ...delta.nextBlocks,
                                                    ],
                                                    x: delta.x,
                                                    y: delta.y,
                                                },
                                                gardenTransaction,
                                            );
                                        }

                                        const recycle = planned.plan.recycle;
                                        if (
                                            recycle?.raisedBedId !== undefined
                                        ) {
                                            const deletedRaisedBed =
                                                await dependencies.softDeleteNewRaisedBedOnce(
                                                    recycle.raisedBedId,
                                                    gardenTransaction,
                                                );
                                            if (!deletedRaisedBed) {
                                                fail(
                                                    'GARDEN_STATE_CHANGED',
                                                    409,
                                                    'Raised bed changed while applying the patch',
                                                );
                                            }
                                        }
                                        if (recycle) {
                                            const deletedBlock =
                                                await dependencies.softDeleteGardenBlockOnce(
                                                    command.gardenId,
                                                    recycle.blockId,
                                                    gardenTransaction,
                                                );
                                            if (deletedBlock !== 'deleted') {
                                                fail(
                                                    'GARDEN_STATE_CHANGED',
                                                    409,
                                                    'Garden block changed while applying the patch',
                                                );
                                            }
                                            if (
                                                !snapshot.garden.isSandbox &&
                                                recycle.refundSunflowers > 0
                                            ) {
                                                await dependencies.earnSunflowersOnce(
                                                    command.accountId,
                                                    recycle.refundSunflowers,
                                                    `gardenBlock:${command.gardenId.toString()}:recycle:${recycle.blockId}`,
                                                    gardenTransaction,
                                                );
                                            }
                                        }

                                        return {
                                            bustRaisedBedCache:
                                                recycle?.raisedBedId !==
                                                undefined,
                                            result: {
                                                ok: true,
                                                appliedStackDeltas:
                                                    planned.plan.stackDeltas
                                                        .length,
                                                gardenId: command.gardenId,
                                                recycledBlock:
                                                    recycle !== undefined,
                                                refundedSunflowers: snapshot
                                                    .garden.isSandbox
                                                    ? 0
                                                    : (recycle?.refundSunflowers ??
                                                      0),
                                            } as const,
                                        };
                                    },
                                    accountTransaction,
                                ),
                            sunflowerTransaction,
                        ),
                );
            if (committed.bustRaisedBedCache) {
                try {
                    await dependencies.bustScheduleCache();
                } catch (error) {
                    console.error(
                        'Failed to invalidate the schedule cache after garden stack recycling',
                        { gardenId: command.gardenId, error },
                    );
                }
            }
            return committed.result;
        } catch (error) {
            const failure = failureFrom(error);
            if (failure) return failure;
            throw error;
        }
    };
}

const defaultDependencies: GardenStacksPatchServiceDependencies<GardenPlacementTransaction> =
    {
        bustScheduleCache,
        createGardenStack,
        earnSunflowersOnce,
        getBlockData,
        getGardenPlacementSnapshotForUpdate,
        listGardenRaisedBedMetadataForUpdate,
        listGardenStructures,
        planGardenStacksPatch,
        softDeleteGardenBlockOnce,
        softDeleteNewRaisedBedOnce,
        updateGardenStack,
        withAccountDeletionFenceTransaction,
        withGardenPlacementTransaction,
        withSunflowerAccountTransaction,
    };

export const patchGardenStacksForAccount =
    createGardenStacksPatchService(defaultDependencies);
