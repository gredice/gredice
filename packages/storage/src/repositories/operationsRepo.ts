import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import {
    events,
    farmUsers,
    gardens,
    type InsertOperation,
    operations,
    raisedBeds,
    type SelectOperation,
    users,
} from '../schema';
import { storage } from '../storage';
import { getEvents, knownEventTypes } from './events';
import { normalizeAssignedUserIds } from './events/normalizeAssignedUserIds';
import type { OperationEventsAnyPayload } from './events/types';

export type OperationStatus =
    | 'new'
    | 'planned'
    | 'pendingVerification'
    | 'completed'
    | 'failed'
    | 'canceled';

type OperationsFilter = {
    from?: Date;
    to?: Date;
    completedFrom?: Date;
    completedTo?: Date;
    status?: OperationStatus | OperationStatus[];
};

export type OperationAssignedUser = {
    id: string;
    userName: string;
    displayName: string | null;
    avatarUrl: string | null;
};

export type OperationAssignableFarmUser = OperationAssignedUser & {
    farmId: number;
};

function parseOperationEventData(value: unknown): OperationEventsAnyPayload {
    if (!value || typeof value !== 'object') {
        return {};
    }

    const record = value as Record<string, unknown>;
    const data: OperationEventsAnyPayload = {};

    if (typeof record.completedBy === 'string') {
        data.completedBy = record.completedBy;
    }
    if (
        'assignedUserId' in record &&
        (typeof record.assignedUserId === 'string' ||
            record.assignedUserId === null)
    ) {
        data.assignedUserId = record.assignedUserId;
    }
    if (typeof record.assignedBy === 'string') {
        data.assignedBy = record.assignedBy;
    }
    if (Array.isArray(record.assignedUserIds)) {
        data.assignedUserIds = record.assignedUserIds.filter(
            (value): value is string => typeof value === 'string',
        );
    }
    if (Array.isArray(record.images)) {
        data.images = record.images.filter(
            (value): value is string => typeof value === 'string',
        );
    }
    if (typeof record.error === 'string') {
        data.error = record.error;
    }
    if (typeof record.errorCode === 'string') {
        data.errorCode = record.errorCode;
    }
    if (typeof record.canceledBy === 'string') {
        data.canceledBy = record.canceledBy;
    }
    if (typeof record.verifiedBy === 'string') {
        data.verifiedBy = record.verifiedBy;
    }
    if (typeof record.reason === 'string') {
        data.reason = record.reason;
    }
    if (typeof record.scheduledDate === 'string') {
        data.scheduledDate = record.scheduledDate;
    }

    return data;
}

