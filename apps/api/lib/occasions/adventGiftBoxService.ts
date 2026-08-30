import { createHash } from 'node:crypto';

const maximumStorageInteger = 2_147_483_647;
const adventGiftBoxBlockNames = new Set([
    'GiftBox_RedWhite',
    'GiftBox_GreenGold',
    'GiftBox_BlueWhite',
    'GiftBox_PurpleSilver',
    'GiftBox_GoldRed',
    'GiftBox_WhiteGreen',
]);

export type GiftBoxReward = Readonly<{
    kind: 'plant' | 'operation';
    entityTypeName: 'plantSort' | 'operation';
    entityId: string;
    title: string;
}>;

type GardenGiftBoxSnapshot = Readonly<{
    garden: Readonly<{
        accountId: string;
        id: number;
    }>;
    blocks: readonly Readonly<{
        id: string;
        name: string;
    }>[];
    stacks: readonly Readonly<{
        blocks: readonly string[];
        positionX: number;
        positionY: number;
    }>[];
}>;

type GardenGiftBoxStructure = Readonly<{
    anchorX: unknown;
    anchorY: unknown;
    document: unknown;
    id: unknown;
    rotation: unknown;
}>;

type GardenGiftBoxDirectoryBlock = Readonly<{
    attributes?: unknown;
    information?: unknown;
}>;

type GardenGiftBoxOccupancyValidation =
    | Readonly<{ valid: true }>
    | Readonly<{
          valid: false;
          error: Readonly<{
              code:
                  | 'GARDEN_OCCUPANCY_CONFLICT'
                  | 'GARDEN_OCCUPANCY_INVALID_INPUT'
                  | 'GARDEN_OCCUPANCY_INVALID_STATE';
              message: string;
              status: 400 | 409;
          }>;
      }>;

type GardenMutationReceipt = Readonly<{
    response: Readonly<Record<string, unknown>>;
}>;

export type AdventGiftBoxDependencies<Transaction> = Readonly<{
    addInventoryItem: (
        accountId: string,
        payload: Readonly<{
            entityTypeName: GiftBoxReward['entityTypeName'];
            entityId: string;
            amount: 1;
            source: string;
        }>,
        transaction: Transaction,
    ) => Promise<void>;
    deleteGardenStack: (
        gardenId: number,
        position: Readonly<{ x: number; y: number }>,
        transaction: Transaction,
    ) => Promise<void>;
    getGardenPlacementSnapshotForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<GardenGiftBoxSnapshot | null>;
    getBlockData: () => Promise<readonly GardenGiftBoxDirectoryBlock[]>;
    isAdventSeasonOver: (timeZone: string) => boolean;
    listGardenStructuresForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<readonly GardenGiftBoxStructure[]>;
    pickGiftBoxReward: () => Promise<GiftBoxReward>;
    softDeleteGardenBlockOnce: (
        gardenId: number,
        blockId: string,
        transaction: Transaction,
    ) => Promise<'already-deleted' | 'deleted' | 'not-found'>;
    updateGardenStack: (
        gardenId: number,
        stack: Readonly<{ x: number; y: number; blocks: string[] }>,
        transaction: Transaction,
    ) => Promise<void>;
    validatePersistedStructuresAfterBlockMutation: (
        input: Readonly<{
            blockData: readonly GardenGiftBoxDirectoryBlock[];
            snapshot: Readonly<{
                blocks: GardenGiftBoxSnapshot['blocks'];
                stacks: GardenGiftBoxSnapshot['stacks'];
                structures: readonly GardenGiftBoxStructure[];
            }>;
        }>,
    ) => GardenGiftBoxOccupancyValidation;
    withAccountDeletionFenceTransaction: <Result>(
        accountId: string,
        callback: (transaction: Transaction) => Promise<Result>,
        transaction: Transaction,
    ) => Promise<Result>;
    withGardenMutationOperation: (
        operation: Readonly<{
            gardenId: number;
            kind: 'gift-open';
            operationId: string;
            payload: Readonly<{ accountId: string; blockId: string }>;
        }>,
        callback: (
            transaction: Transaction,
        ) => Promise<
            Readonly<{ response: Readonly<{ reward: GiftBoxReward }> }>
        >,
        transaction: Transaction,
    ) => Promise<
        Readonly<{
            receipt: GardenMutationReceipt;
            replayed: boolean;
        }>
    >;
    withGardenPlacementTransaction: <Result>(
        gardenId: number,
        callback: (transaction: Transaction) => Promise<Result>,
        transaction: Transaction,
    ) => Promise<Result>;
    withInventoryAccountTransaction: <Result>(
        accountId: string,
        callback: (transaction: Transaction) => Promise<Result>,
    ) => Promise<Result>;
}>;

