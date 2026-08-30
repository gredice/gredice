import type { BlockData } from '@gredice/directory-types';
import {
    isAppearanceVariantRotationLocked,
    isEntityAppearanceVariantUpdateAllowed,
} from '@gredice/js/entityAppearanceVariants';
import {
    isValidWoodenSignMessage,
    normalizeWoodenSignMessage,
    woodenSignBlockName,
} from '@gredice/js/woodenSign';
import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    bustScheduleCache,
    earnSunflowersOnce,
    type GardenPlacementTransaction,
    getGardenPlacementSnapshotForUpdate,
    listGardenRaisedBedMetadataForUpdate,
    listGardenStructures,
    SunflowerEarnAmountConflictError,
    softDeleteGardenBlockOnce,
    softDeleteNewRaisedBedOnce,
    updateGardenBlock,
    updateGardenStack,
    updateRaisedBedOrientation,
    withAccountDeletionFenceTransaction,
    withGardenPlacementTransaction,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import { getBlockData } from '../blocks/blockDataService';
import {
    type GardenOccupancyServiceError,
    type GardenOccupancyServiceIssue,
    type GardenOccupancyStorageStructureLike,
    validatePersistedStructuresAfterBlockMutation,
} from './gardenOccupancyService';
import { validateRotatedBlockPlacement } from './rotatedBlockPlacementValidation';

const defaultRecycleRefund = 10;
const maximumAccountIdentifierLength = 128;
const maximumBlockIdentifierLength = 128;
const maximumFailureIssues = 24;
const minimumStorageInteger = -2_147_483_648;
const maximumStorageInteger = 2_147_483_647;

type GardenBlockMutationStatus = 400 | 404 | 409 | 503;

export type GardenBlockMutationFailureCode =
    | 'ACCOUNT_UNAVAILABLE'
    | 'ACTIVE_RAISED_BED'
    | 'BLOCK_DIRECTORY_DATA_NOT_FOUND'
    | 'BLOCK_DIRECTORY_UNAVAILABLE'
    | 'BLOCK_NOT_FOUND'
    | 'GARDEN_NOT_FOUND'
    | 'GARDEN_OCCUPANCY_CONFLICT'
    | 'GARDEN_OCCUPANCY_INVALID_INPUT'
    | 'GARDEN_OCCUPANCY_INVALID_STATE'
    | 'GARDEN_STATE_CHANGED'
    | 'GARDEN_STATE_INVALID'
    | 'INVALID_REQUEST'
    | 'MESSAGE_NOT_ALLOWED'
    | 'ROTATION_LOCKED'
    | 'ROTATION_VALIDATION_UNAVAILABLE'
    | 'SUNFLOWER_OPERATION_CONFLICT'
    | 'VARIANT_LOCKED';

export type GardenBlockMutationFailure = Readonly<{
    ok: false;
    code: GardenBlockMutationFailureCode;
    error: string;
    issues?: readonly GardenOccupancyServiceIssue[];
    status: GardenBlockMutationStatus;
}>;

export type RecycleGardenBlockCommand = Readonly<{
    accountId: string;
    blockId: string;
    gardenId: number;
}>;

export type UpdateGardenBlockCommand = Readonly<{
    accountId: string;
    blockId: string;
    gardenId: number;
    message?: string | null;
    rotation?: number | null;
    variant?: number | null;
}>;

export type RecycleGardenBlockResult =
    | Readonly<{
          ok: true;
          blockId: string;
          refundedSunflowers: number;
      }>
    | GardenBlockMutationFailure;

export type UpdateGardenBlockResult =
    | Readonly<{
          ok: true;
          blockId: string;
      }>
    | GardenBlockMutationFailure;

type GardenBlockMutationSnapshot = Readonly<{
    garden: Readonly<{
        accountId: string;
        id: number;
        isSandbox: boolean;
    }>;
    blocks: readonly Readonly<{
        id: string;
        message?: string | null;
        name: string;
        rotation: number | null;
        variant: number | null;
    }>[];
    stacks: readonly Readonly<{
        blocks: string[];
        id?: number;
        positionX: number;
        positionY: number;
    }>[];
}>;

