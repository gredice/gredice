import { and, asc, count, eq, gte, inArray, lte } from 'drizzle-orm';
import { events } from '../schema';
import { storage } from '../storage';

export const knownEventTypes = {
    accounts: {
        create: 'account.create',
        assignUser: 'account.assignUser',
        earnSunflowers: 'account.earnSunflowers',
        spendSunflowers: 'account.spendSunflowers',
    },
    users: {
        create: 'user.create',
    },
    gardens: {
        create: 'garden.create',
        rename: 'garden.rename',
        delete: 'garden.delete',
        blockPlace: 'garden.blockPlace',
    },
    transactions: {
        create: 'transaction.create',
        update: 'transaction.update',
        delete: 'transaction.delete',
    },
    invoices: {
        create: 'invoice.create',
        update: 'invoice.update',
        delete: 'invoice.delete',
        paid: 'invoice.paid',
    },
    receipts: {
        create: 'receipt.create',
        update: 'receipt.update',
        fiscalize: 'receipt.fiscalize',
    },
    raisedBeds: {
        create: 'raisedBed.create',
        place: 'raisedBed.place',
        delete: 'raisedBed.delete',
        abandon: 'raisedBed.abandon',
    },
    raisedBedFields: {
        create: 'raisedBedField.create',
        delete: 'raisedBedField.delete',
        plantPlace: 'raisedBedField.plantPlace',
        plantUpdate: 'raisedBedField.plantUpdate',
        plantReplaceSort: 'raisedBedField.plantReplaceSort',
    },
    operations: {
        schedule: 'operation.schedule',
        complete: 'operation.complete',
        fail: 'operation.fail',
        cancel: 'operation.cancel',
    },
    delivery: {
        requestCreated: 'delivery.request.created',
        requestSlotChanged: 'delivery.request.slot.changed',
        requestAddressChanged: 'delivery.request.address.changed',
        requestConfirmed: 'delivery.request.confirmed',
        requestPreparing: 'delivery.request.preparing',
        requestReady: 'delivery.request.ready',
        requestCancelled: 'delivery.request.cancelled',
        requestFulfilled: 'delivery.request.fulfilled',
        requestSurveySent: 'delivery.request.survey_sent',
        userCancelled: 'delivery.request.user_cancelled',
    },
};

