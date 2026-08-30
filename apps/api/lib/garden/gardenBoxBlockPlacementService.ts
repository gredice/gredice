import type { BlockData } from '@gredice/directory-types';
import { isAppearanceVariantEntityName } from '@gredice/js/entityAppearanceVariants';
import type { GardenBlockPlacementResult } from '@gredice/js/gardenBlocks';
import type { GardenOccupancyIndex } from '@gredice/js/gardenOccupancy';
import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    consumeGardenBoxInventoryItem,
    createGardenBlock,
    createGardenStack,
    GardenBoxInventoryInsufficientError,
    GardenMutationOperationConflictError,
    type GardenMutationOperationExecution,
    type GardenMutationOperationStoredResponse,
    type GardenPlacementTransaction,
    getGardenBlockForUpdate,
    getGardenMutationAuthorityForUpdate,
    getGardenPlacementSnapshotForUpdate,
    listGardenStructures,
    updateGardenStack,
    withGardenBoxInventoryTransaction,
    withGardenMutationOperation,
    withGardenPlacementTransaction,
} from '@gredice/storage';
import { getBlockData } from '../blocks/blockDataService';
import { resolveGardenBlockPlacement } from './blockPlacementService';
import { settleGardenEconomicMutationDependency } from './gardenEconomicMutationDependency';
import {
    createGardenOccupancyIndexFromStorageSnapshot,
    type GardenOccupancyServiceError,
    type GardenOccupancyStorageStructureLike,
    validatePersistedStructuresAfterBlockMutation,
} from './gardenOccupancyService';

const maximumStorageInteger = 2_147_483_647;
const operationIdentifierMaxLength = 96;

type GardenBoxPlacementSnapshot = Readonly<{
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

export type GardenBoxBlockPlacementDependencies<Transaction> = Readonly<{
    consumeGardenBoxInventoryItem: (
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
    createGardenBlock: (
        gardenId: number,
        blockName: string,
        transaction: Transaction,
    ) => Promise<string>;
    createGardenOccupancyIndexFromStorageSnapshot: typeof createGardenOccupancyIndexFromStorageSnapshot;
    createGardenStack: (
        gardenId: number,
        position: Readonly<{ x: number; y: number }>,
        transaction: Transaction,
    ) => Promise<unknown>;
    getBlockData: () => Promise<readonly BlockData[]>;
    dependencyPreparationTimeoutMs?: number;
    getGardenBlockForUpdate: (
        input: Readonly<{
            blockId: string;
            gardenId: number;
            includeDeleted?: boolean;
        }>,
        transaction: Transaction,
    ) => Promise<Readonly<{ id: string; name: string }> | null>;
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
    ) => Promise<GardenBoxPlacementSnapshot | null>;
    listGardenStructures: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<readonly GardenOccupancyStorageStructureLike[]>;
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
    }) => GardenBlockPlacementResult;
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
            kind: 'garden-box-block-place';
            operationId: string;
            payload: Readonly<{
                accountId: string;
                entityId: string;
                gardenBoxBlockId: string;
            }>;
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

export type GardenBoxBlockPlacementCommand = Readonly<{
    accountId: string;
    gardenId: number;
    gardenBoxBlockId: string;
    entityId: string;
    operationId: string;
}>;

type GardenBoxBlockPlacementFailureCode =
    | 'ACCOUNT_DELETION_IN_PROGRESS'
    | 'BLOCK_DIRECTORY_UNAVAILABLE'
    | 'BLOCK_NOT_FOUND'
    | 'BLOCK_PLACEMENT_INVALID'
    | 'GARDEN_BOX_INVENTORY_INSUFFICIENT'
    | 'GARDEN_BOX_NOT_FOUND'
    | 'GARDEN_OCCUPANCY_CONFLICT'
    | 'GARDEN_OCCUPANCY_INVALID_INPUT'
    | 'GARDEN_OCCUPANCY_INVALID_STATE'
    | 'GARDEN_STATE_CHANGED'
    | 'INVALID_OPERATION_RECEIPT'
    | 'INVALID_REQUEST'
    | 'OPERATION_CONFLICT'
    | 'UNSUPPORTED_GARDEN_BOX_BLOCK';