export type OpenAdventGiftBoxCommand = Readonly<{
    accountId: string;
    gardenId: number;
    blockId: string;
    timeZone: string;
}>;

type OpenAdventGiftBoxFailureCode =
    | 'ACCOUNT_DELETION_IN_PROGRESS'
    | 'BLOCK_NOT_FOUND'
    | 'GARDEN_NOT_FOUND'
    | 'GARDEN_OCCUPANCY_CONFLICT'
    | 'GARDEN_OCCUPANCY_INVALID_INPUT'
    | 'GARDEN_OCCUPANCY_INVALID_STATE'
    | 'GARDEN_STATE_CHANGED'
    | 'GIFT_UNAVAILABLE'
    | 'INVALID_GIFT_BOX'
    | 'INVALID_OPERATION_RECEIPT'
    | 'INVALID_REQUEST'
    | 'OPERATION_CONFLICT'
    | 'REWARD_UNAVAILABLE';

export type OpenAdventGiftBoxResult =
    | Readonly<{
          ok: true;
          replayed: boolean;
          reward: GiftBoxReward;
      }>
    | Readonly<{
          ok: false;
          code: OpenAdventGiftBoxFailureCode;
          error: string;
          status: 400 | 404 | 409 | 500 | 503;
      }>;

class AdventGiftBoxError extends Error {
    override readonly name = 'AdventGiftBoxError';

    constructor(
        readonly code: OpenAdventGiftBoxFailureCode,
        readonly status: 400 | 404 | 409 | 500 | 503,
        message: string,
    ) {
        super(message);
    }
}

function fail(
    code: OpenAdventGiftBoxFailureCode,
    status: 400 | 404 | 409 | 500 | 503,
    message: string,
): never {
    throw new AdventGiftBoxError(code, status, message);
}

function isNamedError(error: unknown, name: string) {
    return error instanceof Error && error.name === name;
}

function assertCommand(command: OpenAdventGiftBoxCommand) {
    if (
        !command.accountId.trim() ||
        !Number.isSafeInteger(command.gardenId) ||
        command.gardenId <= 0 ||
        command.gardenId > maximumStorageInteger ||
        !command.blockId ||
        command.blockId.length > 128 ||
        command.blockId.trim() !== command.blockId ||
        !command.timeZone ||
        command.timeZone.length > 128 ||
        command.timeZone.trim() !== command.timeZone
    ) {
        fail('INVALID_REQUEST', 400, 'Neispravan zahtjev za poklon kutiju.');
    }
}

function isGiftBoxReward(value: unknown): value is GiftBoxReward {
    if (value === null || typeof value !== 'object') return false;
    if (
        !('kind' in value) ||
        !('entityTypeName' in value) ||
        !('entityId' in value) ||
        !('title' in value)
    ) {
        return false;
    }
    const validPair =
        (value.kind === 'plant' && value.entityTypeName === 'plantSort') ||
        (value.kind === 'operation' && value.entityTypeName === 'operation');
    return (
        validPair &&
        typeof value.entityId === 'string' &&
        value.entityId.length > 0 &&
        value.entityId.length <= 128 &&
        typeof value.title === 'string' &&
        value.title.length > 0 &&
        value.title.length <= 512
    );
}

function readReceiptReward(receipt: GardenMutationReceipt) {
    const reward = receipt.response.reward;
    if (!isGiftBoxReward(reward)) {
        fail(
            'INVALID_OPERATION_RECEIPT',
            500,
            'Spremljena potvrda poklon kutije nije valjana.',
        );
    }
    return reward;
}