export const knownEvents = {
    accounts: {
        createdV1: (aggregateId: string) => ({
            type: knownEventTypes.accounts.create,
            version: 1,
            aggregateId,
        }),
        assignedUserV1: (aggregateId: string, data: { userId: string }) => ({
            type: knownEventTypes.accounts.assignUser,
            version: 1,
            aggregateId,
            data,
        }),
        sunflowersEarnedV1: (
            aggregateId: string,
            data: { amount: number; reason: string },
        ) => ({
            type: knownEventTypes.accounts.earnSunflowers,
            version: 1,
            aggregateId,
            data,
        }),
        sunflowersSpentV1: (
            aggregateId: string,
            data: { amount: number; reason: string },
        ) => ({
            type: knownEventTypes.accounts.spendSunflowers,
            version: 1,
            aggregateId,
            data,
        }),
    },
    users: {
        createdV1: (aggregateId: string) => ({
            type: knownEventTypes.users.create,
            version: 1,
            aggregateId,
        }),
    },
    gardens: {
        createdV1: (
            aggregateId: string,
            data: { name: string; accountId: string },
        ) => ({
            type: knownEventTypes.gardens.create,
            version: 1,
            aggregateId,
            data,
        }),
        renamedV1: (aggregateId: string, data: { name: string }) => ({
            type: knownEventTypes.gardens.rename,
            version: 1,
            aggregateId,
            data,
        }),
        deletedV1: (aggregateId: string) => ({
            type: knownEventTypes.gardens.delete,
            version: 1,
            aggregateId,
        }),
        blockPlacedV1: (
            aggregateId: string,
            data: { id: string; name: string },
        ) => ({
            type: knownEventTypes.gardens.blockPlace,
            version: 1,
            aggregateId,
            data,
        }),
        blockRemovedV1: (aggregateId: string, data: { id: string }) => ({
            type: knownEventTypes.gardens.blockPlace,
            version: 1,
            aggregateId,
            data,
        }),
    },
    transactions: {
        createdV1: (
            aggregateId: string,
            data: {
                accountId: string;
                amount: number;
                currency: string;
                status: string;
            },
        ) => ({
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
    invoices: {
        createdV1: (
            aggregateId: string,
            data: {
                accountId: string;
                invoiceNumber: string;
                totalAmount: string;
                status: string;
            },
        ) => ({
            type: knownEventTypes.invoices.create,
            version: 1,
            aggregateId,
            data,
        }),
        updatedV1: (aggregateId: string, data: { status?: string }) => ({
            type: knownEventTypes.invoices.update,
            version: 1,
            aggregateId,
            data,
        }),
        paidV1: (
            aggregateId: string,
            data: {
                paidDate: string;
                receiptId?: string;
                receiptNumber?: string;
            },
        ) => ({
            type: knownEventTypes.invoices.paid,
            version: 1,
            aggregateId,
            data,
        }),
        deletedV1: (aggregateId: string) => ({
            type: knownEventTypes.invoices.delete,
            version: 1,
            aggregateId,
        }),
    },
    receipts: {
        createdV1: (
            aggregateId: string,
            data: {
                invoiceId: string;
                receiptNumber: string;
                totalAmount: string;
                paymentMethod: string;
            },
        ) => ({
            type: knownEventTypes.receipts.create,
            version: 1,
            aggregateId,
            data,
        }),
        updatedV1: (aggregateId: string) => ({
            type: knownEventTypes.receipts.update,
            version: 1,
            aggregateId,
        }),
        fiscalizedV1: (
            aggregateId: string,
            data: {
                jir?: string;
                zki?: string;
                cisStatus: string;
                cisResponse?: string | null;
            },
        ) => ({
            type: knownEventTypes.receipts.fiscalize,
            version: 1,
            aggregateId,
            data,
        }),
    },
    raisedBeds: {
        createdV1: (
            aggregateId: string,
            data: { gardenId: number; blockId: string },
        ) => ({
            type: knownEventTypes.raisedBeds.create,
            version: 1,
            aggregateId,
            data,
        }),
        deletedV1: (aggregateId: string) => ({
            type: knownEventTypes.raisedBeds.delete,
            version: 1,
            aggregateId,
        }),
        abandonV1: (aggregateId: string) => ({
            type: knownEventTypes.raisedBeds.abandon,
            version: 1,
            aggregateId,
            data: { status: 'abandoned' },
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
        plantPlaceV1: (
            aggregateId: string,
            data: {
                plantSortId: string;
                scheduledDate: string | null | undefined;
            },
        ) => ({
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
        }),
        plantReplaceSortV1: (
            aggregateId: string,
            data: { plantSortId: string },
        ) => ({
            type: knownEventTypes.raisedBedFields.plantReplaceSort,
            version: 1,
            aggregateId,
            data,
        }),
    },
    operations: {
        scheduledV1: (
            aggregateId: string,
            data: { scheduledDate: string },
        ) => ({
            type: knownEventTypes.operations.schedule,
            version: 1,
            aggregateId,
            data,
        }),
        completedV1: (
            aggregateId: string,
            data: { completedBy: string; images?: string[] },
        ) => ({
            type: knownEventTypes.operations.complete,
            version: 1,
            aggregateId,
            data,
        }),
        failedV1: (
            aggregateId: string,
            data: { error: string; errorCode: string },
        ) => ({
            type: knownEventTypes.operations.fail,
            version: 1,
            aggregateId,
            data,
        }),
        canceledV1: (
            aggregateId: string,
            data: { canceledBy: string; reason: string },
        ) => ({
            type: knownEventTypes.operations.cancel,
            version: 1,
            aggregateId,
            data,
        }),
    },
    delivery: {
        requestCreatedV1: (
            aggregateId: string,
            data: {
                operationId: number;
                slotId: number;
                mode: string;
                addressId?: number;
                locationId?: number;
                notes?: string;
                accountId: string;
                gardenId?: string;
                raisedBedId?: string;
                raisedBedFieldId?: string;
            },
        ) => ({
            type: knownEventTypes.delivery.requestCreated,
            version: 1,
            aggregateId,
            data,
        }),
        requestSlotChangedV1: (
            aggregateId: string,
            data: { previousSlotId: number; newSlotId: number },
        ) => ({
            type: knownEventTypes.delivery.requestSlotChanged,
            version: 1,
            aggregateId,
            data,
        }),
        requestAddressChangedV1: (
            aggregateId: string,
            data: { addressId: number },
        ) => ({
            type: knownEventTypes.delivery.requestAddressChanged,
            version: 1,
            aggregateId,
            data,
        }),
        requestCancelledV1: (
            aggregateId: string,
            data: {
                actorType: string;
                cancelReason: string;
                note?: string;
                cancelledBy?: string;
            },
        ) => ({
            type: knownEventTypes.delivery.requestCancelled,
            version: 1,
            aggregateId,
            data,
        }),
        requestConfirmedV1: (
            aggregateId: string,
            data: { status: string },
        ) => ({
            type: knownEventTypes.delivery.requestConfirmed,
            version: 1,
            aggregateId,
            data,
        }),
        requestPreparingV1: (
            aggregateId: string,
            data: { status: string },
        ) => ({
            type: knownEventTypes.delivery.requestPreparing,
            version: 1,
            aggregateId,
            data,
        }),
        requestReadyV1: (aggregateId: string, data: { status: string }) => ({
            type: knownEventTypes.delivery.requestReady,
            version: 1,
            aggregateId,
            data,
        }),
        requestFulfilledV1: (
            aggregateId: string,
            data: { status: string; deliveryNotes?: string },
        ) => ({
            type: knownEventTypes.delivery.requestFulfilled,
            version: 1,
            aggregateId,
            data,
        }),
        requestSurveySentV1: (
            aggregateId: string,
            data: { sentTo: string[] },
        ) => ({
            type: knownEventTypes.delivery.requestSurveySent,
            version: 1,
            aggregateId,
            data,
        }),
        userCancelledV1: (aggregateId: string) => ({
            type: knownEventTypes.delivery.userCancelled,
            version: 1,
            aggregateId,
        }),
    },
};

export function getEvents(
    type: string | string[],
    aggregateIds: string[],
    offset: number = 0,
    limit: number = 1000,
) {
    return storage().query.events.findMany({
        where: and(
            inArray(events.aggregateId, aggregateIds),
            Array.isArray(type)
                ? inArray(events.type, type)
                : eq(events.type, type),
        ),
        orderBy: [asc(events.createdAt)],
        offset,
        limit,
    });
}

export async function getPlantUpdateEvents(filter?: {
    status?: string;
    from?: Date;
    to?: Date;
}) {
    const results = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.raisedBedFields.plantUpdate),
            filter?.from ? gte(events.createdAt, filter.from) : undefined,
            filter?.to ? lte(events.createdAt, filter.to) : undefined,
        ),
        orderBy: [asc(events.createdAt)],
    });

    if (!filter?.status) {
        return results;
    }

    return results.filter((event) => {
        const status = (event.data as { status?: unknown } | null | undefined)
            ?.status;
        return status === filter.status;
    });
}

export async function getPlantPlaceEventsCount() {
    const result = await storage()
        .select({ count: count() })
        .from(events)
        .where(eq(events.type, knownEventTypes.raisedBedFields.plantPlace));
    return result[0]?.count ?? 0;
}

export type Event = {
    type: string;
    version: number;
    aggregateId: string;
    data?: unknown | null | undefined;
};

export function createEvent({ type, version, aggregateId, data }: Event) {
    return storage().insert(events).values({
        type,
        version,
        aggregateId,
        data,
    });
}

export function deleteEventById(eventId: number) {
    return storage().delete(events).where(eq(events.id, eventId));
}
