import { and, desc, eq } from "drizzle-orm";
import { storage } from "../storage";
import { InsertOperation, operations, SelectOperation } from "../schema";
import { getEvents, knownEventTypes } from "./eventsRepo";

async function fillOperationAggregares(operations: SelectOperation[]) {
    const aggregateIds = operations.map(op => op.id.toString());
    const aggregaresEvents = await getEvents([
        knownEventTypes.operations.schedule,
        knownEventTypes.operations.complete,
        knownEventTypes.operations.fail,
        knownEventTypes.operations.cancel,
    ], aggregateIds, 0, 10000);

    return operations.map(op => {
        const events = aggregaresEvents.filter(event => event.aggregateId === op.id.toString());

        let status = 'new';
        let scheduledDate: Date | undefined = undefined;
        let completedAt: Date | undefined = undefined;
        let completedBy: string | undefined = undefined;
        let error: string | undefined = undefined;
        let errorCode: string | undefined = undefined;
        let canceledBy: string | undefined = undefined;
        let canceledAt: Date | undefined = undefined;
        let cancelReason: string | undefined = undefined;

        for (const event of events) {
            const data = event.data as Record<string, any> | undefined;
            if (event.type === knownEventTypes.operations.complete) {
                status = 'completed';
                completedBy = data?.completedBy;
                completedAt = data?.completedAt ? new Date(data.completedAt) : undefined;
            } else if (event.type === knownEventTypes.operations.fail) {
                status = 'failed';
                error = data?.error;
                errorCode = data?.errorCode;
            } else if (event.type === knownEventTypes.operations.cancel) {
                status = 'canceled';
                canceledBy = data?.canceledBy;
                cancelReason = data?.reason;
                canceledAt = event.createdAt ? new Date(event.createdAt) : undefined;
            } else if (event.type === knownEventTypes.operations.schedule) {
                status = 'planned';
                scheduledDate = data?.scheduledDate ? new Date(data.scheduledDate) : undefined;
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
            cancelReason
        };
    });
}

export async function getOperations(accountId: string, gardenId?: number, raisedBedId?: number, raisedBedFieldId?: number) {
    const query = await storage().query.operations.findMany({
        where: and(
            eq(operations.accountId, accountId),
            eq(operations.isDeleted, false),
            gardenId ? eq(operations.gardenId, gardenId) : undefined,
            raisedBedId ? eq(operations.raisedBedId, raisedBedId) : undefined,
            raisedBedFieldId ? eq(operations.raisedBedFieldId, raisedBedFieldId) : undefined
        ),
        orderBy: desc(operations.timestamp)
    });

    return await fillOperationAggregares(query);
}

export async function getAllOperations() {
    const operationsList = await storage().query.operations.findMany({
        where: eq(operations.isDeleted, false),
        orderBy: desc(operations.timestamp)
    });
    return await fillOperationAggregares(operationsList);
}

export async function getOperationById(id: number) {
    const operation = await storage().query.operations.findFirst({
        where: and(
            eq(operations.id, id),
            eq(operations.isDeleted, false)
        )
    });
    if (!operation) {
        throw new Error(`Operation with id ${id} not found`);
    }
    return (await fillOperationAggregares([operation]))[0];
}

export async function createOperation({ entityId, entityTypeName, accountId, gardenId, raisedBedId, raisedBedFieldId, timestamp }: InsertOperation) {
    const [result] = await storage().insert(operations).values({
        entityId,
        entityTypeName,
        accountId,
        gardenId,
        raisedBedId,
        raisedBedFieldId,
        timestamp: timestamp ?? new Date(),
    }).returning({ id: operations.id });
    return result.id;
}

export async function deleteOperation(id: number) {
    await storage().update(operations).set({ isDeleted: true }).where(eq(operations.id, id));
}