export function getAdventGiftBoxOperationId(blockId: string) {
    const blockHash = createHash('sha256').update(blockId).digest('hex');
    return `gift-open:${blockHash}`;
}

export function createAdventGiftBoxService<Transaction>(
    dependencies: AdventGiftBoxDependencies<Transaction>,
) {
    return async function openAdventGiftBoxAtomically(
        command: OpenAdventGiftBoxCommand,
    ): Promise<OpenAdventGiftBoxResult> {
        try {
            assertCommand(command);

            const operationId = getAdventGiftBoxOperationId(command.blockId);
            const execution =
                await dependencies.withInventoryAccountTransaction(
                    command.accountId,
                    (inventoryTransaction) =>
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
                                                'Vrt nije pronađen.',
                                            );
                                        }

                                        return dependencies.withGardenMutationOperation(
                                            {
                                                gardenId: command.gardenId,
                                                kind: 'gift-open',
                                                operationId,
                                                payload: {
                                                    accountId:
                                                        command.accountId,
                                                    blockId: command.blockId,
                                                },
                                            },
                                            async (operationTransaction) => {
                                                if (
                                                    !dependencies.isAdventSeasonOver(
                                                        command.timeZone,
                                                    )
                                                ) {
                                                    fail(
                                                        'GIFT_UNAVAILABLE',
                                                        400,
                                                        'Advent još traje. Poklon kutije su dostupne 25.12.',
                                                    );
                                                }

                                                const block =
                                                    snapshot.blocks.find(
                                                        (candidate) =>
                                                            candidate.id ===
                                                            command.blockId,
                                                    );
                                                if (!block) {
                                                    fail(
                                                        'BLOCK_NOT_FOUND',
                                                        404,
                                                        'Blok nije pronađen.',
                                                    );
                                                }
                                                if (
                                                    !adventGiftBoxBlockNames.has(
                                                        block.name,
                                                    )
                                                ) {
                                                    fail(
                                                        'INVALID_GIFT_BOX',
                                                        400,
                                                        'Odabrani blok nije poklon kutija.',
                                                    );
                                                }

                                                const matchingStacks =
                                                    snapshot.stacks.filter(
                                                        (candidate) =>
                                                            candidate.blocks.includes(
                                                                command.blockId,
                                                            ),
                                                    );
                                                const occurrenceCount =
                                                    matchingStacks.reduce(
                                                        (count, stack) =>
                                                            count +
                                                            stack.blocks.filter(
                                                                (
                                                                    candidateBlockId,
                                                                ) =>
                                                                    candidateBlockId ===
                                                                    command.blockId,
                                                            ).length,
                                                        0,
                                                    );
                                                if (
                                                    matchingStacks.length !==
                                                        1 ||
                                                    occurrenceCount !== 1
                                                ) {
                                                    fail(
                                                        'GARDEN_STATE_CHANGED',
                                                        409,
                                                        'Položaj poklon kutije se promijenio.',
                                                    );
                                                }
                                                const stack = matchingStacks[0];
                                                if (!stack) {
                                                    fail(
                                                        'GARDEN_STATE_CHANGED',
                                                        409,
                                                        'Položaj poklon kutije se promijenio.',
                                                    );
                                                }

                                                const candidateStacks =
                                                    snapshot.stacks.flatMap(
                                                        (candidate) => {
                                                            if (
                                                                candidate !==
                                                                stack
                                                            ) {
                                                                return [
                                                                    candidate,
                                                                ];
                                                            }
                                                            const blocks =
                                                                candidate.blocks.filter(
                                                                    (
                                                                        candidateBlockId,
                                                                    ) =>
                                                                        candidateBlockId !==
                                                                        command.blockId,
                                                                );
                                                            return blocks.length >
                                                                0
                                                                ? [
                                                                      {
                                                                          ...candidate,
                                                                          blocks,
                                                                      },
                                                                  ]
                                                                : [];
                                                        },
                                                    );
                                                const structures =
                                                    await dependencies.listGardenStructuresForUpdate(
                                                        command.gardenId,
                                                        operationTransaction,
                                                    );
                                                const blockData =
                                                    await dependencies.getBlockData();
                                                const occupancy =
                                                    dependencies.validatePersistedStructuresAfterBlockMutation(
                                                        {
                                                            blockData,
                                                            snapshot: {
                                                                blocks: snapshot.blocks.filter(
                                                                    (
                                                                        candidate,
                                                                    ) =>
                                                                        candidate.id !==
                                                                        command.blockId,
                                                                ),
                                                                stacks: candidateStacks,
                                                                structures,
                                                            },
                                                        },
                                                    );
                                                if (!occupancy.valid) {
                                                    fail(
                                                        occupancy.error.code,
                                                        occupancy.error.status,
                                                        occupancy.error.message,
                                                    );
                                                }

                                                let reward: GiftBoxReward;
                                                try {
                                                    reward =
                                                        await dependencies.pickGiftBoxReward();
                                                } catch {
                                                    fail(
                                                        'REWARD_UNAVAILABLE',
                                                        503,
                                                        'Nagrada poklon kutije trenutačno nije dostupna.',
                                                    );
                                                }
                                                if (!isGiftBoxReward(reward)) {
                                                    fail(
                                                        'REWARD_UNAVAILABLE',
                                                        500,
                                                        'Nagrada poklon kutije nije dostupna.',
                                                    );
                                                }
                                                await dependencies.addInventoryItem(
                                                    command.accountId,
                                                    {
                                                        entityTypeName:
                                                            reward.entityTypeName,
                                                        entityId:
                                                            reward.entityId,
                                                        amount: 1,
                                                        source: `advent-gift-box:${command.gardenId.toString()}:${command.blockId}`,
                                                    },
                                                    operationTransaction,
                                                );

                                                const remainingBlocks =
                                                    stack.blocks.filter(
                                                        (candidateBlockId) =>
                                                            candidateBlockId !==
                                                            command.blockId,
                                                    );
                                                if (
                                                    remainingBlocks.length === 0
                                                ) {
                                                    await dependencies.deleteGardenStack(
                                                        command.gardenId,
                                                        {
                                                            x: stack.positionX,
                                                            y: stack.positionY,
                                                        },
                                                        operationTransaction,
                                                    );
                                                } else {
                                                    await dependencies.updateGardenStack(
                                                        command.gardenId,
                                                        {
                                                            x: stack.positionX,
                                                            y: stack.positionY,
                                                            blocks: remainingBlocks,
                                                        },
                                                        operationTransaction,
                                                    );
                                                }
                                                const blockDeletion =
                                                    await dependencies.softDeleteGardenBlockOnce(
                                                        command.gardenId,
                                                        command.blockId,
                                                        operationTransaction,
                                                    );
                                                if (
                                                    blockDeletion !== 'deleted'
                                                ) {
                                                    fail(
                                                        'GARDEN_STATE_CHANGED',
                                                        409,
                                                        'Poklon kutija se promijenila tijekom otvaranja.',
                                                    );
                                                }
                                                return { response: { reward } };
                                            },
                                            gardenTransaction,
                                        );
                                    },
                                    accountTransaction,
                                ),
                            inventoryTransaction,
                        ),
                );
            return {
                ok: true,
                replayed: execution.replayed,
                reward: readReceiptReward(execution.receipt),
            };
        } catch (error) {
            if (error instanceof AdventGiftBoxError) {
                return {
                    ok: false,
                    code: error.code,
                    error: error.message,
                    status: error.status,
                };
            }
            if (isNamedError(error, 'AccountDeletionInProgressError')) {
                return {
                    ok: false,
                    code: 'ACCOUNT_DELETION_IN_PROGRESS',
                    error: 'Račun se briše.',
                    status: 409,
                };
            }
            if (isNamedError(error, 'AccountNotFoundError')) {
                return {
                    ok: false,
                    code: 'GARDEN_NOT_FOUND',
                    error: 'Vrt nije pronađen.',
                    status: 404,
                };
            }
            if (isNamedError(error, 'GardenMutationOperationConflictError')) {
                return {
                    ok: false,
                    code: 'OPERATION_CONFLICT',
                    error: 'Identitet otvaranja već je korišten za drugi zahtjev.',
                    status: 409,
                };
            }
            throw error;
        }
    };
}