type GardenRaisedBedMutationMetadata = Readonly<{
    blockId: string | null;
    id: number;
    orientation: 'horizontal' | 'vertical';
    status: string;
}>;

type GardenBlockPlacement = Readonly<{
    stack: GardenBlockMutationSnapshot['stacks'][number];
    stackIndex: number;
}>;

export type ValidateRotatedBlockPlacementInput = Readonly<{
    block: GardenBlockMutationSnapshot['blocks'][number];
    blockData: readonly BlockData[];
    candidateRotation: number | null;
    placement: GardenBlockPlacement;
    snapshot: GardenBlockMutationSnapshot;
    structures: readonly GardenOccupancyStorageStructureLike[];
}>;

export type ValidateRotatedBlockPlacementResult =
    | Readonly<{ valid: true }>
    | Readonly<{
          valid: false;
          code: GardenBlockMutationFailureCode;
          error: string;
          issues?: readonly GardenOccupancyServiceIssue[];
          status: GardenBlockMutationStatus;
      }>;

export type GardenBlockMutationDependencies<Transaction> = Readonly<{
    bustScheduleCache: () => Promise<void>;
    earnSunflowersOnce: (
        accountId: string,
        amount: number,
        reason: string,
        transaction: Transaction,
    ) => Promise<unknown>;
    getBlockData: () => Promise<readonly BlockData[]>;
    getGardenPlacementSnapshotForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<GardenBlockMutationSnapshot | null>;
    listGardenRaisedBedMetadataForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<readonly GardenRaisedBedMutationMetadata[]>;
    listGardenStructures: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<readonly GardenOccupancyStorageStructureLike[]>;
    softDeleteGardenBlockOnce: (
        gardenId: number,
        blockId: string,
        transaction: Transaction,
    ) => Promise<'already-deleted' | 'deleted' | 'not-found'>;
    softDeleteNewRaisedBedOnce: (
        raisedBedId: number,
        transaction: Transaction,
    ) => Promise<boolean>;
    updateGardenBlock: (
        gardenId: number,
        block: Readonly<{
            id: string;
            message?: string | null;
            rotation?: number | null;
            variant?: number | null;
        }>,
        transaction: Transaction,
    ) => Promise<boolean>;
    updateGardenStack: (
        gardenId: number,
        stack: Readonly<{
            blocks: string[];
            x: number;
            y: number;
        }>,
        transaction: Transaction,
    ) => Promise<void>;
    updateRaisedBedOrientation: (
        raisedBedId: number,
        orientation: 'horizontal' | 'vertical',
        transaction: Transaction,
    ) => Promise<boolean>;
    validatePersistedStructuresAfterBlockMutation: typeof validatePersistedStructuresAfterBlockMutation;
    validateRotatedBlockPlacement: (
        input: ValidateRotatedBlockPlacementInput,
    ) => Promise<ValidateRotatedBlockPlacementResult>;
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

class GardenBlockMutationError extends Error {
    override readonly name = 'GardenBlockMutationError';

    constructor(
        readonly code: GardenBlockMutationFailureCode,
        readonly status: GardenBlockMutationStatus,
        message: string,
        readonly issues?: readonly GardenOccupancyServiceIssue[],
    ) {
        super(message);
    }
}

function fail(
    code: GardenBlockMutationFailureCode,
    status: GardenBlockMutationStatus,
    message: string,
    issues?: readonly GardenOccupancyServiceIssue[],
): never {
    throw new GardenBlockMutationError(
        code,
        status,
        message,
        issues?.slice(0, maximumFailureIssues),
    );
}

function failOccupancy(error: GardenOccupancyServiceError): never {
    fail(error.code, error.status, error.message, error.issues);
}

function assertIdentifier(value: string, maximumLength: number) {
    return (
        value.length > 0 &&
        value.length <= maximumLength &&
        value.trim() === value
    );
}

function assertBaseCommand(command: RecycleGardenBlockCommand) {
    if (
        !assertIdentifier(command.accountId, maximumAccountIdentifierLength) ||
        !assertIdentifier(command.blockId, maximumBlockIdentifierLength) ||
        !Number.isInteger(command.gardenId) ||
        command.gardenId <= 0 ||
        command.gardenId > maximumStorageInteger
    ) {
        fail('INVALID_REQUEST', 400, 'Invalid garden block mutation request');
    }
}

function isStorageInteger(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= minimumStorageInteger &&
        value <= maximumStorageInteger
    );
}