export type GardenBoxBlockPlacementResult =
    | Readonly<{
          ok: true;
          blockId: string;
          item: Readonly<{
              entityTypeName: 'block';
              entityId: string;
              amount: 1;
          }>;
          position: Readonly<{ x: number; y: number }>;
          replayed: boolean;
      }>
    | Readonly<{
          ok: false;
          code: GardenBoxBlockPlacementFailureCode;
          error: string;
          status: 400 | 404 | 409 | 500 | 503;
      }>;

class GardenBoxBlockPlacementError extends Error {
    override readonly name = 'GardenBoxBlockPlacementError';

    constructor(
        readonly code: GardenBoxBlockPlacementFailureCode,
        readonly status: 400 | 404 | 409 | 500 | 503,
        message: string,
    ) {
        super(message);
    }
}

function fail(
    code: GardenBoxBlockPlacementFailureCode,
    status: 400 | 404 | 409 | 500 | 503,
    message: string,
): never {
    throw new GardenBoxBlockPlacementError(code, status, message);
}

function failOccupancy(error: GardenOccupancyServiceError): never {
    throw new GardenBoxBlockPlacementError(
        error.code,
        error.status,
        error.message,
    );
}

function assertCommand(command: GardenBoxBlockPlacementCommand) {
    if (
        !command.accountId.trim() ||
        !Number.isSafeInteger(command.gardenId) ||
        command.gardenId <= 0 ||
        command.gardenId > maximumStorageInteger ||
        !command.gardenBoxBlockId ||
        command.gardenBoxBlockId.length > 128 ||
        command.gardenBoxBlockId.trim() !== command.gardenBoxBlockId ||
        !command.entityId ||
        command.entityId.length > 100 ||
        command.entityId.trim() !== command.entityId ||
        !command.operationId ||
        command.operationId.length > operationIdentifierMaxLength ||
        command.operationId.trim() !== command.operationId
    ) {
        fail('INVALID_REQUEST', 400, 'Invalid garden box placement request');
    }
}

type GardenBoxBlockPlacementResponse = Readonly<{
    blockId: string;
    item: Readonly<{
        amount: 1;
        entityId: string;
        entityTypeName: 'block';
    }>;
    position: Readonly<{ x: number; y: number }>;
}>;

