import { knownEventTypes } from './knownEventTypes';
import type {
    AccountAssignUserPayload,
    AccountSunflowersPayload,
    AdventCalendarOpenPayload,
    DeliveryRequestAddressChangedPayload,
    DeliveryRequestCancelledPayload,
    DeliveryRequestCreatePayload,
    DeliveryRequestFulfilledPayload,
    DeliveryRequestSlotChangedPayload,
    DeliveryRequestStatusPayload,
    DeliveryRequestSurveySentPayload,
    GardenBlockPlacePayload,
    GardenBlockRemovePayload,
    GardenCreatePayload,
    GardenRenamePayload,
    InventoryChangePayload,
    InvoiceCreatePayload,
    InvoicePaidPayload,
    InvoiceUpdatePayload,
    OperationCancelPayload,
    OperationCompletePayload,
    OperationFailPayload,
    OperationSchedulePayload,
    RaisedBedAbandonPayload,
    RaisedBedCreatePayload,
    RaisedBedFieldCreatePayload,
    RaisedBedFieldPlantPlacePayload,
    RaisedBedFieldPlantReplaceSortPayload,
    RaisedBedFieldPlantSchedulePayload,
    RaisedBedFieldPlantUpdatePayload,
    ReceiptCreatePayload,
    ReceiptFiscalizePayload,
    TransactionCreatePayload,
    TransactionUpdatePayload,
    UserBirthdayRewardPayload,
} from './types';