function normalizeUpdateCommand(command: UpdateGardenBlockCommand) {
    assertBaseCommand(command);
    const hasMessage = command.message !== undefined;
    const hasRotation = command.rotation !== undefined;
    const hasVariant = command.variant !== undefined;
    if (!hasMessage && !hasRotation && !hasVariant) {
        fail('INVALID_REQUEST', 400, 'At least one block field is required');
    }
    if (
        hasMessage &&
        command.message !== null &&
        (typeof command.message !== 'string' ||
            !isValidWoodenSignMessage(command.message))
    ) {
        fail('INVALID_REQUEST', 400, 'Invalid wooden sign message');
    }
    if (
        hasRotation &&
        command.rotation !== null &&
        !isStorageInteger(command.rotation)
    ) {
        fail('INVALID_REQUEST', 400, 'Invalid garden block rotation');
    }
    if (
        hasVariant &&
        command.variant !== null &&
        !isStorageInteger(command.variant)
    ) {
        fail('INVALID_REQUEST', 400, 'Invalid garden block variant');
    }

    return {
        ...command,
        message:
            typeof command.message === 'string'
                ? normalizeWoodenSignMessage(command.message)
                : command.message,
    };
}

function findBlockPlacement(
    snapshot: GardenBlockMutationSnapshot,
    blockId: string,
): GardenBlockPlacement | null {
    let placement: GardenBlockPlacement | null = null;
    for (const stack of snapshot.stacks) {
        for (const [stackIndex, candidateBlockId] of stack.blocks.entries()) {
            if (candidateBlockId !== blockId) continue;
            if (placement) {
                fail(
                    'GARDEN_STATE_INVALID',
                    409,
                    'Garden block appears in more than one stack position',
                );
            }
            placement = { stack, stackIndex };
        }
    }
    return placement;
}

function findRelatedRaisedBed(
    raisedBeds: readonly GardenRaisedBedMutationMetadata[],
    blockId: string,
) {
    const related = raisedBeds.filter(
        (raisedBed) => raisedBed.blockId === blockId,
    );
    if (related.length > 1) {
        fail(
            'GARDEN_STATE_INVALID',
            409,
            'Garden block belongs to more than one raised bed',
        );
    }
    return related[0] ?? null;
}

function findDirectoryBlock(
    blockData: readonly BlockData[],
    blockName: string,
) {
    const directoryBlock = blockData.find(
        (candidate) => candidate.information.name === blockName,
    );
    if (!directoryBlock) {
        fail(
            'BLOCK_DIRECTORY_DATA_NOT_FOUND',
            404,
            'Requested block data not found',
        );
    }
    return directoryBlock;
}

function candidateSnapshotAfterRecycle(
    snapshot: GardenBlockMutationSnapshot,
    blockId: string,
) {
    return {
        blocks: snapshot.blocks.filter((block) => block.id !== blockId),
        stacks: snapshot.stacks.map((stack) => ({
            ...stack,
            blocks: stack.blocks.filter(
                (candidateBlockId) => candidateBlockId !== blockId,
            ),
        })),
    };
}

function candidateSnapshotAfterRotation(
    snapshot: GardenBlockMutationSnapshot,
    blockId: string,
    rotation: number | null,
) {
    return {
        blocks: snapshot.blocks.map((block) =>
            block.id === blockId ? { ...block, rotation } : block,
        ),
        stacks: snapshot.stacks,
    };
}

function raisedBedOrientationForRotation(rotation: number | null) {
    const normalizedRotation = ((Math.round(rotation ?? 0) % 2) + 2) % 2;
    return normalizedRotation === 1
        ? ('vertical' as const)
        : ('horizontal' as const);
}

