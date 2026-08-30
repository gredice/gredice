import type { BlockData } from '@gredice/directory-types';
import { isAppearanceVariantEntityName } from '@gredice/js/entityAppearanceVariants';
import { woodenSignBlockName } from '@gredice/js/woodenSign';
import {
    addGardenBoxInventoryItem,
    deleteGardenBlock,
    GardenBoxInventoryLimitError,
    type GardenPlacementTransaction,
    getGardenPlacementSnapshot,
    getGardenStackForUpdate,
    listGardenStructures,
    updateGardenStack,
    withGardenBoxInventoryTransaction,
    withGardenPlacementTransaction,
} from '@gredice/storage';
import { getBlockData } from '../blocks/blockDataService';
import {
    type GardenOccupancyServiceError,
    type GardenOccupancyStorageStructureLike,
    validatePersistedStructuresAfterBlockMutation,
} from './gardenOccupancyService';

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

type GardenBoxBlockStorageDependencies<Transaction> = Readonly<{
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
    getGardenPlacementSnapshot: (
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
    gardenBoxBlockId: string;
    gardenId: number;
    sourcePosition: Readonly<{ x: number; z: number }>;
}>;

type GardenBoxBlockStorageFailureCode =
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
    | 'INVALID_REQUEST'
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
      }>
    | Readonly<{
          ok: false;
          code: GardenBoxBlockStorageFailureCode;
          error: string;
          status: 400 | 404 | 409;
      }>;

class GardenBoxBlockStorageError extends Error {
    override readonly name = 'GardenBoxBlockStorageError';

    constructor(
        readonly code: GardenBoxBlockStorageFailureCode,
        readonly status: 400 | 404 | 409,
        message: string,
    ) {
        super(message);
    }
}

function fail(
    code: GardenBoxBlockStorageFailureCode,
    status: 400 | 404 | 409,
    message: string,
): never {
    throw new GardenBoxBlockStorageError(code, status, message);
}

function assertCommand(command: GardenBoxBlockStorageCommand) {
    if (
        !command.accountId.trim() ||
        !command.blockId.trim() ||
        !command.gardenBoxBlockId.trim() ||
        !Number.isSafeInteger(command.gardenId) ||
        command.gardenId <= 0 ||
        !Number.isSafeInteger(command.blockIndex) ||
        command.blockIndex < 0 ||
        !Number.isSafeInteger(command.sourcePosition.x) ||
        !Number.isSafeInteger(command.sourcePosition.z)
    ) {
        fail('INVALID_REQUEST', 400, 'Invalid garden block storage request');
    }
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
            const blockData = await dependencies.getBlockData();
            return await dependencies.withGardenBoxInventoryTransaction(
                command.accountId,
                command.gardenId,
                command.gardenBoxBlockId,
                (inventoryTransaction) =>
                    dependencies.withGardenPlacementTransaction(
                        command.gardenId,
                        async (gardenTransaction) => {
                            const initialSnapshot =
                                await dependencies.getGardenPlacementSnapshot(
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
                                await dependencies.getGardenPlacementSnapshot(
                                    command.gardenId,
                                    gardenTransaction,
                                );
                            const block = assertAuthoritativeState(
                                command,
                                snapshot,
                                sourceStack,
                            );
                            const inventoryEntityId = findInventoryEntityId(
                                blockData,
                                block.name,
                            );

                            const nextSourceBlocks = sourceStack.blocks.filter(
                                (_blockId, index) =>
                                    index !== command.blockIndex,
                            );
                            await dependencies.updateGardenStack(
                                command.gardenId,
                                {
                                    x: command.sourcePosition.x,
                                    y: command.sourcePosition.z,
                                    blocks: nextSourceBlocks,
                                },
                                gardenTransaction,
                            );
                            await dependencies.deleteGardenBlock(
                                command.gardenId,
                                command.blockId,
                                gardenTransaction,
                            );

                            const [postMutationSnapshot, structures] =
                                await Promise.all([
                                    dependencies.getGardenPlacementSnapshot(
                                        command.gardenId,
                                        gardenTransaction,
                                    ),
                                    dependencies.listGardenStructures(
                                        command.gardenId,
                                        gardenTransaction,
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
                                        blockData,
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
                                    entityId: inventoryEntityId,
                                    amount: 1,
                                    source: 'gardenBox:drop',
                                },
                                gardenTransaction,
                            );

                            return {
                                ok: true,
                                gardenBoxBlockId: command.gardenBoxBlockId,
                                item: {
                                    entityTypeName: 'block',
                                    entityId: inventoryEntityId,
                                    amount: 1,
                                },
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
        getGardenPlacementSnapshot,
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
        withGardenPlacementTransaction,
    };

export const storeGardenBlockInGardenBoxForAccount =
    createGardenBoxBlockStorageService(defaultDependencies);