async function fillOperationAggregates(operations: SelectOperation[]) {
    const aggregateIds = operations.map((op) => op.id.toString());
    const aggregatesEvents = await getEvents(
        [
            knownEventTypes.operations.assign,
            knownEventTypes.operations.schedule,
            knownEventTypes.operations.complete,
            knownEventTypes.operations.verify,
            knownEventTypes.operations.fail,
            knownEventTypes.operations.cancel,
        ],
        aggregateIds,
        0,
        10000,
    );

    const operationsWithAggregates = operations.map((op) => {
        const events = aggregatesEvents.filter(
            (event) => event.aggregateId === op.id.toString(),
        );

        let status = 'new';
        let assignedUserId: string | null | undefined;
        let assignedUserIds: string[] | undefined;
        let assignedBy: string | undefined;
        let assignedAt: Date | undefined;
        let scheduledDate: Date | undefined;
        let completedAt: Date | undefined;
        let completedBy: string | undefined;
        let verifiedAt: Date | undefined;
        let verifiedBy: string | undefined;
        let error: string | undefined;
        let errorCode: string | undefined;
        let canceledBy: string | undefined;
        let canceledAt: Date | undefined;
        let cancelReason: string | undefined;
        let imageUrls: string[] | undefined;

        // helpers to safely extract typed values from unknown event.data
        const asString = (v: unknown): string | undefined =>
            typeof v === 'string' ? v : undefined;

        for (const event of events) {
            const data = parseOperationEventData(event.data);
            if (event.type === knownEventTypes.operations.assign) {
                if ('assignedUserId' in data) {
                    assignedUserId = data.assignedUserId ?? null;
                    assignedAt = event.createdAt;
                }
                if (Array.isArray(data.assignedUserIds)) {
                    assignedUserIds = normalizeAssignedUserIds(
                        data.assignedUserIds,
                        data.assignedUserId,
                    );
                    assignedAt = event.createdAt;
                }
                assignedBy = asString(data?.assignedBy) ?? assignedBy;
            } else if (event.type === knownEventTypes.operations.complete) {
                status = 'pendingVerification';
                completedBy = asString(data?.completedBy) ?? completedBy;
                completedAt = completedAt ?? event.createdAt;
                if (Array.isArray(data?.images)) {
                    imageUrls = (data.images as unknown[]).filter(
                        (url): url is string => typeof url === 'string',
                    );
                }
            } else if (event.type === knownEventTypes.operations.verify) {
                status = 'completed';
                verifiedBy = asString(data?.verifiedBy) ?? verifiedBy;
                verifiedAt = event.createdAt;
            } else if (event.type === knownEventTypes.operations.fail) {
                status = 'failed';
                error = asString(data?.error);
                errorCode = asString(data?.errorCode);
            } else if (event.type === knownEventTypes.operations.cancel) {
                status = 'canceled';
                canceledBy = asString(data?.canceledBy);
                cancelReason = asString(data?.reason);
                canceledAt = event.createdAt;
            } else if (event.type === knownEventTypes.operations.schedule) {
                status = 'planned';
                scheduledDate = data?.scheduledDate
                    ? new Date(String(data.scheduledDate))
                    : undefined;
            }
        }

        return {
            ...op,
            status,
            assignedUserIds: normalizeAssignedUserIds(
                assignedUserIds,
                assignedUserId,
            ),
            assignedUserId: assignedUserId ?? null,
            assignedBy,
            assignedAt,
            completedAt,
            completedBy,
            verifiedAt,
            verifiedBy,
            error,
            errorCode,
            scheduledDate,
            canceledBy,
            canceledAt,
            cancelReason,
            imageUrls,
        };
    });

    const assignedUserIds = Array.from(
        new Set(
            operationsWithAggregates.flatMap(
                (operation) => operation.assignedUserIds ?? [],
            ),
        ),
    );

    const assignedUsers =
        assignedUserIds.length > 0
            ? await storage().query.users.findMany({
                  columns: {
                      id: true,
                      userName: true,
                      displayName: true,
                      avatarUrl: true,
                  },
                  where: inArray(users.id, assignedUserIds),
              })
            : [];
    const assignedUsersById = new Map<string, OperationAssignedUser>(
        assignedUsers.map((user) => [user.id, user]),
    );

    return operationsWithAggregates.map((operation) => ({
        ...operation,
        assignedUsers: (operation.assignedUserIds ?? [])
            .map((assignedUserId) => assignedUsersById.get(assignedUserId))
            .filter((assignedUser): assignedUser is OperationAssignedUser =>
                Boolean(assignedUser),
            ),
        assignedUser:
            operation.assignedUserIds &&
            operation.assignedUserIds.length > 0 &&
            assignedUsersById.has(operation.assignedUserIds[0])
                ? (assignedUsersById.get(operation.assignedUserIds[0]) ?? null)
                : null,
    }));
}

export async function getOperations(
    accountId: string,
    gardenId?: number,
    raisedBedId?: number,
    raisedBedFieldIds?: number[],
) {
    const query = await storage().query.operations.findMany({
        where: and(
            eq(operations.accountId, accountId),
            eq(operations.isDeleted, false),
            gardenId ? eq(operations.gardenId, gardenId) : undefined,
            raisedBedId ? eq(operations.raisedBedId, raisedBedId) : undefined,
            raisedBedFieldIds && raisedBedFieldIds.length > 0
                ? inArray(operations.raisedBedFieldId, raisedBedFieldIds)
                : undefined,
        ),
        orderBy: desc(operations.timestamp),
    });

    return await fillOperationAggregates(query);
}

