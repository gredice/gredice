import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    bustScheduleCache,
    type GardenPlacementTransaction,
    getGardenDeletionTargetForUpdate,
    getGardenPlacementSnapshotForUpdate,
    listGardenRaisedBedMetadataForUpdate,
    listGardenStructuresForUpdate,
    softDeleteGardenOnce,
    withAccountDeletionFenceTransaction,
    withGardenPlacementTransaction,
} from '@gredice/storage';

const maximumGardenIdentifier = 2_147_483_647;

export function parseGardenDeletionId(value: string) {
    if (!/^[1-9][0-9]*$/u.test(value)) {
        return null;
    }
    const gardenId = Number(value);
    return Number.isInteger(gardenId) && gardenId <= maximumGardenIdentifier
        ? gardenId
        : null;
}

type GardenDeletionSnapshot = Readonly<{
    garden: Readonly<{
        accountId: string;
        id: number;
        isSandbox: boolean;
    }>;
}>;

type GardenDeletionTarget = Readonly<{
    accountId: string;
    id: number;
    isDeleted: boolean;
    isSandbox: boolean;
}>;

type GardenDeletionDependencies<Transaction> = Readonly<{
    bustScheduleCache: () => Promise<void>;
    getGardenDeletionTargetForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<GardenDeletionTarget | null>;
    getGardenPlacementSnapshotForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<GardenDeletionSnapshot | null>;
    listGardenRaisedBedMetadataForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<readonly Readonly<{ status: string }>[]>;
    listGardenStructuresForUpdate: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<readonly Readonly<{ id: string }>[]>;
    softDeleteGardenOnce: (
        gardenId: number,
        transaction: Transaction,
    ) => Promise<'already-deleted' | 'deleted' | 'not-found'>;
    withAccountDeletionFenceTransaction: <Result>(
        accountId: string,
        callback: (transaction: Transaction) => Promise<Result>,
    ) => Promise<Result>;
    withGardenPlacementTransaction: <Result>(
        gardenId: number,
        callback: (transaction: Transaction) => Promise<Result>,
        transaction: Transaction,
    ) => Promise<Result>;
}>;

export type DeleteRealGardenCommand = Readonly<{
    accountId: string;
    gardenId: number;
}>;

export type DeleteRealGardenResult =
    | Readonly<{ ok: true; deleted: boolean }>
    | Readonly<{
          ok: false;
          code:
              | 'ACCOUNT_DELETION_IN_PROGRESS'
              | 'ACTIVE_RAISED_BEDS'
              | 'ACTIVE_STRUCTURES'
              | 'GARDEN_NOT_FOUND'
              | 'INVALID_GARDEN';
          error: string;
          status: 400 | 404 | 409;
          activeRaisedBedCount?: number;
          activeStructureCount?: number;
      }>;

function assertCommand(command: DeleteRealGardenCommand) {
    if (
        !command.accountId.trim() ||
        !Number.isSafeInteger(command.gardenId) ||
        command.gardenId <= 0 ||
        command.gardenId > maximumGardenIdentifier
    ) {
        return {
            ok: false,
            code: 'INVALID_GARDEN',
            error: 'Invalid garden',
            status: 400,
        } as const;
    }
    return null;
}

export function createGardenDeletionService<Transaction>(
    dependencies: GardenDeletionDependencies<Transaction>,
) {
    return async function deleteRealGarden(
        command: DeleteRealGardenCommand,
    ): Promise<DeleteRealGardenResult> {
        const invalid = assertCommand(command);
        if (invalid) return invalid;

        try {
            const result =
                await dependencies.withAccountDeletionFenceTransaction(
                    command.accountId,
                    (accountTransaction) =>
                        dependencies.withGardenPlacementTransaction(
                            command.gardenId,
                            async (gardenTransaction) => {
                                const target =
                                    await dependencies.getGardenDeletionTargetForUpdate(
                                        command.gardenId,
                                        gardenTransaction,
                                    );
                                if (
                                    !target ||
                                    target.accountId !== command.accountId ||
                                    target.isSandbox
                                ) {
                                    return {
                                        ok: false,
                                        code: 'GARDEN_NOT_FOUND',
                                        error: 'Garden not found',
                                        status: 404,
                                    } as const;
                                }
                                if (target.isDeleted) {
                                    return {
                                        ok: true,
                                        deleted: false,
                                    } as const;
                                }

                                const snapshot =
                                    await dependencies.getGardenPlacementSnapshotForUpdate(
                                        command.gardenId,
                                        gardenTransaction,
                                    );
                                if (
                                    !snapshot ||
                                    snapshot.garden.accountId !==
                                        command.accountId ||
                                    snapshot.garden.isSandbox
                                ) {
                                    throw new Error(
                                        'Locked garden changed during deletion.',
                                    );
                                }

                                const structures =
                                    await dependencies.listGardenStructuresForUpdate(
                                        command.gardenId,
                                        gardenTransaction,
                                    );
                                const raisedBeds =
                                    await dependencies.listGardenRaisedBedMetadataForUpdate(
                                        command.gardenId,
                                        gardenTransaction,
                                    );
                                const activeRaisedBedCount = raisedBeds.filter(
                                    (raisedBed) =>
                                        raisedBed.status === 'active',
                                ).length;
                                if (activeRaisedBedCount > 0) {
                                    return {
                                        ok: false,
                                        code: 'ACTIVE_RAISED_BEDS',
                                        error: 'Garden cannot be deleted while it has active raised beds',
                                        status: 409,
                                        activeRaisedBedCount,
                                    } as const;
                                }
                                if (structures.length > 0) {
                                    return {
                                        ok: false,
                                        code: 'ACTIVE_STRUCTURES',
                                        error: 'Garden cannot be deleted while it has active structures',
                                        status: 409,
                                        activeStructureCount: structures.length,
                                    } as const;
                                }

                                const deletion =
                                    await dependencies.softDeleteGardenOnce(
                                        command.gardenId,
                                        gardenTransaction,
                                    );
                                if (deletion !== 'deleted') {
                                    throw new Error(
                                        'Locked garden changed before deletion.',
                                    );
                                }
                                return { ok: true, deleted: true } as const;
                            },
                            accountTransaction,
                        ),
                );

            if (result.ok && result.deleted) {
                try {
                    await dependencies.bustScheduleCache();
                } catch (error) {
                    console.error(
                        'Failed to invalidate schedule cache after garden deletion',
                        { gardenId: command.gardenId, error },
                    );
                }
            }
            return result;
        } catch (error) {
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

export const deleteRealGardenForAccount = createGardenDeletionService({
    bustScheduleCache,
    getGardenDeletionTargetForUpdate,
    getGardenPlacementSnapshotForUpdate,
    listGardenRaisedBedMetadataForUpdate,
    listGardenStructuresForUpdate,
    softDeleteGardenOnce,
    withAccountDeletionFenceTransaction,
    withGardenPlacementTransaction,
} satisfies GardenDeletionDependencies<GardenPlacementTransaction>);
