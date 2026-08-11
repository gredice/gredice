import 'server-only';

import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { bustScheduleCache } from '../cache/scheduleCache';
import { operations, raisedBedFields, raisedBedPlantings } from '../schema';
import { storage } from '../storage';

type StorageClient = ReturnType<typeof storage>;
export type ScheduleTaskTransaction = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];

const scheduleTaskAdvisoryLockNamespace = 707_416;

function requirePositiveSafeInteger(value: number, label: string) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${label} must be a positive safe integer.`);
    }
    return value;
}

function requirePositionIndex(value: number) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('Position index must be a non-negative safe integer.');
    }
    return value;
}

function operationLockKey(operationId: number) {
    return `operation:${operationId.toString()}`;
}

function plantingLockKey(raisedBedId: number, positionIndex: number) {
    return `raised-bed-planting:${raisedBedId.toString()}:${positionIndex.toString()}`;
}

function selectedPlantingLockKey(plantingId: number) {
    return `selected-raised-bed-planting:${plantingId.toString()}`;
}

export async function acquirePlantingScheduleTaskLock(
    transaction: ScheduleTaskTransaction,
    raisedBedId: number,
    positionIndex: number,
) {
    const validRaisedBedId = requirePositiveSafeInteger(
        raisedBedId,
        'Raised bed ID',
    );
    const validPositionIndex = requirePositionIndex(positionIndex);
    await acquireScheduleTaskAdvisoryLock(
        transaction,
        plantingLockKey(validRaisedBedId, validPositionIndex),
    );
}

export async function acquireScheduleTaskAdvisoryLock(
    transaction: ScheduleTaskTransaction,
    lockKey: string,
) {
    await transaction.execute(
        sql`select pg_advisory_xact_lock(${scheduleTaskAdvisoryLockNamespace}, hashtext(${lockKey}));`,
    );
}

async function withScheduleTaskLock<T>(
    lockKey: string,
    callback: (transaction: ScheduleTaskTransaction) => Promise<T>,
    transaction?: ScheduleTaskTransaction,
) {
    const run = async (tx: ScheduleTaskTransaction) => {
        await acquireScheduleTaskAdvisoryLock(tx, lockKey);
        return callback(tx);
    };

    if (transaction) {
        return run(transaction);
    }

    const result = await storage().transaction(async (tx) => run(tx));
    // Event writers invalidate eagerly for legacy callers. Repeat after commit
    // so a concurrent reader cannot refill a stale schedule projection.
    await bustScheduleCache();
    return result;
}

async function lockOperationAggregateRowIfPresent(
    transaction: ScheduleTaskTransaction,
    operationId: number,
) {
    const [operation] = await transaction
        .select({ id: operations.id })
        .from(operations)
        .where(
            and(
                eq(operations.id, operationId),
                eq(operations.isDeleted, false),
            ),
        )
        .limit(1)
        .for('update');

    return operation ?? null;
}

async function lockPlantingAggregateRowIfPresent(
    transaction: ScheduleTaskTransaction,
    raisedBedId: number,
    positionIndex: number,
) {
    const [field] = await transaction
        .select({ id: raisedBedFields.id })
        .from(raisedBedFields)
        .where(
            and(
                eq(raisedBedFields.raisedBedId, raisedBedId),
                eq(raisedBedFields.positionIndex, positionIndex),
                eq(raisedBedFields.isDeleted, false),
            ),
        )
        .limit(1)
        .for('update');

    return field ?? null;
}

async function lockPlantingFootprintRowsIfPresent(
    transaction: ScheduleTaskTransaction,
    raisedBedId: number,
    positionIndices: readonly number[],
) {
    return transaction
        .select({ id: raisedBedFields.id })
        .from(raisedBedFields)
        .where(
            and(
                eq(raisedBedFields.raisedBedId, raisedBedId),
                inArray(raisedBedFields.positionIndex, positionIndices),
            ),
        )
        .orderBy(asc(raisedBedFields.id))
        .for('update');
}

async function lockSelectedPlantingAggregateRowIfPresent(
    transaction: ScheduleTaskTransaction,
    plantingId: number,
) {
    const [planting] = await transaction
        .select({ id: raisedBedPlantings.id })
        .from(raisedBedPlantings)
        .where(
            and(
                eq(raisedBedPlantings.id, plantingId),
                eq(raisedBedPlantings.isDeleted, false),
            ),
        )
        .limit(1)
        .for('update');

    return planting ?? null;
}

export async function withOperationScheduleTaskTransaction<T>(
    operationId: number,
    callback: (transaction: ScheduleTaskTransaction) => Promise<T>,
    transaction?: ScheduleTaskTransaction,
) {
    const validOperationId = requirePositiveSafeInteger(
        operationId,
        'Operation ID',
    );

    return withScheduleTaskLock(
        operationLockKey(validOperationId),
        async (tx) => {
            await lockOperationAggregateRowIfPresent(tx, validOperationId);
            return callback(tx);
        },
        transaction,
    );
}

export async function withPlantingScheduleTaskTransaction<T>(
    raisedBedId: number,
    positionIndex: number,
    callback: (transaction: ScheduleTaskTransaction) => Promise<T>,
    transaction?: ScheduleTaskTransaction,
) {
    const validRaisedBedId = requirePositiveSafeInteger(
        raisedBedId,
        'Raised bed ID',
    );
    const validPositionIndex = requirePositionIndex(positionIndex);

    return withScheduleTaskLock(
        plantingLockKey(validRaisedBedId, validPositionIndex),
        async (tx) => {
            await lockPlantingAggregateRowIfPresent(
                tx,
                validRaisedBedId,
                validPositionIndex,
            );
            return callback(tx);
        },
        transaction,
    );
}

/**
 * Serializes one multi-field planting footprint without taking a field row out
 * of order. All logical position locks are acquired first; existing physical
 * rows are then locked once by ascending ID, matching raised-bed merge and
 * planting repository writers.
 */
export async function withPlantingScheduleTaskFootprintTransaction<T>(
    raisedBedId: number,
    positionIndices: readonly number[],
    callback: (transaction: ScheduleTaskTransaction) => Promise<T>,
    transaction?: ScheduleTaskTransaction,
) {
    const validRaisedBedId = requirePositiveSafeInteger(
        raisedBedId,
        'Raised bed ID',
    );
    if (!Array.isArray(positionIndices) || positionIndices.length === 0) {
        throw new Error(
            'Planting footprint must contain at least one position.',
        );
    }
    const validPositionIndices = positionIndices
        .map(requirePositionIndex)
        .sort((left, right) => left - right);
    if (
        validPositionIndices.some(
            (positionIndex, index) =>
                index > 0 && positionIndex === validPositionIndices[index - 1],
        )
    ) {
        throw new Error('Planting footprint positions must be unique.');
    }

    const run = async (tx: ScheduleTaskTransaction) => {
        for (const positionIndex of validPositionIndices) {
            await acquirePlantingScheduleTaskLock(
                tx,
                validRaisedBedId,
                positionIndex,
            );
        }
        await lockPlantingFootprintRowsIfPresent(
            tx,
            validRaisedBedId,
            validPositionIndices,
        );
        return callback(tx);
    };

    if (transaction) {
        return run(transaction);
    }

    const result = await storage().transaction(run);
    await bustScheduleCache();
    return result;
}

export async function withSelectedRaisedBedPlantingScheduleTaskTransaction<T>(
    plantingId: number,
    callback: (transaction: ScheduleTaskTransaction) => Promise<T>,
    transaction?: ScheduleTaskTransaction,
) {
    const validPlantingId = requirePositiveSafeInteger(
        plantingId,
        'Planting ID',
    );

    return withScheduleTaskLock(
        selectedPlantingLockKey(validPlantingId),
        async (tx) => {
            await lockSelectedPlantingAggregateRowIfPresent(
                tx,
                validPlantingId,
            );
            return callback(tx);
        },
        transaction,
    );
}