function failureFrom(error: unknown): GardenBlockMutationFailure | null {
    if (error instanceof GardenBlockMutationError) {
        return {
            ok: false,
            code: error.code,
            error: error.message,
            ...(error.issues ? { issues: error.issues } : {}),
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

async function loadBlockData<Transaction>(
    dependencies: GardenBlockMutationDependencies<Transaction>,
) {
    try {
        return await dependencies.getBlockData();
    } catch (error) {
        if (error instanceof GardenBlockMutationError) throw error;
        fail(
            'BLOCK_DIRECTORY_UNAVAILABLE',
            503,
            'Garden block directory data is unavailable',
        );
    }
}

type LockedMutationContext<Transaction> = Readonly<{
    raisedBeds: readonly GardenRaisedBedMutationMetadata[];
    snapshot: GardenBlockMutationSnapshot;
    structures: readonly GardenOccupancyStorageStructureLike[];
    transaction: Transaction;
}>;

export function createGardenBlockMutationService<Transaction>(
    dependencies: GardenBlockMutationDependencies<Transaction>,
) {
    async function withLockedGarden<Result>(
        command: RecycleGardenBlockCommand,
        mutation: (
            context: LockedMutationContext<Transaction>,
        ) => Promise<Result>,
    ) {
        return dependencies.withSunflowerAccountTransaction(
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
                                return mutation({
                                    raisedBeds,
                                    snapshot,
                                    structures,
                                    transaction: gardenTransaction,
                                });
                            },
                            accountTransaction,
                        ),
                    sunflowerTransaction,
                ),
        );
    }

    async function recycleGardenBlockForAccount(
        command: RecycleGardenBlockCommand,
    ): Promise<RecycleGardenBlockResult> {
        try {
            assertBaseCommand(command);
            const blockData = await loadBlockData(dependencies);
            const committed = await withLockedGarden(
                command,
                async ({ raisedBeds, snapshot, structures, transaction }) => {
                    const block = snapshot.blocks.find(
                        (candidate) => candidate.id === command.blockId,
                    );
                    if (!block) {
                        fail('BLOCK_NOT_FOUND', 404, 'Block not found');
                    }
                    const directoryBlock = findDirectoryBlock(
                        blockData,
                        block.name,
                    );
                    const placement = findBlockPlacement(snapshot, block.id);
                    const relatedRaisedBed = findRelatedRaisedBed(
                        raisedBeds,
                        block.id,
                    );
                    if (relatedRaisedBed && relatedRaisedBed.status !== 'new') {
                        fail(
                            'ACTIVE_RAISED_BED',
                            400,
                            'Cannot delete active raised bed',
                        );
                    }

                    const candidate = candidateSnapshotAfterRecycle(
                        snapshot,
                        block.id,
                    );
                    const occupancy =
                        dependencies.validatePersistedStructuresAfterBlockMutation(
                            {
                                blockData,
                                snapshot: {
                                    blocks: candidate.blocks,
                                    stacks: candidate.stacks,
                                    structures,
                                },
                            },
                        );
                    if (!occupancy.valid) {
                        failOccupancy(occupancy.error);
                    }

                    if (placement) {
                        await dependencies.updateGardenStack(
                            command.gardenId,
                            {
                                blocks: placement.stack.blocks.filter(
                                    (candidateBlockId) =>
                                        candidateBlockId !== block.id,
                                ),
                                x: placement.stack.positionX,
                                y: placement.stack.positionY,
                            },
                            transaction,
                        );
                    }
                    if (relatedRaisedBed) {
                        const deletedRaisedBed =
                            await dependencies.softDeleteNewRaisedBedOnce(
                                relatedRaisedBed.id,
                                transaction,
                            );
                        if (!deletedRaisedBed) {
                            fail(
                                'GARDEN_STATE_CHANGED',
                                409,
                                'Raised bed changed while recycling its block',
                            );
                        }
                    }
                    const deletion =
                        await dependencies.softDeleteGardenBlockOnce(
                            command.gardenId,
                            block.id,
                            transaction,
                        );
                    if (deletion !== 'deleted') {
                        fail(
                            'GARDEN_STATE_CHANGED',
                            409,
                            'Garden block changed while it was being recycled',
                        );
                    }

                    const directoryPrice =
                        directoryBlock.prices?.sunflowers ?? 0;
                    const refundAmount =
                        directoryPrice > 0
                            ? directoryPrice
                            : defaultRecycleRefund;
                    if (
                        !Number.isSafeInteger(refundAmount) ||
                        refundAmount <= 0
                    ) {
                        fail(
                            'BLOCK_DIRECTORY_UNAVAILABLE',
                            503,
                            'Garden block refund price is invalid',
                        );
                    }
                    if (!snapshot.garden.isSandbox) {
                        await dependencies.earnSunflowersOnce(
                            command.accountId,
                            refundAmount,
                            `gardenBlock:${command.gardenId.toString()}:recycle:${block.id}`,
                            transaction,
                        );
                    }

                    return {
                        bustRaisedBedCache: relatedRaisedBed !== null,
                        result: {
                            ok: true,
                            blockId: block.id,
                            refundedSunflowers: snapshot.garden.isSandbox
                                ? 0
                                : refundAmount,
                        } satisfies RecycleGardenBlockResult,
                    };
                },
            );
            if (committed.bustRaisedBedCache) {
                try {
                    await dependencies.bustScheduleCache();
                } catch (error) {
                    console.error(
                        'Failed to invalidate the schedule cache after garden block recycling',
                        {
                            blockId: command.blockId,
                            gardenId: command.gardenId,
                            error,
                        },
                    );
                }
            }
            return committed.result;
        } catch (error) {
            const failure = failureFrom(error);
            if (failure) return failure;
            throw error;
        }
    }

    async function updateGardenBlockForAccount(
        rawCommand: UpdateGardenBlockCommand,
    ): Promise<UpdateGardenBlockResult> {
        try {
            const command = normalizeUpdateCommand(rawCommand);
            const blockData =
                command.rotation === undefined
                    ? null
                    : await loadBlockData(dependencies);
            const committed = await withLockedGarden(
                command,
                async ({ raisedBeds, snapshot, structures, transaction }) => {
                    const block = snapshot.blocks.find(
                        (candidate) => candidate.id === command.blockId,
                    );
                    if (!block) {
                        fail('BLOCK_NOT_FOUND', 404, 'Block not found');
                    }
                    if (
                        command.message !== undefined &&
                        block.name !== woodenSignBlockName
                    ) {
                        fail(
                            'MESSAGE_NOT_ALLOWED',
                            400,
                            'Only wooden signs can have a message',
                        );
                    }
                    if (
                        command.variant !== undefined &&
                        !isEntityAppearanceVariantUpdateAllowed({
                            entityName: block.name,
                            currentVariant: block.variant,
                            requestedVariant: command.variant,
                        })
                    ) {
                        fail(
                            'VARIANT_LOCKED',
                            400,
                            'Izgled životinje nije moguće promijeniti nakon postavljanja.',
                        );
                    }

                    const rotationChanged =
                        command.rotation !== undefined &&
                        command.rotation !== block.rotation;
                    if (
                        rotationChanged &&
                        isAppearanceVariantRotationLocked(block.name)
                    ) {
                        fail(
                            'ROTATION_LOCKED',
                            400,
                            'Životinju nije moguće rotirati nakon postavljanja.',
                        );
                    }

                    const placement = findBlockPlacement(snapshot, block.id);
                    const relatedRaisedBed = findRelatedRaisedBed(
                        raisedBeds,
                        block.id,
                    );
                    if (rotationChanged && placement) {
                        if (!blockData) {
                            fail(
                                'BLOCK_DIRECTORY_UNAVAILABLE',
                                503,
                                'Garden block directory data is unavailable',
                            );
                        }
                        findDirectoryBlock(blockData, block.name);
                        const rotationValidation =
                            await dependencies.validateRotatedBlockPlacement({
                                block,
                                blockData,
                                candidateRotation: command.rotation ?? null,
                                placement,
                                snapshot,
                                structures,
                            });
                        if (!rotationValidation.valid) {
                            fail(
                                rotationValidation.code,
                                rotationValidation.status,
                                rotationValidation.error,
                                rotationValidation.issues,
                            );
                        }

                        const candidate = candidateSnapshotAfterRotation(
                            snapshot,
                            block.id,
                            command.rotation ?? null,
                        );
                        const occupancy =
                            dependencies.validatePersistedStructuresAfterBlockMutation(
                                {
                                    blockData,
                                    snapshot: {
                                        blocks: candidate.blocks,
                                        stacks: candidate.stacks,
                                        structures,
                                    },
                                },
                            );
                        if (!occupancy.valid) {
                            failOccupancy(occupancy.error);
                        }
                    }

                    const updated = await dependencies.updateGardenBlock(
                        command.gardenId,
                        {
                            id: block.id,
                            ...(command.message !== undefined
                                ? { message: command.message }
                                : {}),
                            ...(command.rotation !== undefined
                                ? { rotation: command.rotation }
                                : {}),
                            ...(command.variant !== undefined
                                ? { variant: command.variant }
                                : {}),
                        },
                        transaction,
                    );
                    if (!updated) {
                        fail(
                            'GARDEN_STATE_CHANGED',
                            409,
                            'Garden block changed while it was being updated',
                        );
                    }

                    let raisedBedOrientationChanged = false;
                    if (rotationChanged && relatedRaisedBed) {
                        const orientation = raisedBedOrientationForRotation(
                            command.rotation ?? null,
                        );
                        if (relatedRaisedBed.orientation !== orientation) {
                            raisedBedOrientationChanged =
                                await dependencies.updateRaisedBedOrientation(
                                    relatedRaisedBed.id,
                                    orientation,
                                    transaction,
                                );
                            if (!raisedBedOrientationChanged) {
                                fail(
                                    'GARDEN_STATE_CHANGED',
                                    409,
                                    'Raised bed changed while updating its orientation',
                                );
                            }
                        }
                    }

                    return {
                        bustRaisedBedCache: raisedBedOrientationChanged,
                        result: {
                            ok: true,
                            blockId: block.id,
                        } satisfies UpdateGardenBlockResult,
                    };
                },
            );
            if (committed.bustRaisedBedCache) {
                try {
                    await dependencies.bustScheduleCache();
                } catch (error) {
                    console.error(
                        'Failed to invalidate the schedule cache after garden block rotation',
                        {
                            blockId: command.blockId,
                            gardenId: command.gardenId,
                            error,
                        },
                    );
                }
            }
            return committed.result;
        } catch (error) {
            const failure = failureFrom(error);
            if (failure) return failure;
            throw error;
        }
    }

    return { recycleGardenBlockForAccount, updateGardenBlockForAccount };
}

export async function validateRotatedBlockPlacementUnavailable(): Promise<ValidateRotatedBlockPlacementResult> {
    return {
        valid: false,
        code: 'ROTATION_VALIDATION_UNAVAILABLE',
        error: 'Garden block rotation validation is unavailable.',
        status: 503,
    };
}

const defaultDependencies: GardenBlockMutationDependencies<GardenPlacementTransaction> =
    {
        bustScheduleCache,
        earnSunflowersOnce,
        getBlockData,
        getGardenPlacementSnapshotForUpdate,
        listGardenRaisedBedMetadataForUpdate,
        listGardenStructures,
        softDeleteGardenBlockOnce,
        softDeleteNewRaisedBedOnce,
        updateGardenBlock,
        updateGardenStack,
        updateRaisedBedOrientation,
        validatePersistedStructuresAfterBlockMutation,
        validateRotatedBlockPlacement,
        withAccountDeletionFenceTransaction,
        withGardenPlacementTransaction,
        withSunflowerAccountTransaction,
    };

export const { recycleGardenBlockForAccount, updateGardenBlockForAccount } =
    createGardenBlockMutationService(defaultDependencies);
