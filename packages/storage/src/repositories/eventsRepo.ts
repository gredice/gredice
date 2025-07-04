import { and, asc, eq, inArray } from "drizzle-orm";
import { storage } from "../storage";
import { events } from "../schema";

export const knownEventTypes = {
    accounts: {
        create: "account.create",
        assignUser: "account.assignUser",
        earnSunflowers: "account.earnSunflowers",
        spendSunflowers: "account.spendSunflowers",
    },
    users: {
        create: "user.create",
    },
    gardens: {
        create: "garden.create",
        rename: "garden.rename",
        delete: "garden.delete",
        blockPlace: "garden.blockPlace",
    },
    transactions: {
        create: "transaction.create",
        update: "transaction.update",
        delete: "transaction.delete",
    },
    raisedBeds: {
        create: "raisedBed.create",
        update: "raisedBed.update",
        delete: "raisedBed.delete",
    },
    raisedBedFields: {
        create: "raisedBedField.create",
        delete: "raisedBedField.delete",
        plantPlace: "raisedBedField.plantPlace",
        plantUpdate: "raisedBedField.plantUpdate",
    },
    operations: {
        schedule: "operation.schedule",
        complete: "operation.complete",
        fail: "operation.fail",
    }
}

export const knownEvents = {
    accounts: {
        createdV1: (aggregateId: string) => ({ type: knownEventTypes.accounts.create, version: 1, aggregateId }),
        assignedUserV1: (aggregateId: string, data: { userId: string }) => ({ type: knownEventTypes.accounts.assignUser, version: 1, aggregateId, data }),
        sunflowersEarnedV1: (aggregateId: string, data: { amount: number, reason: string }) => ({ type: knownEventTypes.accounts.earnSunflowers, version: 1, aggregateId, data }),
        sunflowersSpentV1: (aggregateId: string, data: { amount: number, reason: string }) => ({ type: knownEventTypes.accounts.spendSunflowers, version: 1, aggregateId, data }),
    },
    users: {
        createdV1: (aggregateId: string) => ({ type: knownEventTypes.users.create, version: 1, aggregateId }),
    },
    gardens: {
        createdV1: (aggregateId: string, data: { name: string, accountId: string }) => ({ type: knownEventTypes.gardens.create, version: 1, aggregateId, data }),
        renamedV1: (aggregateId: string, data: { name: string }) => ({ type: knownEventTypes.gardens.rename, version: 1, aggregateId, data }),
        deletedV1: (aggregateId: string) => ({ type: knownEventTypes.gardens.delete, version: 1, aggregateId }),
        blockPlacedV1: (aggregateId: string, data: { id: string, name: string }) => ({ type: knownEventTypes.gardens.blockPlace, version: 1, aggregateId, data }),
        blockRemovedV1: (aggregateId: string, data: { id: string }) => ({ type: knownEventTypes.gardens.blockPlace, version: 1, aggregateId, data }),
    },
    transactions: {
        createdV1: (aggregateId: string, data: { accountId: string; amount: number; currency: string; status: string }) => ({
            type: knownEventTypes.transactions.create,
            version: 1,
            aggregateId,
            data,
        }),
        updatedV1: (aggregateId: string, data: { status: string }) => ({
            type: knownEventTypes.transactions.update,
            version: 1,
            aggregateId,
            data,
        }),
        deletedV1: (aggregateId: string) => ({
            type: knownEventTypes.transactions.delete,
            version: 1,
            aggregateId,
        }),
    },
    raisedBeds: {
        createdV1: (aggregateId: string, data: { gardenId: number; blockId: string }) => ({
            type: knownEventTypes.raisedBeds.create,
            version: 1,
            aggregateId,
            data,
        }),
        updatedV1: (aggregateId: string, data: { blockId?: string }) => ({
            type: knownEventTypes.raisedBeds.update,
            version: 1,
            aggregateId,
            data,
        }),
        deletedV1: (aggregateId: string) => ({
            type: knownEventTypes.raisedBeds.delete,
            version: 1,
            aggregateId,
        }),
    },
    raisedBedFields: {
        createdV1: (aggregateId: string, data: { status: string }) => ({
            type: knownEventTypes.raisedBedFields.create,
            version: 1,
            aggregateId,
            data,
        }),
        deletedV1: (aggregateId: string) => ({
            type: knownEventTypes.raisedBedFields.delete,
            version: 1,
            aggregateId,
        }),
        plantPlaceV1: (aggregateId: string, data: { plantSortId: string, scheduledDate: string | null | undefined }) => ({
            type: knownEventTypes.raisedBedFields.plantPlace,
            version: 1,
            aggregateId,
            data,
        }),
        plantUpdateV1: (aggregateId: string, data: { status: string }) => ({
            type: knownEventTypes.raisedBedFields.plantUpdate,
            version: 1,
            aggregateId,
            data,
        })
    },
    operations: {
        scheduledV1: (aggregateId: string, data: { scheduledDate: string }) => ({
            type: knownEventTypes.operations.schedule,
            version: 1,
            aggregateId,
            data
        }),
        completedV1: (aggregateId: string, data: { completedBy: string }) => ({
            type: knownEventTypes.operations.complete,
            version: 1,
            aggregateId,
            data
        }),
        failedV1: (aggregateId: string, data: { error: string, errorCode: string }) => ({
            type: knownEventTypes.operations.fail,
            version: 1,
            aggregateId,
            data
        }),
    },
}

export function getEvents(type: string | string[], aggregateIds: string[], offset: number = 0, limit: number = 1000) {
    return storage().query.events.findMany({
        where: and(
            inArray(events.aggregateId, aggregateIds),
            Array.isArray(type)
                ? inArray(events.type, type)
                : eq(events.type, type)),
        orderBy: [asc(events.createdAt)],
        offset,
        limit
    });
}

export type Event = {
    type: string;
    version: number;
    aggregateId: string;
    data?: any | null | undefined;
}

export function createEvent({ type, version, aggregateId, data }: Event) {
    return storage().insert(events).values({
        type,
        version,
        aggregateId,
        data,
    });
}
