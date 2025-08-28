import { and, desc, eq, inArray } from 'drizzle-orm';
import {
    type InsertOperation,
    operations,
    type SelectOperation,
} from '../schema';
import { storage } from '../storage';
import { getEvents, knownEventTypes } from './eventsRepo';

async function fillOperationAggregares(operations: SelectOperation[]) {
    const aggregateIds = operations.map((op) => op.id.toString());
    const aggregaresEvents = await getEvents(
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
        const events = aggregaresEvents.filter(
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
                completedAt = data?.completedAt
                    ? new Date(data.completedAt)
                    : undefined;
                if (Array.isArray(data?.imageUrls)) {
                    imageUrls = data.imageUrls.filter(
                        (url: unknown) => typeof url === 'string',
                    );
                } else if (typeof data?.imageUrl === 'string') {
                    imageUrls = [data.imageUrl];
                }
            } else if (event.type === knownEventTypes.operations.fail) {
                status = 'failed';
                error = data?.error;
                errorCode = data?.errorCode;
            } else if (event.type === knownEventTypes.operations.cancel) {
                status = 'canceled';
                canceledBy = data?.canceledBy;
                cancelReason = data?.reason;
                canceledAt = event.createdAt
                    ? new Date(event.createdAt)
                    : undefined;
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

    return await fillOperationAggregares(query);
}

export async function getAllOperations() {
    const operationsList = await storage().query.operations.findMany({
        where: eq(operations.isDeleted, false),
        orderBy: desc(operations.timestamp),
    });
    return await fillOperationAggregares(operationsList);
}

export async function getOperationById(id: number) {
    const operation = await storage().query.operations.findFirst({
        where: and(eq(operations.id, id), eq(operations.isDeleted, false)),
    });
    if (!operation) {
        throw new Error(`Operation with id ${id} not found`);
    }
    return (await fillOperationAggregares([operation]))[0];
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

export async function deleteOperation(id: number) {
    await storage()
        .update(operations)
        .set({ isDeleted: true })
        .where(eq(operations.id, id));
}
