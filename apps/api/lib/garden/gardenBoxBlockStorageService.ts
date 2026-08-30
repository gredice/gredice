import { createHash } from 'node:crypto';
import type { BlockData } from '@gredice/directory-types';
import { isAppearanceVariantEntityName } from '@gredice/js/entityAppearanceVariants';
import { woodenSignBlockName } from '@gredice/js/woodenSign';
import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    addGardenBoxInventoryItem,
    deleteGardenBlock,
    GardenBoxInventoryLimitError,
    GardenMutationOperationConflictError,
    type GardenMutationOperationExecution,
    type GardenMutationOperationStoredResponse,
    type GardenPlacementTransaction,
    getGardenBlockForUpdate,
    getGardenMutationAuthorityForUpdate,
    getGardenMutationOperationReceipt,
    getGardenPlacementSnapshotForUpdate,
    getGardenStackForUpdate,
    listGardenStructures,
    updateGardenStack,
    withGardenBoxInventoryTransaction,
    withGardenMutationOperation,
    withGardenPlacementTransaction,
} from '@gredice/storage';
import { getBlockData } from '../blocks/blockDataService';
import {
    type GardenOccupancyServiceError,
    type GardenOccupancyStorageStructureLike,
    validatePersistedStructuresAfterBlockMutation,
} from './gardenOccupancyService';

const maximumStorageInteger = 2_147_483_647;
const minimumStorageInteger = -2_147_483_648;

type GardenBoxBlockStorageSnapshot = Readonly<{
    garden: Readonly<{
        id: number;
        accountId: string;
        isSandbox: boolean;
    }>;
    blocks: readonly Readonly<{
        id: string;
        message?: string | null;
        name: string;
        rotation?: number | null;
    }>[];
    stacks: readonly Readonly<{
        blocks: string[];
        positionX: number;
        positionY: number;
    }>[];
}>;

type GardenBoxSourceStack = Readonly<{
    blocks: string[];
    positionX: number;
    positionY: number;
}>;

