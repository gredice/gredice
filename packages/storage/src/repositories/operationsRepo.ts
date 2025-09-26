import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import {
    events,
    type InsertOperation,
    operations,
    type SelectOperation,
} from '../schema';
import { storage } from '../storage';
import { getEvents, knownEventTypes } from './eventsRepo';

export type OperationStatus =
    | 'new'
    | 'planned'
    | 'completed'
    | 'failed'
    | 'canceled';

async function fillOperationAggregates(operations: SelectOperation[]) {
    const aggregateIds = operations.map((op) => op.id.toString());
    const aggregatesEvents = await getEvents(
        [
            knownEventTypes.operations.schedule,
            knownEventTypes.operations.complete,
            knownEventTypes.operations.fail,
            knownEventTypes.operations.cancel,
        ],
        aggregateIds,
        0,
        10000,
    );

    return operations.map((op) => {
        const events = aggregatesEvents.filter(
            (event) => event.aggregateId === op.id.toString(),
        );

        let status = 'new';
        let scheduledDate: Date | undefined;
        let completedAt: Date | undefined;
        let completedBy: string | undefined;
        let error: string | undefined;
        let errorCode: string | undefined;
        let canceledBy: string | undefined;
        let canceledAt: Date | undefined;
        let cancelReason: string | undefined;
        let imageUrls: string[] | undefined;

        for (const event of events) {
            const data = event.data as Record<string, any> | undefined;
            if (event.type === knownEventTypes.operations.complete) {
                status = 'completed';
                completedBy = data?.completedBy;
                completedAt = event.createdAt;
                if (Array.isArray(data?.images)) {
                    imageUrls = data.images.filter(
                        (url: unknown) => typeof url === 'string',
                    );
                }
                if (typeof data?.imageUrl === 'string') {
                    imageUrls = imageUrls
                        ? [...imageUrls, data.imageUrl]
                        : [data.imageUrl];
                }
            } else if (event.type === knownEventTypes.operations.fail) {
                status = 'failed';
                error = data?.error;
                errorCode = data?.errorCode;
            } else if (event.type === knownEventTypes.operations.cancel) {
                status = 'canceled';
                canceledBy = data?.canceledBy;
                cancelReason = data?.reason;
                canceledAt = event.createdAt;
            } else if (event.type === knownEventTypes.operations.schedule) {
                status = 'planned';
                scheduledDate = data?.scheduledDate
                    ? new Date(data.scheduledDate)
                    : undefined;
            }
        }

        return {
            ...op,
            status,
            completedAt,
            completedBy,
            error,
            errorCode,
            scheduledDate,
            canceledBy,
            canceledAt,
            cancelReason,
            imageUrls,
        };
    });
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
        operationsWithAggregates = operationsWithAggregates.filter((op) =>
            statusArray.includes(op.status as OperationStatus),
        );
    }

    return operationsWithAggregates;
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
