import type { BlockData } from '@gredice/directory-types';
import { isAppearanceVariantEntityName } from '@gredice/js/entityAppearanceVariants';
import type { GardenBlockPlacementResult } from '@gredice/js/gardenBlocks';
import type { GardenOccupancyIndex } from '@gredice/js/gardenOccupancy';
import {
    consumeGardenBoxInventoryItem,
    createGardenBlock,
    createGardenStack,
    GardenBoxInventoryInsufficientError,
    type GardenPlacementTransaction,
    getGardenPlacementSnapshot,
    listGardenStructures,
    updateGardenStack,
    withGardenBoxInventoryTransaction,
    withGardenPlacementTransaction,
} from '@gredice/storage';
import { getBlockData } from '../blocks/blockDataService';
import { resolveGardenBlockPlacement } from './blockPlacementService';
import {
    createGardenOccupancyIndexFromStorageSnapshot,
    type GardenOccupancyServiceError,
    type GardenOccupancyStorageStructureLike,
    validatePersistedStructuresAfterBlockMutation,
} from './gardenOccupancyService';

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

type GardenBoxBlockPlacementDependencies<Transaction> = Readonly<{
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
    getGardenPlacementSnapshot: (
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
}>;

type GardenBoxBlockPlacementFailureCode =
    | 'BLOCK_NOT_FOUND'
    | 'BLOCK_PLACEMENT_INVALID'
    | 'GARDEN_BOX_INVENTORY_INSUFFICIENT'
    | 'GARDEN_BOX_NOT_FOUND'
    | 'GARDEN_OCCUPANCY_CONFLICT'
    | 'GARDEN_OCCUPANCY_INVALID_INPUT'
    | 'GARDEN_OCCUPANCY_INVALID_STATE'
    | 'GARDEN_STATE_CHANGED'
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
      }>
    | Readonly<{
          ok: false;
          code: GardenBoxBlockPlacementFailureCode;
          error: string;
          status: 400 | 404 | 409;
      }>;

class GardenBoxBlockPlacementError extends Error {
    override readonly name = 'GardenBoxBlockPlacementError';

    constructor(
        readonly code: GardenBoxBlockPlacementFailureCode,
        readonly status: 400 | 404 | 409,
        message: string,
    ) {
        super(message);
    }
}

function fail(
    code: GardenBoxBlockPlacementFailureCode,
    status: 400 | 404 | 409,
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
            const blockData = await dependencies.getBlockData();
            const requestedBlock = getRequestedBlock(
                blockData,
                command.entityId,
            );
            const blockName = requestedBlock.information.name;
            assertPlaceableGardenBoxBlock(blockName);

            return await dependencies.withGardenBoxInventoryTransaction(
                command.accountId,
                command.gardenId,
                command.gardenBoxBlockId,
                (inventoryTransaction) =>
                    dependencies.withGardenPlacementTransaction(
                        command.gardenId,
                        async (gardenTransaction) => {
                            const snapshot =
                                await dependencies.getGardenPlacementSnapshot(
                                    command.gardenId,
                                    gardenTransaction,
                                );
                            if (
                                !snapshot ||
                                snapshot.garden.accountId !== command.accountId
                            ) {
                                fail(
                                    'GARDEN_BOX_NOT_FOUND',
                                    404,
                                    'Garden box not found',
                                );
                            }
                            const gardenBox = snapshot.blocks.find(
                                (block) =>
                                    block.id === command.gardenBoxBlockId,
                            );
                            if (gardenBox?.name !== 'GardenBox') {
                                fail(
                                    'GARDEN_BOX_NOT_FOUND',
                                    404,
                                    'Garden box not found',
                                );
                            }

                            const structures =
                                await dependencies.listGardenStructures(
                                    command.gardenId,
                                    gardenTransaction,
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
                                dependencies.resolveGardenBlockPlacement({
                                    blockName,
                                    blockedCells: structureOccupiedCellKeys(
                                        occupancy.index,
                                    ),
                                    stacks: snapshot.stacks.map((stack) => ({
                                        blocks: [...stack.blocks],
                                        positionX: stack.positionX,
                                        positionY: stack.positionY,
                                    })),
                                    blockNameById,
                                    blockDataByName,
                                    blockRotationById,
                                });
                            if (!placement.valid) {
                                fail(
                                    'BLOCK_PLACEMENT_INVALID',
                                    400,
                                    placement.error,
                                );
                            }

                            const { existingBlocks, x, y } =
                                placement.placement;
                            const hasTargetStack = snapshot.stacks.some(
                                (stack) =>
                                    stack.positionX === x &&
                                    stack.positionY === y,
                            );
                            if (!hasTargetStack) {
                                await dependencies.createGardenStack(
                                    command.gardenId,
                                    { x, y },
                                    gardenTransaction,
                                );
                            }
                            const createdBlockId =
                                await dependencies.createGardenBlock(
                                    command.gardenId,
                                    blockName,
                                    gardenTransaction,
                                );
                            await dependencies.updateGardenStack(
                                command.gardenId,
                                {
                                    x,
                                    y,
                                    blocks: [...existingBlocks, createdBlockId],
                                },
                                gardenTransaction,
                            );

                            const postMutationSnapshot =
                                await dependencies.getGardenPlacementSnapshot(
                                    command.gardenId,
                                    gardenTransaction,
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
                                failOccupancy(postMutationValidation.error);
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
                                gardenTransaction,
                            );

                            return {
                                ok: true,
                                blockId: createdBlockId,
                                position: { x, y },
                                item: {
                                    entityTypeName: 'block',
                                    entityId: command.entityId,
                                    amount: 1,
                                },
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
        getGardenPlacementSnapshot,
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
        withGardenPlacementTransaction,
    };

export const placeGardenBoxBlockForAccount =
    createGardenBoxBlockPlacementService(defaultDependencies);
