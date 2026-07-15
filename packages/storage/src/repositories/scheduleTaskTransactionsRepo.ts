import 'server-only';

import { and, eq, sql } from 'drizzle-orm';
import { bustScheduleCache } from '../cache/scheduleCache';
import { operations, raisedBedFields } from '../schema';
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