export async function getAllOperations(filter?: {
    from?: Date;
    to?: Date;
    completedFrom?: Date;
    completedTo?: Date;
    status?: OperationStatus | OperationStatus[];
}) {
    let operationsWithAggregates: Awaited<
        ReturnType<typeof fillOperationAggregates>
    >;

    // If completion date filtering is requested, use event-based filtering
    if (filter?.completedFrom || filter?.completedTo) {
        operationsWithAggregates = await getCompletedOperationsByCompletionDate(
            {
                from: filter.completedFrom || new Date('1970-01-01'),
                to: filter.completedTo || new Date('2099-12-31'),
            },
        );
    } else {
        // Otherwise, use the original timestamp-based filtering
        const operationsList = await storage().query.operations.findMany({
            where: and(
                eq(operations.isDeleted, false),
                filter?.from
                    ? gte(operations.timestamp, filter.from)
                    : undefined,
                filter?.to ? lte(operations.timestamp, filter.to) : undefined,
            ),
            orderBy: desc(operations.timestamp),
        });
        operationsWithAggregates =
            await fillOperationAggregates(operationsList);
    }

    // Apply status filtering if specified
    if (filter?.status) {
        const statusArray = Array.isArray(filter.status)
            ? filter.status
            : [filter.status];
        operationsWithAggregates = operationsWithAggregates.filter(
            (op) => op && statusArray.includes(op.status as OperationStatus),
        );
    }

    return operationsWithAggregates;
}

async function getFarmUserAcceptedOperationsByIds(
    userId: string,
    ids: number[],
) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
        return [];
    }

    const rows = await storage()
        .select({ operation: operations })
        .from(operations)
        .innerJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
        .innerJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
        .innerJoin(farmUsers, eq(gardens.farmId, farmUsers.farmId))
        .where(
            and(
                inArray(operations.id, uniqueIds),
                eq(farmUsers.userId, userId),
                eq(operations.isAccepted, true),
                eq(operations.isDeleted, false),
                eq(raisedBeds.isDeleted, false),
                eq(gardens.isDeleted, false),
            ),
        )
        .orderBy(desc(operations.timestamp));

    return rows.map((row) => row.operation);
}

async function getCompletedFarmUserAcceptedOperationsByCompletionDate(
    userId: string,
    filter: {
        from: Date;
        to: Date;
    },
) {
    const completionEvents = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.operations.complete),
            gte(events.createdAt, filter.from),
            lte(events.createdAt, filter.to),
        ),
        orderBy: [asc(events.createdAt)],
    });

    if (completionEvents.length === 0) {
        return [];
    }

    const operationIds = completionEvents
        .map((event) => Number.parseInt(event.aggregateId, 10))
        .filter((id) => Number.isFinite(id));

    return getFarmUserAcceptedOperationsByIds(userId, operationIds);
}

export async function getFarmUserAcceptedOperations(
    userId: string,
    filter?: OperationsFilter,
) {
    let operationsWithAggregates: Awaited<
        ReturnType<typeof fillOperationAggregates>
    >;

    if (filter?.completedFrom || filter?.completedTo) {
        const completedOperations =
            await getCompletedFarmUserAcceptedOperationsByCompletionDate(
                userId,
                {
                    from: filter.completedFrom || new Date('1970-01-01'),
                    to: filter.completedTo || new Date('2099-12-31'),
                },
            );

        operationsWithAggregates =
            await fillOperationAggregates(completedOperations);
    } else {
        const rows = await storage()
            .select({ operation: operations })
            .from(operations)
            .innerJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
            .innerJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
            .innerJoin(farmUsers, eq(gardens.farmId, farmUsers.farmId))
            .where(
                and(
                    eq(farmUsers.userId, userId),
                    eq(operations.isAccepted, true),
                    eq(operations.isDeleted, false),
                    eq(raisedBeds.isDeleted, false),
                    eq(gardens.isDeleted, false),
                    filter?.from
                        ? gte(operations.timestamp, filter.from)
                        : undefined,
                    filter?.to
                        ? lte(operations.timestamp, filter.to)
                        : undefined,
                ),
            )
            .orderBy(desc(operations.timestamp));

        operationsWithAggregates = await fillOperationAggregates(
            rows.map((row) => row.operation),
        );
    }

    if (filter?.status) {
        const statusArray = Array.isArray(filter.status)
            ? filter.status
            : [filter.status];
        operationsWithAggregates = operationsWithAggregates.filter(
            (operation) =>
                operation &&
                statusArray.includes(operation.status as OperationStatus),
        );
    }

    return operationsWithAggregates;
}