function isStoredResponseObject(
    value: unknown,
): value is GardenMutationOperationStoredResponse {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readReceiptResponse(
    response: GardenMutationOperationStoredResponse,
): GardenBoxBlockPlacementResponse {
    if (
        !isStoredResponseObject(response.item) ||
        !isStoredResponseObject(response.position) ||
        typeof response.blockId !== 'string' ||
        response.blockId.length === 0 ||
        response.blockId.length > 128 ||
        response.item.entityTypeName !== 'block' ||
        typeof response.item.entityId !== 'string' ||
        response.item.entityId.length === 0 ||
        response.item.entityId.length > 100 ||
        response.item.amount !== 1 ||
        typeof response.position.x !== 'number' ||
        !Number.isSafeInteger(response.position.x) ||
        typeof response.position.y !== 'number' ||
        !Number.isSafeInteger(response.position.y)
    ) {
        fail(
            'INVALID_OPERATION_RECEIPT',
            500,
            'Stored garden box placement receipt is invalid',
        );
    }
    return {
        blockId: response.blockId,
        item: {
            amount: 1,
            entityId: response.item.entityId,
            entityTypeName: 'block',
        },
        position: {
            x: response.position.x,
            y: response.position.y,
        },
    };
}

function getRequestedBlock(blockData: readonly BlockData[], entityId: string) {
    const block = blockData.find(
        (candidate) => candidate.id.toString() === entityId,
    );
    if (!block) {
        fail('BLOCK_NOT_FOUND', 404, 'Block not found');
    }
    return block;
}

function assertPlaceableGardenBoxBlock(blockName: string) {
    if (blockName === 'GardenBox') {
        fail(
            'UNSUPPORTED_GARDEN_BOX_BLOCK',
            400,
            'Garden boxes cannot be placed from garden boxes',
        );
    }
    if (blockName === 'Raised_Bed') {
        fail(
            'UNSUPPORTED_GARDEN_BOX_BLOCK',
            400,
            'Raised beds cannot be placed from garden boxes',
        );
    }
    if (isAppearanceVariantEntityName(blockName)) {
        fail(
            'UNSUPPORTED_GARDEN_BOX_BLOCK',
            400,
            'Životinju s odabranom bojom nije moguće postaviti iz vrtne kutije.',
        );
    }
}

function structureOccupiedCellKeys(index: GardenOccupancyIndex) {
    const blockedCells = new Set<string>();
    for (const [key, cell] of index.cells) {
        if (cell.structureIds.length > 0) {
            blockedCells.add(key);
        }
    }
    return blockedCells;
}

export function createGardenBoxBlockPlacementService<Transaction>(
    dependencies: GardenBoxBlockPlacementDependencies<Transaction>,
) {
    return async function placeGardenBoxBlock(
        command: GardenBoxBlockPlacementCommand,
    ): Promise<GardenBoxBlockPlacementResult> {
        try {
            assertCommand(command);
            const blockDataResult =
                await settleGardenEconomicMutationDependency(
                    dependencies.getBlockData,
                    dependencies.dependencyPreparationTimeoutMs,
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
                                    'GARDEN_BOX_NOT_FOUND',
                                    404,
                                    'Garden box not found',
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
                            const execution =
                                await dependencies.withGardenMutationOperation(
                                    {
                                        gardenId: command.gardenId,
                                        kind: 'garden-box-block-place',
                                        operationId: command.operationId,
                                        payload: {
                                            accountId: command.accountId,
                                            entityId: command.entityId,
                                            gardenBoxBlockId:
                                                command.gardenBoxBlockId,
                                        },
                                    },
                                    async (operationTransaction) => {
                                        const snapshot =
                                            await dependencies.getGardenPlacementSnapshotForUpdate(
                                                command.gardenId,
                                                operationTransaction,
                                            );
                                        if (
                                            !snapshot ||
                                            snapshot.garden.accountId !==
                                                command.accountId
                                        ) {
                                            fail(
                                                'GARDEN_BOX_NOT_FOUND',
                                                404,
                                                'Garden box not found',
                                            );
                                        }
                                        const gardenBox = snapshot.blocks.find(
                                            (block) =>
                                                block.id ===
                                                command.gardenBoxBlockId,
                                        );
                                        if (gardenBox?.name !== 'GardenBox') {
                                            fail(
                                                'GARDEN_BOX_NOT_FOUND',
                                                404,
                                                'Garden box not found',
                                            );
                                        }

                                        if (
                                            blockDataResult.status ===
                                            'rejected'
                                        ) {
                                            fail(
                                                'BLOCK_DIRECTORY_UNAVAILABLE',
                                                503,
                                                'Garden block directory data is unavailable',
                                            );
                                        }
                                        const blockData = blockDataResult.value;
                                        const requestedBlock =
                                            getRequestedBlock(
                                                blockData,
                                                command.entityId,
                                            );
                                        const blockName =
                                            requestedBlock.information.name;
                                        assertPlaceableGardenBoxBlock(
                                            blockName,
                                        );

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
                                            failOccupancy(occupancy.error);
                                        }

                                        const blockNameById = new Map(
                                            snapshot.blocks.map((block) => [
                                                block.id,
                                                block.name,
                                            ]),
                                        );
                                        const blockRotationById = new Map(
                                            snapshot.blocks.map((block) => [
                                                block.id,
                                                block.rotation,
                                            ]),
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
                                                    blockName,
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
                                                },
                                            );
                                        if (!placement.valid) {
                                            fail(
                                                'BLOCK_PLACEMENT_INVALID',
                                                400,
                                                placement.error,
                                            );
                                        }

                                        const { existingBlocks, x, y } =
                                            placement.placement;
                                        const hasTargetStack =
                                            snapshot.stacks.some(
                                                (stack) =>
                                                    stack.positionX === x &&
                                                    stack.positionY === y,
                                            );
                                        if (!hasTargetStack) {
                                            await dependencies.createGardenStack(
                                                command.gardenId,
                                                { x, y },
                                                operationTransaction,
                                            );
                                        }
                                        const createdBlockId =
                                            await dependencies.createGardenBlock(
                                                command.gardenId,
                                                blockName,
                                                operationTransaction,
                                            );
                                        await dependencies.updateGardenStack(
                                            command.gardenId,
                                            {
                                                x,
                                                y,
                                                blocks: [
                                                    ...existingBlocks,
                                                    createdBlockId,
                                                ],
                                            },
                                            operationTransaction,
                                        );

                                        const postMutationSnapshot =
                                            await dependencies.getGardenPlacementSnapshotForUpdate(
                                                command.gardenId,
                                                operationTransaction,
                                            );
                                        if (!postMutationSnapshot) {
                                            fail(
                                                'GARDEN_STATE_CHANGED',
                                                409,
                                                'Garden changed while placing block',
                                            );
                                        }
                                        const postMutationValidation =
                                            dependencies.validatePersistedStructuresAfterBlockMutation(
                                                {
                                                    blockData,
                                                    snapshot: {
                                                        blocks: postMutationSnapshot.blocks,
                                                        stacks: postMutationSnapshot.stacks,
                                                        structures,
                                                    },
                                                },
                                            );
                                        if (!postMutationValidation.valid) {
                                            failOccupancy(
                                                postMutationValidation.error,
                                            );
                                        }

                                        await dependencies.consumeGardenBoxInventoryItem(
                                            command.accountId,
                                            command.gardenId,
                                            command.gardenBoxBlockId,
                                            {
                                                entityTypeName: 'block',
                                                entityId: command.entityId,
                                                amount: 1,
                                                source: 'gardenBox:place',
                                            },
                                            operationTransaction,
                                        );

                                        return {
                                            response: {
                                                blockId: createdBlockId,
                                                position: { x, y },
                                                item: {
                                                    entityTypeName: 'block',
                                                    entityId: command.entityId,
                                                    amount: 1,
                                                },
                                            },
                                        } as const;
                                    },
                                    gardenTransaction,
                                );
                            const response = readReceiptResponse(
                                execution.receipt.response,
                            );
                            return {
                                ok: true,
                                ...response,
                                replayed: execution.replayed,
                            } as const;
                        },
                        inventoryTransaction,
                    ),
            );
        } catch (error) {
            if (error instanceof GardenBoxBlockPlacementError) {
                return {
                    ok: false,
                    code: error.code,
                    error: error.message,
                    status: error.status,
                };
            }
            if (error instanceof GardenBoxInventoryInsufficientError) {
                return {
                    ok: false,
                    code: 'GARDEN_BOX_INVENTORY_INSUFFICIENT',
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
                    code: 'GARDEN_BOX_NOT_FOUND',
                    error: 'Garden box not found',
                    status: 404,
                };
            }
            throw error;
        }
    };
}

const defaultDependencies: GardenBoxBlockPlacementDependencies<GardenPlacementTransaction> =
    {
        consumeGardenBoxInventoryItem,
        createGardenBlock: (gardenId, blockName, transaction) =>
            createGardenBlock(gardenId, blockName, transaction),
        createGardenOccupancyIndexFromStorageSnapshot,
        createGardenStack,
        getBlockData,
        getGardenBlockForUpdate,
        getGardenMutationAuthorityForUpdate,
        getGardenPlacementSnapshotForUpdate,
        listGardenStructures,
        resolveGardenBlockPlacement,
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

export const placeGardenBoxBlockForAccount =
    createGardenBoxBlockPlacementService(defaultDependencies);
