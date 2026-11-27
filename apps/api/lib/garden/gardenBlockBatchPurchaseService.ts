import { createHash } from 'node:crypto';
import type { BlockData } from '@gredice/directory-types';
import {
    type GardenBlockBatchPlacementConflict,
    type GardenBlockExpansionIneligibleReason,
    gardenBlockExpansionLimits,
    getGardenBlockExpansionEligibility,
    validateGardenBlockBatchPlacements,
} from '@gredice/js/gardenBlockExpansion';
import {
    createGardenBlockPlacementValidator,
    type GardenBlockQuarterTurns,
    normalizeGardenBlockRotation,
} from '@gredice/js/gardenBlocks';
import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    appendBlocksToGardenStacks,
    type CreateGardenBlocksInput,
    createGardenBlocks,
    GardenMutationOperationConflictError,
    type GardenMutationOperationExecution,
    type GardenPlacementTransaction,
    getGardenMutationAuthorityForUpdate,
    getGardenMutationOperationReceipt,
    getGardenPlacementLocation,
    getGardenPlacementSnapshotForUpdate,
    hashGardenMutationOperationPayload,
    InsufficientSunflowersError,
    spendSunflowersBatch,
    withAccountDeletionFenceTransaction,
    withGardenMutationOperation,
    withGardenPlacementTransaction,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import {
    type GardenBlockBatchPurchaseBody,
    type GardenBlockBatchPurchaseReceipt,
    gardenBlockBatchPurchaseBodySchema,
    gardenBlockBatchPurchaseReceiptSchema,
} from '@gredice/storage/gardenBlockBatchPurchaseContract';
import { getBlockData } from '../blocks/blockDataService';
import { settleGardenEconomicMutationDependency } from './gardenEconomicMutationDependency';
import { isBlockPurchaseAvailableNow } from './nightOnlyBlockPurchases';

type GardenBlockBatchSnapshot = Readonly<{
    garden: Readonly<{
        id: number;
        accountId: string;
        isSandbox: boolean;
    }>;
    blocks: readonly Readonly<{
        id: string;
        name: string;
        rotation?: number | null;
    }>[];
    stacks: readonly Readonly<{
        blocks: string[];
        positionX: number;
        positionY: number;
    }>[];
}>;

type GardenBlockBatchLocation = Readonly<{
    lat: number | null | undefined;
    lon: number | null | undefined;
}> | null;