export async function getFarmUserAcceptedOperationById(
    userId: string,
    id: number,
) {
    const operations = await getFarmUserAcceptedOperationsByIds(userId, [id]);
    const [operationWithAggregates] = await fillOperationAggregates(operations);
    return operationWithAggregates ?? null;
}

export async function getAssignableFarmUsersByOperationIds(
    operationIds: number[],
) {
    const uniqueOperationIds = Array.from(new Set(operationIds));
    if (uniqueOperationIds.length === 0) {
        const emptyAssignableFarmUsersByOperationId: Record<
            number,
            OperationAssignableFarmUser[]
        > = {};

        return emptyAssignableFarmUsersByOperationId;
    }

    const rows = await storage()
        .select({
            operationId: operations.id,
            farmId: farmUsers.farmId,
            userId: users.id,
            userName: users.userName,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
        })
        .from(operations)
        .innerJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
        .innerJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
        .innerJoin(farmUsers, eq(gardens.farmId, farmUsers.farmId))
        .innerJoin(users, eq(farmUsers.userId, users.id))
        .where(
            and(
                inArray(operations.id, uniqueOperationIds),
                eq(operations.isDeleted, false),
                eq(raisedBeds.isDeleted, false),
                eq(gardens.isDeleted, false),
            ),
        )
        .orderBy(asc(operations.id), asc(users.userName));

    const assignableFarmUsersByOperationId: Record<
        number,
        OperationAssignableFarmUser[]
    > = {};

    for (const row of rows) {
        const existingUsers =
            assignableFarmUsersByOperationId[row.operationId] ?? [];
        if (existingUsers.some((user) => user.id === row.userId)) {
            continue;
        }

        existingUsers.push({
            id: row.userId,
            userName: row.userName,
            displayName: row.displayName,
            avatarUrl: row.avatarUrl,
            farmId: row.farmId,
        });
        assignableFarmUsersByOperationId[row.operationId] = existingUsers;
    }

    return assignableFarmUsersByOperationId;
}

export async function getOperationsByIds(ids: number[]) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
        return [];
    }

    const operationsList = await storage().query.operations.findMany({
        where: and(
            inArray(operations.id, uniqueIds),
            eq(operations.isDeleted, false),
        ),
        orderBy: desc(operations.timestamp),
    });

    return fillOperationAggregates(operationsList);
}

export async function getOperationById(id: number) {
    const operation = await storage().query.operations.findFirst({
        where: and(eq(operations.id, id), eq(operations.isDeleted, false)),
    });
    if (!operation) {
        throw new Error(`Operation with id ${id} not found`);
    }
    return (await fillOperationAggregates([operation]))[0];
}

export async function createOperation({
    entityId,
    entityTypeName,
    accountId,
    gardenId,
    raisedBedId,
    raisedBedFieldId,
    timestamp,
}: InsertOperation) {
    const [result] = await storage()
        .insert(operations)
        .values({
            entityId,
            entityTypeName,
            accountId,
            gardenId,
            raisedBedId,
            raisedBedFieldId,
            timestamp: timestamp ?? new Date(),
        })
        .returning({ id: operations.id });
    return result.id;
}

export async function acceptOperation(id: number) {
    await storage()
        .update(operations)
        .set({ isAccepted: true })
        .where(eq(operations.id, id));
}

export async function deleteOperation(id: number) {
    await storage()
        .update(operations)
        .set({ isDeleted: true })
        .where(eq(operations.id, id));
}

async function getCompletedOperationsByCompletionDate(filter: {
    from: Date;
    to: Date;
}) {
    // First, get completion events within the date range
    const completionEvents = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.operations.complete),
            gte(events.createdAt, filter.from),
            lte(events.createdAt, filter.to),
        ),
        orderBy: [asc(events.createdAt)],
    });

    if (completionEvents.length === 0) {
        return [];
    }

    // Extract operation IDs from the completion events
    const operationIds = completionEvents.map((event) =>
        parseInt(event.aggregateId, 10),
    );

    // Get the operations that were completed
    const completedOperations = await storage().query.operations.findMany({
        where: and(
            inArray(operations.id, operationIds),
            eq(operations.isDeleted, false),
        ),
        orderBy: desc(operations.timestamp),
    });

    // Fill aggregates for these specific operations
    return await fillOperationAggregates(completedOperations);
}
