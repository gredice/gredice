import type { BlockData } from '@gredice/directory-types';
import {
    createEntityAppearanceVariantForPlacement,
    isAppearanceVariantEntityName,
    isValidEntityAppearanceVariant,
    requiresExplicitAppearanceVariantSelection,
} from '@gredice/js/entityAppearanceVariants';
import type { GardenBlockPlacementResult } from '@gredice/js/gardenBlocks';
import type { GardenOccupancyIndex } from '@gredice/js/gardenOccupancy';
import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    createGardenBlock,
    createGardenStack,
    createRaisedBed,
    GardenMutationOperationConflictError,
    type GardenMutationOperationExecution,
    type GardenMutationOperationStoredResponse,
    type GardenPlacementTransaction,
    getGarden,
    getGardenPlacementSnapshotForUpdate,
    InsufficientSunflowersError,
    listGardenStructures,
    spendSunflowersBatch,
    updateGardenStack,
    withAccountDeletionFenceTransaction,
    withGardenMutationOperation,
    withGardenPlacementTransaction,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import { getBlockData } from '../blocks/blockDataService';
import { resolveGardenBlockPlacement } from './blockPlacementService';
import {
    createGardenOccupancyIndexFromStorageSnapshot,
    type GardenOccupancyServiceError,
    type GardenOccupancyStorageStructureLike,
    validatePersistedStructuresAfterBlockMutation,
} from './gardenOccupancyService';
import { isBlockPurchaseAvailableNow } from './nightOnlyBlockPurchases';

const blockIdentifierMaxLength = 128;
const operationIdentifierMaxLength = 96;