export const knownEvents = {
    accounts: {
        createdV1: (aggregateId: string) => ({
            type: knownEventTypes.accounts.create,
            version: 1,
            aggregateId,
        }),
        assignedUserV1: (
            aggregateId: string,
            data: AccountAssignUserPayload,
        ) => ({
            type: knownEventTypes.accounts.assignUser,
            version: 1,
            aggregateId,
            data,
        }),
        sunflowersEarnedV1: (
            aggregateId: string,
            data: AccountSunflowersPayload,
        ) => ({
            type: knownEventTypes.accounts.earnSunflowers,
            version: 1,
            aggregateId,
            data,
        }),
        sunflowersSpentV1: (
            aggregateId: string,
            data: AccountSunflowersPayload,
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
        birthdayRewardV1: (
            aggregateId: string,
            data: UserBirthdayRewardPayload,
        ) => ({
            type: knownEventTypes.users.birthdayReward,
            version: 1,
            aggregateId,
            data,
        }),
    },
    gardens: {
        createdV1: (aggregateId: string, data: GardenCreatePayload) => ({
            type: knownEventTypes.gardens.create,
            version: 1,
            aggregateId,
            data,
        }),
        renamedV1: (aggregateId: string, data: GardenRenamePayload) => ({
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
            data: GardenBlockPlacePayload,
        ) => ({
            type: knownEventTypes.gardens.blockPlace,
            version: 1,
            aggregateId,
            data,
        }),
        blockRemovedV1: (
            aggregateId: string,
            data: GardenBlockRemovePayload,
        ) => ({
            type: knownEventTypes.gardens.blockPlace,
            version: 1,
            aggregateId,
            data,
        }),
    },
    transactions: {
        createdV1: (aggregateId: string, data: TransactionCreatePayload) => ({
            type: knownEventTypes.transactions.create,
            version: 1,
            aggregateId,
            data,
        }),
        updatedV1: (aggregateId: string, data: TransactionUpdatePayload) => ({
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
        createdV1: (aggregateId: string, data: InvoiceCreatePayload) => ({
            type: knownEventTypes.invoices.create,
            version: 1,
            aggregateId,
            data,
        }),
        updatedV1: (aggregateId: string, data: InvoiceUpdatePayload) => ({
            type: knownEventTypes.invoices.update,
            version: 1,
            aggregateId,
            data,
        }),
        paidV1: (aggregateId: string, data: InvoicePaidPayload) => ({
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
        createdV1: (aggregateId: string, data: ReceiptCreatePayload) => ({
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
        fiscalizedV1: (aggregateId: string, data: ReceiptFiscalizePayload) => ({
            type: knownEventTypes.receipts.fiscalize,
            version: 1,
            aggregateId,
            data,
        }),
    },
    raisedBeds: {
        createdV1: (aggregateId: string, data: RaisedBedCreatePayload) => ({
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
            data: { status: 'abandoned' } satisfies RaisedBedAbandonPayload,
        }),
    },
    raisedBedFields: {
        createdV1: (
            aggregateId: string,
            data: RaisedBedFieldCreatePayload,
        ) => ({
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
            data: RaisedBedFieldPlantPlacePayload,
        ) => ({
            type: knownEventTypes.raisedBedFields.plantPlace,
            version: 1,
            aggregateId,
            data,
        }),
        plantScheduleV1: (
            aggregateId: string,
            data: RaisedBedFieldPlantSchedulePayload,
        ) => ({
            type: knownEventTypes.raisedBedFields.plantSchedule,
            version: 1,
            aggregateId,
            data,
        }),
        plantUpdateV1: (
            aggregateId: string,
            data: RaisedBedFieldPlantUpdatePayload,
        ) => ({
            type: knownEventTypes.raisedBedFields.plantUpdate,
            version: 1,
            aggregateId,
            data,
        }),
        plantReplaceSortV1: (
            aggregateId: string,
            data: RaisedBedFieldPlantReplaceSortPayload,
        ) => ({
            type: knownEventTypes.raisedBedFields.plantReplaceSort,
            version: 1,
            aggregateId,
            data,
        }),
    },
    operations: {
        scheduledV1: (aggregateId: string, data: OperationSchedulePayload) => ({
            type: knownEventTypes.operations.schedule,
            version: 1,
            aggregateId,
            data,
        }),
        completedV1: (aggregateId: string, data: OperationCompletePayload) => ({
            type: knownEventTypes.operations.complete,
            version: 1,
            aggregateId,
            data,
        }),
        failedV1: (aggregateId: string, data: OperationFailPayload) => ({
            type: knownEventTypes.operations.fail,
            version: 1,
            aggregateId,
            data,
        }),
        canceledV1: (aggregateId: string, data: OperationCancelPayload) => ({
            type: knownEventTypes.operations.cancel,
            version: 1,
            aggregateId,
            data,
        }),
    },
    delivery: {
        requestCreatedV1: (
            aggregateId: string,
            data: DeliveryRequestCreatePayload,
        ) => ({
            type: knownEventTypes.delivery.requestCreated,
            version: 1,
            aggregateId,
            data,
        }),
        requestSlotChangedV1: (
            aggregateId: string,
            data: DeliveryRequestSlotChangedPayload,
        ) => ({
            type: knownEventTypes.delivery.requestSlotChanged,
            version: 1,
            aggregateId,
            data,
        }),
        requestAddressChangedV1: (
            aggregateId: string,
            data: DeliveryRequestAddressChangedPayload,
        ) => ({
            type: knownEventTypes.delivery.requestAddressChanged,
            version: 1,
            aggregateId,
            data,
        }),
        requestCancelledV1: (
            aggregateId: string,
            data: DeliveryRequestCancelledPayload,
        ) => ({
            type: knownEventTypes.delivery.requestCancelled,
            version: 1,
            aggregateId,
            data,
        }),
        requestConfirmedV1: (
            aggregateId: string,
            data: DeliveryRequestStatusPayload,
        ) => ({
            type: knownEventTypes.delivery.requestConfirmed,
            version: 1,
            aggregateId,
            data,
        }),
        requestPreparingV1: (
            aggregateId: string,
            data: DeliveryRequestStatusPayload,
        ) => ({
            type: knownEventTypes.delivery.requestPreparing,
            version: 1,
            aggregateId,
            data,
        }),
        requestReadyV1: (
            aggregateId: string,
            data: DeliveryRequestStatusPayload,
        ) => ({
            type: knownEventTypes.delivery.requestReady,
            version: 1,
            aggregateId,
            data,
        }),
        requestFulfilledV1: (
            aggregateId: string,
            data: DeliveryRequestFulfilledPayload,
        ) => ({
            type: knownEventTypes.delivery.requestFulfilled,
            version: 1,
            aggregateId,
            data,
        }),
        requestSurveySentV1: (
            aggregateId: string,
            data: DeliveryRequestSurveySentPayload,
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
    occasions: {
        adventCalendarOpenedV1: (
            aggregateId: string,
            data: AdventCalendarOpenPayload,
        ) => ({
            type: knownEventTypes.occasions.adventCalendarOpen,
            version: 1,
            aggregateId,
            data,
        }),
    },
    inventory: {
        addedV1: (aggregateId: string, data: InventoryChangePayload) => ({
            type: knownEventTypes.inventory.add,
            version: 1,
            aggregateId,
            data,
        }),
        consumedV1: (aggregateId: string, data: InventoryChangePayload) => ({
            type: knownEventTypes.inventory.consume,
            version: 1,
            aggregateId,
            data,
        }),
    },
};