export type GardenBoxBlockStorageDependencies<Transaction> = Readonly<{
    addGardenBoxInventoryItem: (
        accountId: string,
        gardenId: number,
        gardenBoxBlockId: string,
        payload: Readonly<{
            entityTypeName: string;
            entityId: string;
            amount: number;
            source: string;
        }>,
        transaction: Transaction,
    ) => Promise<void>;
    deleteGardenBlock: (
        gardenId: number,
        blockId: string,
        transaction: Transaction,
    ) => Promise<void>;
    getBlockData: () => Promise<readonly BlockData[]>;
    getGardenBlockForUpdate: (
        input: Readonly<{
            blockId: string;
            gardenId: number;
            includeDeleted?: boolean;
        }>,
        transaction: Transaction,
    ) => Promise<Readonly<{
        id: string;
        isDeleted: boolean;
        name: string;
    }> | null>;
    getGardenMutationAuthorityForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<Readonly<{
        accountId: string;
        id: number;
        isDeleted: boolean;
        isSandbox: boolean;
    }> | null>;
    getGardenMutationOperationReceipt: (
        input: Readonly<{ gardenId: number; operationId: string }>,
        transaction: Transaction,
    ) => Promise<Readonly<{
        kind: string;
        response: GardenMutationOperationStoredResponse;
    }> | null>;
    getGardenPlacementSnapshotForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<GardenBoxBlockStorageSnapshot | null>;
    getGardenStackForUpdate: (
        gardenId: number,
        position: Readonly<{ x: number; y: number }>,
        transaction: Transaction,
    ) => Promise<GardenBoxSourceStack | null>;
    listGardenStructures: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<readonly GardenOccupancyStorageStructureLike[]>;
    updateGardenStack: (
        gardenId: number,
        stack: Readonly<{ x: number; y: number; blocks: string[] }>,
        transaction: Transaction,
    ) => Promise<void>;
    validatePersistedStructuresAfterBlockMutation: typeof validatePersistedStructuresAfterBlockMutation;
    withGardenBoxInventoryTransaction: <Result>(
        accountId: string,
        gardenId: number,
        gardenBoxBlockId: string,
        callback: (transaction: Transaction) => Promise<Result>,
    ) => Promise<Result>;
    withGardenMutationOperation: (
        input: Readonly<{
            gardenId: number;
            kind: 'garden-box-block-store';
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
}>;

export type GardenBoxBlockStorageCommand = Readonly<{
    accountId: string;
    blockId: string;
    blockIndex: number;
    entityId?: string;
    gardenBoxBlockId: string;
    gardenId: number;
    sourcePosition: Readonly<{ x: number; z: number }>;
}>;

type GardenBoxBlockStorageFailureCode =
    | 'ACCOUNT_DELETION_IN_PROGRESS'
    | 'BLOCK_DIRECTORY_DATA_NOT_FOUND'
    | 'BLOCK_NOT_FOUND'
    | 'GARDEN_BOX_INVENTORY_LIMIT'
    | 'GARDEN_BOX_NOT_FOUND'
    | 'GARDEN_BOX_NOT_PLACED'
    | 'GARDEN_NOT_FOUND'
    | 'GARDEN_OCCUPANCY_CONFLICT'
    | 'GARDEN_OCCUPANCY_INVALID_INPUT'
    | 'GARDEN_OCCUPANCY_INVALID_STATE'
    | 'GARDEN_STATE_CHANGED'
    | 'INVALID_OPERATION_RECEIPT'
    | 'INVALID_REQUEST'
    | 'OPERATION_CONFLICT'
    | 'SOURCE_BLOCK_CHANGED'
    | 'SOURCE_STACK_NOT_FOUND'
    | 'UNSUPPORTED_GARDEN_BOX_BLOCK';

export type GardenBoxBlockStorageResult =
    | Readonly<{
          ok: true;
          gardenBoxBlockId: string;
          item: Readonly<{
              entityTypeName: 'block';
              entityId: string;
              amount: 1;
          }>;
          replayed: boolean;
      }>
    | Readonly<{
          ok: false;
          code: GardenBoxBlockStorageFailureCode;
          error: string;
          status: 400 | 404 | 409 | 500;
      }>;

class GardenBoxBlockStorageError extends Error {
    override readonly name = 'GardenBoxBlockStorageError';

    constructor(
        readonly code: GardenBoxBlockStorageFailureCode,
        readonly status: 400 | 404 | 409 | 500,
        message: string,
    ) {
        super(message);
    }
}

function fail(
    code: GardenBoxBlockStorageFailureCode,
    status: 400 | 404 | 409 | 500,
    message: string,
): never {
    throw new GardenBoxBlockStorageError(code, status, message);
}

function assertCommand(command: GardenBoxBlockStorageCommand) {
    if (
        !command.accountId.trim() ||
        !command.blockId ||
        command.blockId.length > 128 ||
        command.blockId.trim() !== command.blockId ||
        !command.gardenBoxBlockId ||
        command.gardenBoxBlockId.length > 128 ||
        command.gardenBoxBlockId.trim() !== command.gardenBoxBlockId ||
        (command.entityId !== undefined &&
            (!command.entityId ||
                command.entityId.length > 100 ||
                command.entityId.trim() !== command.entityId)) ||
        !Number.isSafeInteger(command.gardenId) ||
        command.gardenId <= 0 ||
        command.gardenId > maximumStorageInteger ||
        !Number.isSafeInteger(command.blockIndex) ||
        command.blockIndex < 0 ||
        command.blockIndex > 4_096 ||
        !Number.isSafeInteger(command.sourcePosition.x) ||
        command.sourcePosition.x < minimumStorageInteger ||
        command.sourcePosition.x > maximumStorageInteger ||
        !Number.isSafeInteger(command.sourcePosition.z) ||
        command.sourcePosition.z < minimumStorageInteger ||
        command.sourcePosition.z > maximumStorageInteger
    ) {
        fail('INVALID_REQUEST', 400, 'Invalid garden block storage request');
    }
}

export function getGardenBoxBlockStorageOperationId(blockId: string) {
    const blockHash = createHash('sha256').update(blockId).digest('hex');
    return `garden-box-block-store:${blockHash}`;
}

function operationPayload(
    command: GardenBoxBlockStorageCommand,
    entityId: string,
) {
    return {
        accountId: command.accountId,
        entityId,
        gardenBoxBlockId: command.gardenBoxBlockId,
        gardenId: command.gardenId,
        source: {
            blockId: command.blockId,
            blockIndex: command.blockIndex,
            position: command.sourcePosition,
        },
    } as const;
}

type GardenBoxBlockStorageResponse = Readonly<{
    gardenBoxBlockId: string;
    item: Readonly<{
        amount: 1;
        entityId: string;
        entityTypeName: 'block';
    }>;
}>;

function isStoredResponseObject(
    value: unknown,
): value is GardenMutationOperationStoredResponse {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readReceiptResponse(
    response: GardenMutationOperationStoredResponse,
): GardenBoxBlockStorageResponse {
    if (
        !isStoredResponseObject(response.item) ||
        typeof response.gardenBoxBlockId !== 'string' ||
        response.gardenBoxBlockId.length === 0 ||
        response.gardenBoxBlockId.length > 128 ||
        response.item.entityTypeName !== 'block' ||
        typeof response.item.entityId !== 'string' ||
        response.item.entityId.length === 0 ||
        response.item.entityId.length > 100 ||
        response.item.amount !== 1
    ) {
        fail(
            'INVALID_OPERATION_RECEIPT',
            500,
            'Stored garden box block receipt is invalid',
        );
    }
    return {
        gardenBoxBlockId: response.gardenBoxBlockId,
        item: {
            amount: 1,
            entityId: response.item.entityId,
            entityTypeName: 'block',
        },
    };
}

function failOccupancy(error: GardenOccupancyServiceError): never {
    fail(error.code, error.status, error.message);
}

function assertBlockCanBeStored(
    block: {
        id: string;
        message?: string | null;
        name: string;
    },
    gardenBoxBlockId: string,
) {
    if (block.name === woodenSignBlockName && block.message) {
        fail(
            'UNSUPPORTED_GARDEN_BOX_BLOCK',
            400,
            'Prije spremanja ploče u vrtnu kutiju obriši njezin natpis.',
        );
    }
    if (block.id === gardenBoxBlockId || block.name === 'GardenBox') {
        fail(
            'UNSUPPORTED_GARDEN_BOX_BLOCK',
            400,
            'Garden boxes cannot be stored in garden boxes',
        );
    }
    if (block.name === 'Raised_Bed') {
        fail(
            'UNSUPPORTED_GARDEN_BOX_BLOCK',
            400,
            'Raised beds cannot be stored in garden boxes',
        );
    }
    if (isAppearanceVariantEntityName(block.name)) {
        fail(
            'UNSUPPORTED_GARDEN_BOX_BLOCK',
            400,
            'Životinju s odabranom bojom nije moguće spremiti u vrtnu kutiju.',
        );
    }
}

function findInventoryEntityId(
    blockData: readonly BlockData[],
    blockName: string,
) {
    const inventoryBlock = blockData.find(
        (candidate) => candidate.information?.name === blockName,
    );
    if (!inventoryBlock) {
        fail(
            'BLOCK_DIRECTORY_DATA_NOT_FOUND',
            404,
            'Block directory data not found',
        );
    }
    return inventoryBlock.id.toString();
}

function assertAuthoritativeState(
    command: GardenBoxBlockStorageCommand,
    snapshot: GardenBoxBlockStorageSnapshot | null,
    sourceStack: GardenBoxSourceStack,
) {
    if (!snapshot || snapshot.garden.accountId !== command.accountId) {
        fail('GARDEN_NOT_FOUND', 404, 'Garden not found');
    }
    if (sourceStack.blocks[command.blockIndex] !== command.blockId) {
        fail(
            'SOURCE_BLOCK_CHANGED',
            409,
            'Source block no longer matches the garden',
        );
    }

    const block = snapshot.blocks.find(
        (candidate) => candidate.id === command.blockId,
    );
    if (!block) {
        fail('BLOCK_NOT_FOUND', 404, 'Block not found');
    }
    const gardenBox = snapshot.blocks.find(
        (candidate) => candidate.id === command.gardenBoxBlockId,
    );
    if (gardenBox?.name !== 'GardenBox') {
        fail('GARDEN_BOX_NOT_FOUND', 404, 'Garden box not found');
    }
    const gardenBoxPlaced = snapshot.stacks.some((stack) =>
        stack.blocks.includes(command.gardenBoxBlockId),
    );
    if (!gardenBoxPlaced) {
        fail(
            'GARDEN_BOX_NOT_PLACED',
            400,
            'Garden box is not placed in this garden',
        );
    }

    assertBlockCanBeStored(block, command.gardenBoxBlockId);
    return block;
}

export function createGardenBoxBlockStorageService<Transaction>(
    dependencies: GardenBoxBlockStorageDependencies<Transaction>,
) {
    return async function storeGardenBoxBlock(
        command: GardenBoxBlockStorageCommand,
    ): Promise<GardenBoxBlockStorageResult> {
        try {
            assertCommand(command);
            const operationId = getGardenBoxBlockStorageOperationId(
                command.blockId,
            );
            return await dependencies.withGardenBoxInventoryTransaction(
                command.accountId,
                command.gardenId,
                command.gardenBoxBlockId,
                (inventoryTransaction) =>
                    dependencies.withGardenPlacementTransaction(
                        command.gardenId,
                        async (gardenTransaction) => {
                            const authority =
                                await dependencies.getGardenMutationAuthorityForUpdate(
                                    command.gardenId,
                                    gardenTransaction,
                                );
                            if (
                                !authority ||
                                authority.accountId !== command.accountId
                            ) {
                                fail(
                                    'GARDEN_NOT_FOUND',
                                    404,
                                    'Garden not found',
                                );
                            }

                            const targetGardenBox =
                                await dependencies.getGardenBlockForUpdate(
                                    {
                                        blockId: command.gardenBoxBlockId,
                                        gardenId: command.gardenId,
                                        includeDeleted: true,
                                    },
                                    gardenTransaction,
                                );
                            if (targetGardenBox?.name !== 'GardenBox') {
                                fail(
                                    'GARDEN_BOX_NOT_FOUND',
                                    404,
                                    'Garden box not found',
                                );
                            }

                            const existingReceipt =
                                await dependencies.getGardenMutationOperationReceipt(
                                    {
                                        gardenId: command.gardenId,
                                        operationId,
                                    },
                                    gardenTransaction,
                                );
                            if (
                                existingReceipt &&
                                existingReceipt.kind !==
                                    'garden-box-block-store'
                            ) {
                                throw new GardenMutationOperationConflictError(
                                    command.gardenId,
                                    operationId,
                                );
                            }

                            let prepared:
                                | Readonly<{
                                      blockData: readonly BlockData[];
                                      snapshot: GardenBoxBlockStorageSnapshot;
                                      sourceStack: GardenBoxSourceStack;
                                  }>
                                | undefined;
                            let inventoryEntityId = command.entityId;
                            if (existingReceipt) {
                                inventoryEntityId ??= readReceiptResponse(
                                    existingReceipt.response,
                                ).item.entityId;
                            } else {
                                const initialSnapshot =
                                    await dependencies.getGardenPlacementSnapshotForUpdate(
                                        command.gardenId,
                                        gardenTransaction,
                                    );
                                if (
                                    !initialSnapshot ||
                                    initialSnapshot.garden.accountId !==
                                        command.accountId
                                ) {
                                    fail(
                                        'GARDEN_NOT_FOUND',
                                        404,
                                        'Garden not found',
                                    );
                                }
                                const sourceStack =
                                    await dependencies.getGardenStackForUpdate(
                                        command.gardenId,
                                        {
                                            x: command.sourcePosition.x,
                                            y: command.sourcePosition.z,
                                        },
                                        gardenTransaction,
                                    );
                                if (!sourceStack) {
                                    fail(
                                        'SOURCE_STACK_NOT_FOUND',
                                        400,
                                        'Source stack not found',
                                    );
                                }
                                const snapshot =
                                    await dependencies.getGardenPlacementSnapshotForUpdate(
                                        command.gardenId,
                                        gardenTransaction,
                                    );
                                const block = assertAuthoritativeState(
                                    command,
                                    snapshot,
                                    sourceStack,
                                );
                                if (!snapshot) {
                                    fail(
                                        'GARDEN_STATE_CHANGED',
                                        409,
                                        'Garden changed while storing block',
                                    );
                                }
                                const blockData =
                                    await dependencies.getBlockData();
                                const authoritativeEntityId =
                                    findInventoryEntityId(
                                        blockData,
                                        block.name,
                                    );
                                if (
                                    inventoryEntityId !== undefined &&
                                    inventoryEntityId !== authoritativeEntityId
                                ) {
                                    fail(
                                        'SOURCE_BLOCK_CHANGED',
                                        409,
                                        'Source block entity no longer matches the garden',
                                    );
                                }
                                inventoryEntityId = authoritativeEntityId;
                                prepared = {
                                    blockData,
                                    snapshot,
                                    sourceStack,
                                };
                            }
                            if (!inventoryEntityId) {
                                fail(
                                    'INVALID_OPERATION_RECEIPT',
                                    500,
                                    'Stored garden box block receipt is invalid',
                                );
                            }
                            const resolvedInventoryEntityId = inventoryEntityId;

                            const execution =
                                await dependencies.withGardenMutationOperation(
                                    {
                                        gardenId: command.gardenId,
                                        kind: 'garden-box-block-store',
                                        operationId,
                                        payload: operationPayload(
                                            command,
                                            resolvedInventoryEntityId,
                                        ),
                                    },
                                    async (operationTransaction) => {
                                        const mutation = prepared;
                                        if (!mutation) {
                                            fail(
                                                'GARDEN_STATE_CHANGED',
                                                409,
                                                'Garden changed while storing block',
                                            );
                                        }
                                        const nextSourceBlocks =
                                            mutation.sourceStack.blocks.filter(
                                                (_blockId, index) =>
                                                    index !==
                                                    command.blockIndex,
                                            );
                                        await dependencies.updateGardenStack(
                                            command.gardenId,
                                            {
                                                x: command.sourcePosition.x,
                                                y: command.sourcePosition.z,
                                                blocks: nextSourceBlocks,
                                            },
                                            operationTransaction,
                                        );
                                        await dependencies.deleteGardenBlock(
                                            command.gardenId,
                                            command.blockId,
                                            operationTransaction,
                                        );

                                        const [
                                            postMutationSnapshot,
                                            structures,
                                        ] = await Promise.all([
                                            dependencies.getGardenPlacementSnapshotForUpdate(
                                                command.gardenId,
                                                operationTransaction,
                                            ),
                                            dependencies.listGardenStructures(
                                                command.gardenId,
                                                operationTransaction,
                                            ),
                                        ]);
                                        if (!postMutationSnapshot) {
                                            fail(
                                                'GARDEN_STATE_CHANGED',
                                                409,
                                                'Garden changed while storing block',
                                            );
                                        }
                                        const validation =
                                            dependencies.validatePersistedStructuresAfterBlockMutation(
                                                {
                                                    blockData:
                                                        mutation.blockData,
                                                    snapshot: {
                                                        blocks: postMutationSnapshot.blocks,
                                                        stacks: postMutationSnapshot.stacks,
                                                        structures,
                                                    },
                                                },
                                            );
                                        if (!validation.valid) {
                                            failOccupancy(validation.error);
                                        }

                                        await dependencies.addGardenBoxInventoryItem(
                                            command.accountId,
                                            command.gardenId,
                                            command.gardenBoxBlockId,
                                            {
                                                entityTypeName: 'block',
                                                entityId:
                                                    resolvedInventoryEntityId,
                                                amount: 1,
                                                source: `gardenBox:store:${operationId}`,
                                            },
                                            operationTransaction,
                                        );

                                        return {
                                            response: {
                                                gardenBoxBlockId:
                                                    command.gardenBoxBlockId,
                                                item: {
                                                    entityTypeName: 'block',
                                                    entityId:
                                                        resolvedInventoryEntityId,
                                                    amount: 1,
                                                },
                                            },
                                        } as const;
                                    },
                                    gardenTransaction,
                                );
                            return {
                                ok: true,
                                ...readReceiptResponse(
                                    execution.receipt.response,
                                ),
                                replayed: execution.replayed,
                            } as const;
                        },
                        inventoryTransaction,
                    ),
            );
        } catch (error) {
            if (error instanceof GardenBoxBlockStorageError) {
                return {
                    ok: false,
                    code: error.code,
                    error: error.message,
                    status: error.status,
                };
            }
            if (error instanceof GardenBoxInventoryLimitError) {
                return {
                    ok: false,
                    code: 'GARDEN_BOX_INVENTORY_LIMIT',
                    error: error.message,
                    status: 400,
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
            if (error instanceof AccountDeletionInProgressError) {
                return {
                    ok: false,
                    code: 'ACCOUNT_DELETION_IN_PROGRESS',
                    error: error.message,
                    status: 409,
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
            throw error;
        }
    };
}

const defaultDependencies: GardenBoxBlockStorageDependencies<GardenPlacementTransaction> =
    {
        addGardenBoxInventoryItem: (
            accountId,
            gardenId,
            gardenBoxBlockId,
            payload,
            transaction,
        ) =>
            addGardenBoxInventoryItem(
                accountId,
                gardenId,
                gardenBoxBlockId,
                payload,
                transaction,
            ),
        deleteGardenBlock,
        getBlockData,
        getGardenBlockForUpdate,
        getGardenMutationAuthorityForUpdate,
        getGardenMutationOperationReceipt,
        getGardenPlacementSnapshotForUpdate,
        getGardenStackForUpdate,
        listGardenStructures,
        updateGardenStack,
        validatePersistedStructuresAfterBlockMutation,
        withGardenBoxInventoryTransaction: (
            accountId,
            gardenId,
            gardenBoxBlockId,
            callback,
        ) =>
            withGardenBoxInventoryTransaction(
                accountId,
                gardenId,
                gardenBoxBlockId,
                callback,
            ),
        withGardenMutationOperation: (input, callback, transaction) =>
            withGardenMutationOperation(input, callback, transaction),
        withGardenPlacementTransaction,
    };

export const storeGardenBlockInGardenBoxForAccount =
    createGardenBoxBlockStorageService(defaultDependencies);