type GardenBlockPurchaseSnapshot = Readonly<{
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

type GardenPurchaseLocation = Readonly<{
    lat: number | null | undefined;
    lon: number | null | undefined;
}> | null;

export type PurchaseGardenBlockDependencies<Transaction> = Readonly<{
    createGardenBlock: (
        gardenId: number,
        blockName: string,
        variant: number | null,
        transaction: Transaction,
    ) => Promise<string>;
    createGardenOccupancyIndexFromStorageSnapshot: typeof createGardenOccupancyIndexFromStorageSnapshot;
    createGardenStack: (
        gardenId: number,
        position: Readonly<{ x: number; y: number }>,
        transaction: Transaction,
    ) => Promise<unknown>;
    createRaisedBed: (
        input: Readonly<{
            accountId: string;
            blockId: string;
            gardenId: number;
            status: 'new';
        }>,
        transaction: Transaction,
    ) => Promise<number>;
    createAppearanceVariant: (
        blockName: string,
        random: () => number,
    ) => number | undefined;
    debitSunflowers: (
        accountId: string,
        amount: number,
        reason: string,
        transaction: Transaction,
    ) => Promise<unknown>;
    getBlockData: () => Promise<readonly BlockData[]>;
    getGardenLocation: (gardenId: number) => Promise<GardenPurchaseLocation>;
    getGardenPlacementSnapshotForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<GardenBlockPurchaseSnapshot | null>;
    isBlockPurchaseAvailableNow: typeof isBlockPurchaseAvailableNow;
    listGardenStructures: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<readonly GardenOccupancyStorageStructureLike[]>;
    now: () => Date;
    random: () => number;
    resolveGardenBlockPlacement: (input: {
        blockName: string;
        blockedCells?: ReadonlySet<string>;
        stacks: {
            positionX: number;
            positionY: number;
            blocks: string[];
        }[];
        blockNameById: Map<string, string>;
        blockDataByName: Map<string, BlockData>;
        blockRotationById?: Map<string, number | null | undefined>;
        requestedPosition?: Readonly<{ x: number; y: number }>;
    }) => GardenBlockPlacementResult;
    updateGardenStack: (
        gardenId: number,
        stack: Readonly<{ x: number; y: number; blocks: string[] }>,
        transaction: Transaction,
    ) => Promise<unknown>;
    validatePersistedStructuresAfterBlockMutation: typeof validatePersistedStructuresAfterBlockMutation;
    withAccountDeletionFenceTransaction: <Result>(
        accountId: string,
        callback: (transaction: Transaction) => Promise<Result>,
        transaction: Transaction,
    ) => Promise<Result>;
    withGardenMutationOperation: (
        input: Readonly<{
            gardenId: number;
            kind: 'block-purchase';
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

export type PurchaseGardenBlockCommand = Readonly<{
    accountId: string;
    blockName: string;
    expectedExistingBlocks?: readonly string[];
    gardenId: number;
    operationId: string;
    position?: Readonly<{ x: number; y: number }>;
    variant?: number;
}>;

type PurchaseGardenBlockFailureCode =
    | 'APPEARANCE_VARIANT_INVALID'
    | 'APPEARANCE_VARIANT_REQUIRED'
    | 'BLOCK_DIRECTORY_INVALID'
    | 'BLOCK_DIRECTORY_UNAVAILABLE'
    | 'BLOCK_NOT_FOUND'
    | 'BLOCK_NOT_FOR_SALE'
    | 'BLOCK_NOT_PURCHASABLE_NOW'
    | 'BLOCK_PLACEMENT_INVALID'
    | 'GARDEN_NOT_FOUND'
    | 'GARDEN_OCCUPANCY_CONFLICT'
    | 'GARDEN_OCCUPANCY_INVALID_INPUT'
    | 'GARDEN_OCCUPANCY_INVALID_STATE'
    | 'GARDEN_STATE_CHANGED'
    | 'INSUFFICIENT_SUNFLOWERS'
    | 'OPERATION_CONFLICT'
    | 'OPERATION_FAILED'
    | 'OPERATION_RECEIPT_INVALID';

type PurchaseGardenBlockStatus = 400 | 404 | 409 | 500 | 503;

export type PurchaseGardenBlockSuccess = Readonly<{
    ok: true;
    blockId: string;
    position: Readonly<{ x: number; y: number }>;
    replayed: boolean;
    variant: number | null;
}>;

export type PurchaseGardenBlockResult =
    | PurchaseGardenBlockSuccess
    | Readonly<{
          ok: false;
          code: PurchaseGardenBlockFailureCode;
          error: string;
          status: PurchaseGardenBlockStatus;
      }>;

class PurchaseGardenBlockError extends Error {
    override readonly name = 'PurchaseGardenBlockError';

    constructor(
        readonly code: PurchaseGardenBlockFailureCode,
        readonly status: PurchaseGardenBlockStatus,
        message: string,
    ) {
        super(message);
    }
}

function fail(
    code: PurchaseGardenBlockFailureCode,
    status: PurchaseGardenBlockStatus,
    message: string,
): never {
    throw new PurchaseGardenBlockError(code, status, message);
}

function failOccupancy(error: GardenOccupancyServiceError): never {
    throw new PurchaseGardenBlockError(error.code, error.status, error.message);
}

function assertBoundedIdentifier(value: string, name: string, limit: number) {
    if (!value || value.trim() !== value || value.length > limit) {
        fail('BLOCK_PLACEMENT_INVALID', 400, `${name} is invalid`);
    }
}

function assertCommand(command: PurchaseGardenBlockCommand) {
    if (!command.accountId.trim()) {
        fail('GARDEN_NOT_FOUND', 404, 'Garden not found');
    }
    if (!Number.isSafeInteger(command.gardenId) || command.gardenId <= 0) {
        fail('GARDEN_NOT_FOUND', 404, 'Garden not found');
    }
    assertBoundedIdentifier(
        command.blockName,
        'Garden block name',
        blockIdentifierMaxLength,
    );
    assertBoundedIdentifier(
        command.operationId,
        'Garden block operation ID',
        operationIdentifierMaxLength,
    );
    if (
        command.position &&
        (!Number.isSafeInteger(command.position.x) ||
            !Number.isSafeInteger(command.position.y))
    ) {
        fail(
            'BLOCK_PLACEMENT_INVALID',
            400,
            'Garden block position is invalid',
        );
    }
    if (
        command.expectedExistingBlocks &&
        (command.expectedExistingBlocks.length > 128 ||
            command.expectedExistingBlocks.some(
                (blockId) =>
                    !blockId ||
                    blockId.trim() !== blockId ||
                    blockId.length > blockIdentifierMaxLength,
            ))
    ) {
        fail(
            'BLOCK_PLACEMENT_INVALID',
            400,
            'Expected garden block stack is invalid',
        );
    }
}

function findRequestedBlock(
    blockData: readonly BlockData[],
    blockName: string,
) {
    const matches = blockData.filter(
        (candidate) => candidate.information?.name === blockName,
    );
    if (matches.length === 0) {
        fail('BLOCK_NOT_FOUND', 400, 'Requested block not found');
    }
    if (matches.length > 1) {
        fail(
            'BLOCK_DIRECTORY_INVALID',
            503,
            'Garden block directory data is inconsistent',
        );
    }
    const block = matches[0];
    if (!block) {
        fail('BLOCK_NOT_FOUND', 400, 'Requested block not found');
    }
    return block;
}

function assertAppearanceRequest(blockName: string, variant?: number) {
    if (!isAppearanceVariantEntityName(blockName)) {
        if (variant !== undefined) {
            fail(
                'APPEARANCE_VARIANT_INVALID',
                400,
                'Ovaj predmet nema varijante izgleda.',
            );
        }
        return;
    }
    if (
        variant !== undefined &&
        !isValidEntityAppearanceVariant(blockName, variant)
    ) {
        fail(
            'APPEARANCE_VARIANT_INVALID',
            400,
            'Neispravna varijanta izgleda predmeta.',
        );
    }
    if (
        variant === undefined &&
        requiresExplicitAppearanceVariantSelection(blockName)
    ) {
        fail(
            'APPEARANCE_VARIANT_REQUIRED',
            400,
            'Odaberi boju konja prije postavljanja.',
        );
    }
}

function authoritativeCost(block: BlockData) {
    const cost = block.prices?.sunflowers ?? 0;
    if (!Number.isSafeInteger(cost) || cost < 0) {
        fail(
            'BLOCK_DIRECTORY_INVALID',
            503,
            'Garden block price data is invalid',
        );
    }
    return cost;
}

function structureOccupiedCellKeys(index: GardenOccupancyIndex) {
    const blockedCells = new Set<string>();
    for (const [key, cell] of index.cells) {
        if (cell.structureIds.length > 0) blockedCells.add(key);
    }
    return blockedCells;
}

function expectedStackMatches(
    expected: readonly string[] | undefined,
    actual: readonly string[],
) {
    return (
        expected === undefined ||
        (expected.length === actual.length &&
            expected.every((blockId, index) => blockId === actual[index]))
    );
}

function candidateSnapshotAfterPlacement(
    snapshot: GardenBlockPurchaseSnapshot,
    placement: Readonly<{
        existingBlocks: readonly string[];
        x: number;
        y: number;
    }>,
    block: Readonly<{ id: string; name: string }>,
) {
    const target = snapshot.stacks.find(
        (stack) =>
            stack.positionX === placement.x && stack.positionY === placement.y,
    );
    const nextBlocks = [...placement.existingBlocks, block.id];
    return {
        blocks: [...snapshot.blocks, { ...block, rotation: null }],
        stacks: target
            ? snapshot.stacks.map((stack) =>
                  stack === target ? { ...stack, blocks: nextBlocks } : stack,
              )
            : [
                  ...snapshot.stacks,
                  {
                      blocks: nextBlocks,
                      positionX: placement.x,
                      positionY: placement.y,
                  },
              ],
    };
}

function operationPayload(command: PurchaseGardenBlockCommand) {
    return {
        schemaVersion: 1,
        blockName: command.blockName,
        expectedExistingBlocks: command.expectedExistingBlocks ?? null,
        position: command.position ?? null,
        variant: command.variant ?? null,
    } as const;
}

function decodeStoredResponse(
    response: GardenMutationOperationStoredResponse,
): Omit<PurchaseGardenBlockSuccess, 'ok' | 'replayed'> | null {
    const { id, position, variant } = response;
    if (typeof id !== 'string' || !id || !isStoredResponseObject(position)) {
        return null;
    }
    const { x, y } = position;
    if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        !Number.isSafeInteger(x) ||
        !Number.isSafeInteger(y) ||
        (variant !== null &&
            (typeof variant !== 'number' || !Number.isSafeInteger(variant)))
    ) {
        return null;
    }
    return {
        blockId: id,
        position: { x, y },
        variant,
    };
}

function isStoredResponseObject(
    value: unknown,
): value is GardenMutationOperationStoredResponse {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function failureFrom(error: unknown): PurchaseGardenBlockResult | null {
    if (error instanceof PurchaseGardenBlockError) {
        return {
            ok: false,
            code: error.code,
            error: error.message,
            status: error.status,
        };
    }
    if (error instanceof GardenMutationOperationConflictError) {
        return {
            ok: false,
            code: 'OPERATION_CONFLICT',
            error: error.message,
            status: 409,
        };
    }
    if (error instanceof InsufficientSunflowersError) {
        return {
            ok: false,
            code: 'INSUFFICIENT_SUNFLOWERS',
            error: error.message,
            status: 400,
        };
    }
    if (error instanceof AccountNotFoundError) {
        return {
            ok: false,
            code: 'GARDEN_NOT_FOUND',
            error: 'Garden not found',
            status: 404,
        };
    }
    if (error instanceof AccountDeletionInProgressError) {
        return {
            ok: false,
            code: 'GARDEN_STATE_CHANGED',
            error: 'Account is being deleted',
            status: 409,
        };
    }
    return null;
}

async function loadBlockData<Transaction>(
    dependencies: PurchaseGardenBlockDependencies<Transaction>,
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

export function createPurchaseGardenBlockService<Transaction>(
    dependencies: PurchaseGardenBlockDependencies<Transaction>,
) {
    return async function purchaseGardenBlock(
        command: PurchaseGardenBlockCommand,
    ): Promise<PurchaseGardenBlockResult> {
        try {
            assertCommand(command);
            return await dependencies.withSunflowerAccountTransaction(
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

                                    const execution =
                                        await dependencies.withGardenMutationOperation(
                                            {
                                                gardenId: command.gardenId,
                                                kind: 'block-purchase',
                                                operationId:
                                                    command.operationId,
                                                payload:
                                                    operationPayload(command),
                                            },
                                            async (operationTransaction) => {
                                                const blockData =
                                                    await loadBlockData(
                                                        dependencies,
                                                    );
                                                const requestedBlock =
                                                    findRequestedBlock(
                                                        blockData,
                                                        command.blockName,
                                                    );
                                                assertAppearanceRequest(
                                                    command.blockName,
                                                    command.variant,
                                                );
                                                const cost =
                                                    authoritativeCost(
                                                        requestedBlock,
                                                    );
                                                const location =
                                                    await dependencies.getGardenLocation(
                                                        command.gardenId,
                                                    );
                                                if (
                                                    !snapshot.garden.isSandbox
                                                ) {
                                                    if (cost <= 0) {
                                                        fail(
                                                            'BLOCK_NOT_FOR_SALE',
                                                            400,
                                                            'Requested block not for sale',
                                                        );
                                                    }
                                                    if (
                                                        !dependencies.isBlockPurchaseAvailableNow(
                                                            {
                                                                block: requestedBlock,
                                                                currentTime:
                                                                    dependencies.now(),
                                                                location,
                                                            },
                                                        )
                                                    ) {
                                                        fail(
                                                            'BLOCK_NOT_PURCHASABLE_NOW',
                                                            400,
                                                            'Ovaj blok moguće je kupiti samo noću.',
                                                        );
                                                    }
                                                }
                                                const structures =
                                                    await dependencies.listGardenStructures(
                                                        command.gardenId,
                                                        operationTransaction,
                                                    );
                                                const occupancy =
                                                    dependencies.createGardenOccupancyIndexFromStorageSnapshot(
                                                        {
                                                            blockData,
                                                            snapshot: {
                                                                blocks: snapshot.blocks,
                                                                stacks: snapshot.stacks,
                                                                structures,
                                                            },
                                                        },
                                                    );
                                                if (!occupancy.valid) {
                                                    failOccupancy(
                                                        occupancy.error,
                                                    );
                                                }

                                                const blockNameById = new Map(
                                                    snapshot.blocks.map(
                                                        (block) => [
                                                            block.id,
                                                            block.name,
                                                        ],
                                                    ),
                                                );
                                                const blockRotationById =
                                                    new Map(
                                                        snapshot.blocks.map(
                                                            (block) => [
                                                                block.id,
                                                                block.rotation,
                                                            ],
                                                        ),
                                                    );
                                                const blockDataByName = new Map(
                                                    blockData.map((block) => [
                                                        block.information.name,
                                                        block,
                                                    ]),
                                                );
                                                const placement =
                                                    dependencies.resolveGardenBlockPlacement(
                                                        {
                                                            blockName:
                                                                command.blockName,
                                                            blockedCells:
                                                                structureOccupiedCellKeys(
                                                                    occupancy.index,
                                                                ),
                                                            stacks: snapshot.stacks.map(
                                                                (stack) => ({
                                                                    blocks: [
                                                                        ...stack.blocks,
                                                                    ],
                                                                    positionX:
                                                                        stack.positionX,
                                                                    positionY:
                                                                        stack.positionY,
                                                                }),
                                                            ),
                                                            blockNameById,
                                                            blockDataByName,
                                                            blockRotationById,
                                                            requestedPosition:
                                                                command.position,
                                                        },
                                                    );
                                                if (!placement.valid) {
                                                    fail(
                                                        'BLOCK_PLACEMENT_INVALID',
                                                        400,
                                                        placement.error,
                                                    );
                                                }
                                                if (
                                                    !expectedStackMatches(
                                                        command.expectedExistingBlocks,
                                                        placement.placement
                                                            .existingBlocks,
                                                    )
                                                ) {
                                                    fail(
                                                        'GARDEN_STATE_CHANGED',
                                                        409,
                                                        'Invalid block placement: stack changed while placing block',
                                                    );
                                                }

                                                const variant =
                                                    command.variant ??
                                                    dependencies.createAppearanceVariant(
                                                        command.blockName,
                                                        dependencies.random,
                                                    ) ??
                                                    null;
                                                const candidateBlockId =
                                                    globalThis.crypto.randomUUID();
                                                const candidate =
                                                    candidateSnapshotAfterPlacement(
                                                        snapshot,
                                                        placement.placement,
                                                        {
                                                            id: candidateBlockId,
                                                            name: command.blockName,
                                                        },
                                                    );
                                                const postMutationValidation =
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
                                                if (
                                                    !postMutationValidation.valid
                                                ) {
                                                    failOccupancy(
                                                        postMutationValidation.error,
                                                    );
                                                }

                                                const targetStack =
                                                    snapshot.stacks.find(
                                                        (stack) =>
                                                            stack.positionX ===
                                                                placement
                                                                    .placement
                                                                    .x &&
                                                            stack.positionY ===
                                                                placement
                                                                    .placement
                                                                    .y,
                                                    );
                                                if (!targetStack) {
                                                    await dependencies.createGardenStack(
                                                        command.gardenId,
                                                        {
                                                            x: placement
                                                                .placement.x,
                                                            y: placement
                                                                .placement.y,
                                                        },
                                                        operationTransaction,
                                                    );
                                                }
                                                const createdBlockId =
                                                    await dependencies.createGardenBlock(
                                                        command.gardenId,
                                                        command.blockName,
                                                        variant,
                                                        operationTransaction,
                                                    );
                                                await dependencies.updateGardenStack(
                                                    command.gardenId,
                                                    {
                                                        blocks: [
                                                            ...placement
                                                                .placement
                                                                .existingBlocks,
                                                            createdBlockId,
                                                        ],
                                                        x: placement.placement
                                                            .x,
                                                        y: placement.placement
                                                            .y,
                                                    },
                                                    operationTransaction,
                                                );
                                                if (
                                                    command.blockName ===
                                                    'Raised_Bed'
                                                ) {
                                                    await dependencies.createRaisedBed(
                                                        {
                                                            accountId:
                                                                command.accountId,
                                                            blockId:
                                                                createdBlockId,
                                                            gardenId:
                                                                command.gardenId,
                                                            status: 'new',
                                                        },
                                                        operationTransaction,
                                                    );
                                                }
                                                if (
                                                    !snapshot.garden.isSandbox
                                                ) {
                                                    await dependencies.debitSunflowers(
                                                        command.accountId,
                                                        cost,
                                                        `gardenBlock:${command.gardenId.toString()}:purchase:${command.operationId}`,
                                                        operationTransaction,
                                                    );
                                                }

                                                return {
                                                    response: {
                                                        id: createdBlockId,
                                                        position: {
                                                            x: placement
                                                                .placement.x,
                                                            y: placement
                                                                .placement.y,
                                                        },
                                                        variant,
                                                    },
                                                };
                                            },
                                            gardenTransaction,
                                        );
                                    const decoded = decodeStoredResponse(
                                        execution.receipt.response,
                                    );
                                    if (!decoded) {
                                        fail(
                                            'OPERATION_RECEIPT_INVALID',
                                            500,
                                            'Stored garden block purchase response is invalid',
                                        );
                                    }
                                    return {
                                        ok: true,
                                        ...decoded,
                                        replayed: execution.replayed,
                                    };
                                },
                                accountTransaction,
                            ),
                        sunflowerTransaction,
                    ),
            );
        } catch (error) {
            const failure = failureFrom(error);
            if (failure) return failure;
            console.error('Failed to place purchased block atomically', {
                accountId: command.accountId,
                blockName: command.blockName,
                gardenId: command.gardenId,
                operationId: command.operationId,
                error,
            });
            return {
                ok: false,
                code: 'OPERATION_FAILED',
                error: 'Failed to place block',
                status: 500,
            };
        }
    };
}

const defaultDependencies: PurchaseGardenBlockDependencies<GardenPlacementTransaction> =
    {
        createAppearanceVariant: createEntityAppearanceVariantForPlacement,
        createGardenBlock: (gardenId, blockName, variant, transaction) =>
            createGardenBlock(gardenId, blockName, variant, transaction),
        createGardenOccupancyIndexFromStorageSnapshot,
        createGardenStack,
        createRaisedBed,
        debitSunflowers: async (accountId, amount, reason, transaction) => {
            await spendSunflowersBatch(
                accountId,
                [{ amount, reason }],
                transaction,
            );
        },
        getBlockData,
        getGardenLocation: async (gardenId) => {
            const garden = await getGarden(gardenId);
            return garden
                ? {
                      lat: garden.farm?.latitude,
                      lon: garden.farm?.longitude,
                  }
                : null;
        },
        getGardenPlacementSnapshotForUpdate,
        isBlockPurchaseAvailableNow,
        listGardenStructures,
        now: () => new Date(),
        random: Math.random,
        resolveGardenBlockPlacement,
        updateGardenStack,
        validatePersistedStructuresAfterBlockMutation,
        withAccountDeletionFenceTransaction,
        withGardenMutationOperation: (input, callback, transaction) =>
            withGardenMutationOperation(input, callback, transaction),
        withGardenPlacementTransaction,
        withSunflowerAccountTransaction,
    };

export const purchaseGardenBlock =
    createPurchaseGardenBlockService(defaultDependencies);