export type GardenBlockBatchPurchaseDependencies<Transaction> = Readonly<{
    /**
     * Write every target stack's full block list (existing blocks plus the
     * new one) in a fixed number of statements, creating or reviving stacks.
     */
    appendBlocksToGardenStacks: (
        gardenId: number,
        stacks: readonly Readonly<{
            x: number;
            y: number;
            blocks: readonly string[];
        }>[],
        transaction: Transaction,
    ) => Promise<unknown>;
    /**
     * Insert all blocks with one statement, each recording the Sunflowers
     * paid for it, and return their IDs in input order.
     */
    createGardenBlocks: (
        gardenId: number,
        blocks: readonly CreateGardenBlocksInput[],
        transaction: Transaction,
    ) => Promise<readonly string[]>;
    debitSunflowers: (
        accountId: string,
        amount: number,
        reason: string,
        transaction: Transaction,
    ) => Promise<unknown>;
    getBlockData: () => Promise<readonly BlockData[]>;
    dependencyPreparationTimeoutMs?: number;
    getGardenLocation: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<GardenBlockBatchLocation>;
    getGardenMutationAuthorityForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<Readonly<{
        accountId: string;
        id: number;
        isDeleted: boolean;
        isSandbox: boolean;
    }> | null>;
    getGardenPlacementSnapshotForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<GardenBlockBatchSnapshot | null>;
    isBlockPurchaseAvailableNow: typeof isBlockPurchaseAvailableNow;
    now: () => Date;
    withAccountDeletionFenceTransaction: <Result>(
        accountId: string,
        callback: (transaction: Transaction) => Promise<Result>,
        transaction: Transaction,
    ) => Promise<Result>;
    withGardenMutationOperation: (
        input: Readonly<{
            gardenId: number;
            kind: 'block-purchase-batch';
            operationId: string;
            payload: unknown;
        }>,
        callback: (
            transaction: Transaction,
        ) => Promise<Readonly<{ response: unknown }>>,
        transaction: Transaction,
    ) => Promise<GardenMutationOperationExecution>;
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

export type GardenBlockBatchPurchaseCommand = Readonly<{
    accountId: string;
    gardenId: number;
    operationId: string;
    blockName: string;
    rotation: number | null;
    expectedUnitPrice: number;
    placements: readonly Readonly<{
        position: Readonly<{ x: number; y: number }>;
        expectedExistingBlocks: readonly string[];
    }>[];
}>;

export type GardenBlockBatchPurchaseFailureCode =
    | 'BLOCK_DIRECTORY_UNAVAILABLE'
    | 'BLOCK_NOT_EXPANDABLE'
    | 'BLOCK_NOT_FOR_SALE'
    | 'BLOCK_NOT_FOUND'
    | 'BLOCK_NOT_PURCHASABLE_NOW'
    | 'EXPANSION_AREA_TOO_LARGE'
    | 'GARDEN_NOT_FOUND'
    | 'GARDEN_STATE_CHANGED'
    | 'INSUFFICIENT_SUNFLOWERS'
    | 'INVALID_REQUEST'
    | 'OPERATION_CONFLICT'
    | 'OPERATION_FAILED'
    | 'PRICE_CHANGED';

export type GardenBlockBatchPurchaseFailureStatus = 400 | 404 | 409 | 500 | 503;

export type GardenBlockBatchPurchaseFailureDetails = Readonly<{
    affordableCount?: number;
    availableAmount?: number;
    conflicts?: readonly GardenBlockBatchPlacementConflict[];
    maxPlacements?: number;
    maxSide?: number;
    reason?: GardenBlockExpansionIneligibleReason;
    requiredAmount?: number;
    unitPrice?: number;
}>;

export type GardenBlockBatchPurchaseSuccess = Readonly<
    GardenBlockBatchPurchaseReceipt & {
        ok: true;
        replayed: boolean;
    }
>;

export type GardenBlockBatchPurchaseFailure = Readonly<{
    ok: false;
    code: GardenBlockBatchPurchaseFailureCode;
    details: GardenBlockBatchPurchaseFailureDetails;
    error: string;
    status: GardenBlockBatchPurchaseFailureStatus;
}>;

export type GardenBlockBatchPurchaseResult =
    | GardenBlockBatchPurchaseSuccess
    | GardenBlockBatchPurchaseFailure;

class GardenBlockBatchPurchaseError extends Error {
    override readonly name = 'GardenBlockBatchPurchaseError';

    constructor(
        readonly code: GardenBlockBatchPurchaseFailureCode,
        readonly status: GardenBlockBatchPurchaseFailureStatus,
        message: string,
        readonly details: GardenBlockBatchPurchaseFailureDetails = {},
    ) {
        super(message);
    }
}

function fail(
    code: GardenBlockBatchPurchaseFailureCode,
    status: GardenBlockBatchPurchaseFailureStatus,
    message: string,
    details?: GardenBlockBatchPurchaseFailureDetails,
): never {
    throw new GardenBlockBatchPurchaseError(code, status, message, details);
}

/** Debit reason of one batch; refunds stay per block. */
export function gardenBlockBatchDebitReason(
    gardenId: number,
    operationId: string,
) {
    return `gardenBlock:${gardenId.toString()}:expand:${operationId}`;
}

function expectedStackDigest(blockIds: readonly string[]) {
    return createHash('sha256').update(JSON.stringify(blockIds)).digest('hex');
}

/**
 * The receipt payload that identifies one batch command. Each expected stack
 * is reduced to a SHA-256 digest so 100 placements on tall stacks stay far
 * below the receipt's 32 KiB and 4 096-value limits; the full lists are still
 * checked against the locked garden. `rotation` is the normalized value.
 */
export function gardenBlockBatchPurchaseOperationPayload(
    body: GardenBlockBatchPurchaseBody,
    rotation: GardenBlockQuarterTurns,
) {
    return {
        schemaVersion: 1,
        blockName: body.blockName,
        rotation,
        expectedUnitPrice: body.expectedUnitPrice,
        placements: body.placements.map((placement) => ({
            x: placement.position.x,
            y: placement.position.y,
            stack: expectedStackDigest(placement.expectedExistingBlocks),
        })),
    };
}

export type GardenBlockBatchPurchaseReplayCheckDependencies = Readonly<{
    getGardenMutationOperationReceipt: (
        input: Readonly<{ gardenId: number; operationId: string }>,
    ) => Promise<Readonly<{ kind: string; payloadHash: string }> | null>;
    warn: (message: string, context: Readonly<Record<string, unknown>>) => void;
}>;

/**
 * True when `(gardenId, operationId)` already holds a committed
 * `block-purchase-batch` receipt for exactly this body. The purchase service
 * then only replays that receipt: no debit and no write. The route lets
 * such retries past a denied rate limit, because a client whose response
 * was lost must be able to confirm the purchase, and a 429 would tell it
 * the purchase failed. The service still checks garden ownership before it
 * replays. Read failures count as "not a replay", so the limit stays.
 */
export function createGardenBlockBatchPurchaseReplayCheck(
    dependencies: GardenBlockBatchPurchaseReplayCheckDependencies,
) {
    return async function isGardenBlockBatchPurchaseReplay(
        input: Readonly<{
            body: GardenBlockBatchPurchaseBody;
            gardenId: number;
        }>,
    ) {
        const { body, gardenId } = input;
        try {
            const receipt =
                await dependencies.getGardenMutationOperationReceipt({
                    gardenId,
                    operationId: body.operationId,
                });
            return (
                receipt?.kind === 'block-purchase-batch' &&
                receipt.payloadHash ===
                    hashGardenMutationOperationPayload(
                        gardenBlockBatchPurchaseOperationPayload(
                            body,
                            normalizeGardenBlockRotation(body.rotation),
                        ),
                    )
            );
        } catch (error) {
            dependencies.warn('Garden block batch replay check failed', {
                errorName: error instanceof Error ? error.name : undefined,
                gardenId,
                operationId: body.operationId,
            });
            return false;
        }
    };
}

export const isGardenBlockBatchPurchaseReplay =
    createGardenBlockBatchPurchaseReplayCheck({
        getGardenMutationOperationReceipt: (input) =>
            getGardenMutationOperationReceipt(input),
        warn: (message, context) => console.warn(message, context),
    });

function parseCommand(command: GardenBlockBatchPurchaseCommand) {
    if (!command.accountId.trim()) {
        fail('GARDEN_NOT_FOUND', 404, 'Garden not found');
    }
    if (!Number.isSafeInteger(command.gardenId) || command.gardenId <= 0) {
        fail('GARDEN_NOT_FOUND', 404, 'Garden not found');
    }
    const parsed = gardenBlockBatchPurchaseBodySchema.safeParse({
        blockName: command.blockName,
        expectedUnitPrice: command.expectedUnitPrice,
        operationId: command.operationId,
        placements: command.placements,
        rotation: command.rotation,
    });
    if (!parsed.success) {
        fail('INVALID_REQUEST', 400, 'Garden block batch request is invalid');
    }
    return parsed.data;
}

function findRequestedBlock(
    blockData: readonly BlockData[],
    blockName: string,
) {
    const matches = blockData.filter(
        (candidate) => candidate.information?.name === blockName,
    );
    if (matches.length > 1) {
        fail(
            'BLOCK_DIRECTORY_UNAVAILABLE',
            503,
            'Garden block directory data is inconsistent',
        );
    }
    const block = matches[0];
    if (!block) {
        fail('BLOCK_NOT_FOUND', 404, 'Requested block not found');
    }
    return block;
}

function authoritativeCost(block: BlockData) {
    const cost = block.prices?.sunflowers ?? 0;
    if (!Number.isSafeInteger(cost) || cost < 0) {
        fail(
            'BLOCK_DIRECTORY_UNAVAILABLE',
            503,
            'Garden block price data is invalid',
        );
    }
    return cost;
}

async function loadBlockData<Transaction>(
    dependencies: GardenBlockBatchPurchaseDependencies<Transaction>,
) {
    try {
        return await dependencies.getBlockData();
    } catch {
        fail(
            'BLOCK_DIRECTORY_UNAVAILABLE',
            503,
            'Garden block directory data is unavailable',
        );
    }
}

function failureFrom(error: unknown): GardenBlockBatchPurchaseFailure | null {
    if (error instanceof GardenBlockBatchPurchaseError) {
        return {
            ok: false,
            code: error.code,
            details: error.details,
            error: error.message,
            status: error.status,
        };
    }
    if (error instanceof GardenMutationOperationConflictError) {
        return {
            ok: false,
            code: 'OPERATION_CONFLICT',
            details: {},
            error: error.message,
            status: 409,
        };
    }
    if (error instanceof AccountNotFoundError) {
        return {
            ok: false,
            code: 'GARDEN_NOT_FOUND',
            details: {},
            error: 'Garden not found',
            status: 404,
        };
    }
    if (error instanceof AccountDeletionInProgressError) {
        return {
            ok: false,
            code: 'GARDEN_STATE_CHANGED',
            details: { conflicts: [] },
            error: 'Account is being deleted',
            status: 409,
        };
    }
    return null;
}

export function createGardenBlockBatchPurchaseService<Transaction>(
    dependencies: GardenBlockBatchPurchaseDependencies<Transaction>,
) {
    return async function purchaseGardenBlockBatch(
        command: GardenBlockBatchPurchaseCommand,
    ): Promise<GardenBlockBatchPurchaseResult> {
        try {
            const body = parseCommand(command);
            const { accountId, gardenId } = command;
            const { blockName, operationId } = body;
            const rotation = normalizeGardenBlockRotation(body.rotation);
            const blockDataResult =
                await settleGardenEconomicMutationDependency(
                    () => loadBlockData(dependencies),
                    dependencies.dependencyPreparationTimeoutMs,
                );

            const placeBatch = async (transaction: Transaction) => {
                const snapshot =
                    await dependencies.getGardenPlacementSnapshotForUpdate(
                        gardenId,
                        transaction,
                    );
                if (!snapshot || snapshot.garden.accountId !== accountId) {
                    fail('GARDEN_NOT_FOUND', 404, 'Garden not found');
                }
                if (blockDataResult.status === 'rejected') {
                    fail(
                        'BLOCK_DIRECTORY_UNAVAILABLE',
                        503,
                        'Garden block directory data is unavailable',
                    );
                }
                const blockData = blockDataResult.value;
                const requestedBlock = findRequestedBlock(blockData, blockName);
                const eligibility = getGardenBlockExpansionEligibility({
                    blockName,
                    blockData: requestedBlock,
                    rotation,
                });
                if (!eligibility.eligible) {
                    fail(
                        'BLOCK_NOT_EXPANDABLE',
                        400,
                        'Requested block cannot be expanded',
                        { reason: eligibility.reason },
                    );
                }

                const directoryPrice = authoritativeCost(requestedBlock);
                const isSandbox = snapshot.garden.isSandbox;
                if (!isSandbox) {
                    if (directoryPrice <= 0) {
                        fail(
                            'BLOCK_NOT_FOR_SALE',
                            400,
                            'Requested block not for sale',
                        );
                    }
                    const location = await dependencies.getGardenLocation(
                        gardenId,
                        transaction,
                    );
                    if (
                        !dependencies.isBlockPurchaseAvailableNow({
                            block: requestedBlock,
                            currentTime: dependencies.now(),
                            location,
                        })
                    ) {
                        fail(
                            'BLOCK_NOT_PURCHASABLE_NOW',
                            400,
                            'Requested block can only be bought at night',
                        );
                    }
                }
                // Sandbox gardens are free, so clients must expect 0 there.
                const unitPrice = isSandbox ? 0 : directoryPrice;
                if (body.expectedUnitPrice !== unitPrice) {
                    fail(
                        'PRICE_CHANGED',
                        409,
                        'Requested block price changed',
                        { unitPrice },
                    );
                }

                const validator = createGardenBlockPlacementValidator({
                    blockName,
                    stacks: snapshot.stacks.map((stack) => ({
                        blocks: [...stack.blocks],
                        positionX: stack.positionX,
                        positionY: stack.positionY,
                    })),
                    blockNameById: new Map(
                        snapshot.blocks.map((block) => [block.id, block.name]),
                    ),
                    blockDataByName: new Map(
                        blockData.map((block) => [
                            block.information.name,
                            block,
                        ]),
                    ),
                    blockRotationById: new Map(
                        snapshot.blocks.map((block) => [
                            block.id,
                            block.rotation,
                        ]),
                    ),
                });
                const check = validateGardenBlockBatchPlacements({
                    blockName,
                    rotation,
                    placements: body.placements,
                    validator,
                    limits: gardenBlockExpansionLimits,
                });
                if (!check.ok) {
                    if ('conflicts' in check) {
                        fail(
                            'GARDEN_STATE_CHANGED',
                            409,
                            'Garden changed since the expansion was planned',
                            { conflicts: check.conflicts },
                        );
                    }
                    fail(
                        'EXPANSION_AREA_TOO_LARGE',
                        400,
                        'Expansion area is too large',
                        {
                            maxPlacements:
                                gardenBlockExpansionLimits.maxPlacements,
                            maxSide: gardenBlockExpansionLimits.maxSide,
                        },
                    );
                }

                // One debit for the whole batch, before any write so an
                // unaffordable request fails fast; the transaction makes
                // the order irrelevant to the outcome.
                const chargedSunflowers = unitPrice * body.placements.length;
                if (chargedSunflowers > 0) {
                    try {
                        await dependencies.debitSunflowers(
                            accountId,
                            chargedSunflowers,
                            gardenBlockBatchDebitReason(gardenId, operationId),
                            transaction,
                        );
                    } catch (error) {
                        if (error instanceof InsufficientSunflowersError) {
                            fail(
                                'INSUFFICIENT_SUNFLOWERS',
                                400,
                                'Insufficient sunflowers',
                                {
                                    affordableCount: Math.max(
                                        0,
                                        Math.floor(
                                            error.availableAmount / unitPrice,
                                        ),
                                    ),
                                    availableAmount: error.availableAmount,
                                    requiredAmount: error.requiredAmount,
                                },
                            );
                        }
                        throw error;
                    }
                }

                const blockIds = await dependencies.createGardenBlocks(
                    gardenId,
                    body.placements.map(() => ({
                        name: blockName,
                        paidSunflowers: unitPrice,
                        rotation,
                        variant: null,
                    })),
                    transaction,
                );
                if (blockIds.length !== body.placements.length) {
                    throw new Error(
                        'Garden block batch insert returned unexpected IDs',
                    );
                }
                const created = body.placements.map((placement, index) => {
                    const id = blockIds[index];
                    if (!id) {
                        throw new Error(
                            'Garden block batch insert returned unexpected IDs',
                        );
                    }
                    return { id, placement };
                });
                // Each 1×1 copy lands on the stack the client expected, which
                // the batch check proved equal to the locked snapshot.
                await dependencies.appendBlocksToGardenStacks(
                    gardenId,
                    created.map(({ id, placement }) => ({
                        x: placement.position.x,
                        y: placement.position.y,
                        blocks: [...placement.expectedExistingBlocks, id],
                    })),
                    transaction,
                );

                const receipt: GardenBlockBatchPurchaseReceipt = {
                    operationId,
                    blockName,
                    rotation,
                    unitPrice,
                    chargedSunflowers,
                    placements: created.map(({ id, placement }) => ({
                        id,
                        position: {
                            x: placement.position.x,
                            y: placement.position.y,
                        },
                    })),
                };
                return { response: receipt };
            };

            return await dependencies.withSunflowerAccountTransaction(
                accountId,
                (sunflowerTransaction) =>
                    dependencies.withAccountDeletionFenceTransaction(
                        accountId,
                        (accountTransaction) =>
                            dependencies.withGardenPlacementTransaction(
                                gardenId,
                                async (gardenTransaction) => {
                                    const authority =
                                        await dependencies.getGardenMutationAuthorityForUpdate(
                                            gardenId,
                                            gardenTransaction,
                                        );
                                    if (
                                        !authority ||
                                        authority.accountId !== accountId
                                    ) {
                                        fail(
                                            'GARDEN_NOT_FOUND',
                                            404,
                                            'Garden not found',
                                        );
                                    }
                                    const execution =
                                        await dependencies.withGardenMutationOperation(
                                            {
                                                gardenId,
                                                kind: 'block-purchase-batch',
                                                operationId,
                                                payload:
                                                    gardenBlockBatchPurchaseOperationPayload(
                                                        body,
                                                        rotation,
                                                    ),
                                            },
                                            placeBatch,
                                            gardenTransaction,
                                        );
                                    const stored =
                                        gardenBlockBatchPurchaseReceiptSchema.safeParse(
                                            execution.receipt.response,
                                        );
                                    if (
                                        !stored.success ||
                                        stored.data.operationId !== operationId
                                    ) {
                                        throw new Error(
                                            'Stored garden block batch receipt is invalid',
                                        );
                                    }
                                    return {
                                        ok: true,
                                        ...stored.data,
                                        replayed: execution.replayed,
                                    } satisfies GardenBlockBatchPurchaseSuccess;
                                },
                                accountTransaction,
                            ),
                        sunflowerTransaction,
                    ),
            );
        } catch (error) {
            const failure = failureFrom(error);
            if (failure) return failure;
            console.error('Failed to place garden block batch atomically', {
                blockName: command.blockName,
                error,
                gardenId: command.gardenId,
                operationId: command.operationId,
                placementCount: Array.isArray(command.placements)
                    ? command.placements.length
                    : null,
            });
            return {
                ok: false,
                code: 'OPERATION_FAILED',
                details: {},
                error: 'Failed to place garden block batch',
                status: 500,
            };
        }
    };
}

const defaultDependencies: GardenBlockBatchPurchaseDependencies<GardenPlacementTransaction> =
    {
        appendBlocksToGardenStacks: (gardenId, stacks, transaction) =>
            appendBlocksToGardenStacks(gardenId, stacks, transaction),
        createGardenBlocks: (gardenId, blocks, transaction) =>
            createGardenBlocks(gardenId, blocks, transaction),
        debitSunflowers: async (accountId, amount, reason, transaction) => {
            await spendSunflowersBatch(
                accountId,
                [{ amount, reason }],
                transaction,
            );
        },
        getBlockData,
        getGardenLocation: getGardenPlacementLocation,
        getGardenMutationAuthorityForUpdate,
        getGardenPlacementSnapshotForUpdate,
        isBlockPurchaseAvailableNow,
        now: () => new Date(),
        withAccountDeletionFenceTransaction,
        withGardenMutationOperation: (input, callback, transaction) =>
            withGardenMutationOperation(input, callback, transaction),
        withGardenPlacementTransaction,
        withSunflowerAccountTransaction,
    };

export const purchaseGardenBlockBatch =
    createGardenBlockBatchPurchaseService(defaultDependencies);
