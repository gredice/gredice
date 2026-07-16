import { knownEventTypes } from './knownEventTypes';
import type {
    AccountAiRequestPayload,
    AccountAssignUserPayload,
    AccountSunflowerDropEarnPayload,
    AccountSunflowerDropSpawnPayload,
    AccountSunflowersPayload,
    AdventCalendarOpenPayload,
    ApprovalRequestCreatePayload,
    ApprovalRequestReviewPayload,
    DeliveryRequestAddressChangedPayload,
    DeliveryRequestCancelledPayload,
    DeliveryRequestCreatePayload,
    DeliveryRequestExceptionRecordedPayload,
    DeliveryRequestExceptionRecoveredPayload,
    DeliveryRequestFulfilledPayloadV1,
    DeliveryRequestFulfilledPayloadV2,
    DeliveryRequestLifecycleNotificationDecisionPayload,
    DeliveryRequestLifecycleNotificationProcessedPayload,
    DeliveryRequestLifecycleTransitionPayload,
    DeliveryRequestReadyEmailProcessedPayload,
    DeliveryRequestRouteProgressPayload,
    DeliveryRequestSlotChangedPayload,
    DeliveryRequestStatusPayload,
    DeliveryRequestSurveySentPayload,
    DeliveryRunAbandonedPayload,
    DeliveryRunReassignedPayload,
    GardenBlockPlacePayload,
    GardenBlockRemovePayload,
    GardenCreatePayload,
    GardenRenamePayload,
    InventoryChangePayload,
    InvoiceCreatePayload,
    InvoicePaidPayload,
    InvoiceUpdatePayload,
    OperationAcceptancePayload,
    OperationAssignPayload,
    OperationBlockPayload,
    OperationCancelPayload,
    OperationCompletePayload,
    OperationCompletionEvidenceUpdatePayload,
    OperationEntityChangePayload,
    OperationFailPayload,
    OperationSchedulePayload,
    OperationVerifyPayload,
    PayoutApprovedPayload,
    PayoutPaidPayload,
    PayoutRejectedPayload,
    PayoutRequestedPayload,
    RaisedBedAbandonPayload,
    RaisedBedCreatePayload,
    RaisedBedFieldAiAnalysisPayload,
    RaisedBedFieldCreatePayload,
    RaisedBedFieldDeletePayload,
    RaisedBedFieldPlantBlockPayload,
    RaisedBedFieldPlantPlacePayload,
    RaisedBedFieldPlantReplaceSortPayload,
    RaisedBedFieldPlantSchedulePayload,
    RaisedBedFieldPlantUpdatePayload,
    RaisedBedWeedStateSetPayload,
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
        sunflowerDropSpawnedV1: (
            aggregateId: string,
            data: AccountSunflowerDropSpawnPayload,
        ) => ({
            type: knownEventTypes.accounts.sunflowerDropSpawn,
            version: 1,
            aggregateId,
            data,
        }),
        sunflowerDropEarnedV1: (
            aggregateId: string,
            data: AccountSunflowerDropEarnPayload,
        ) => ({
            type: knownEventTypes.accounts.earnSunflowerDrop,
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
        aiRequestV1: (aggregateId: string, data: AccountAiRequestPayload) => ({
            type: knownEventTypes.accounts.aiRequest,
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
        abandonV1: (
            aggregateId: string,
            data?: Omit<RaisedBedAbandonPayload, 'status'>,
        ) => ({
            type: knownEventTypes.raisedBeds.abandon,
            version: 1,
            aggregateId,
            data: {
                status: 'abandoned',
                ...(data?.reason ? { reason: data.reason } : {}),
            } satisfies RaisedBedAbandonPayload,
        }),
        aiAnalysisV1: (
            aggregateId: string,
            data: RaisedBedFieldAiAnalysisPayload,
        ) => ({
            type: knownEventTypes.raisedBeds.aiAnalysis,
            version: 1,
            aggregateId,
            data,
        }),
        weedStateSetV1: (
            aggregateId: string,
            data: RaisedBedWeedStateSetPayload,
        ) => ({
            type: knownEventTypes.raisedBeds.weedStateSet,
            version: 1,
            aggregateId,
            data,
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
        deletedV1: (
            aggregateId: string,
            data?: RaisedBedFieldDeletePayload,
        ) => ({
            type: knownEventTypes.raisedBedFields.delete,
            version: 1,
            aggregateId,
            ...(data ? { data } : {}),
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
        plantBlockedV1: (
            aggregateId: string,
            data: RaisedBedFieldPlantBlockPayload,
        ) => ({
            type: knownEventTypes.raisedBedFields.plantBlock,
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
        aiAnalysisV1: (
            aggregateId: string,
            data: RaisedBedFieldAiAnalysisPayload,
        ) => ({
            type: knownEventTypes.raisedBedFields.aiAnalysis,
            version: 1,
            aggregateId,
            data,
        }),
        weedStateSetV1: (
            aggregateId: string,
            data: RaisedBedWeedStateSetPayload,
        ) => ({
            type: knownEventTypes.raisedBedFields.weedStateSet,
            version: 1,
            aggregateId,
            data,
        }),
    },
    operations: {
        acceptanceChangedV1: (
            aggregateId: string,
            data: OperationAcceptancePayload,
        ) => ({
            type: knownEventTypes.operations.acceptance,
            version: 1,
            aggregateId,
            data,
        }),
        assignedV1: (aggregateId: string, data: OperationAssignPayload) => ({
            type: knownEventTypes.operations.assign,
            version: 1,
            aggregateId,
            data,
        }),
        entityChangedV1: (
            aggregateId: string,
            data: OperationEntityChangePayload,
        ) => ({
            type: knownEventTypes.operations.entityChange,
            version: 1,
            aggregateId,
            data,
        }),
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
        blockedV1: (aggregateId: string, data: OperationBlockPayload) => ({
            type: knownEventTypes.operations.block,
            version: 1,
            aggregateId,
            data,
        }),
        completionEvidenceUpdatedV1: (
            aggregateId: string,
            data: OperationCompletionEvidenceUpdatePayload,
        ) => ({
            type: knownEventTypes.operations.completionEvidenceUpdate,
            version: 1,
            aggregateId,
            data,
        }),
        verifiedV1: (aggregateId: string, data: OperationVerifyPayload) => ({
            type: knownEventTypes.operations.verify,
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
    approvalRequests: {
        createdV1: (
            aggregateId: string,
            data: ApprovalRequestCreatePayload,
        ) => ({
            type: knownEventTypes.approvalRequests.create,
            version: 1,
            aggregateId,
            data,
        }),
        approvedV1: (
            aggregateId: string,
            data: ApprovalRequestReviewPayload,
        ) => ({
            type: knownEventTypes.approvalRequests.approve,
            version: 1,
            aggregateId,
            data,
        }),
        rejectedV1: (
            aggregateId: string,
            data: ApprovalRequestReviewPayload,
        ) => ({
            type: knownEventTypes.approvalRequests.reject,
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
        requestReadyEmailProcessedV1: (
            aggregateId: string,
            data: DeliveryRequestReadyEmailProcessedPayload,
        ) => ({
            type: knownEventTypes.delivery.requestReadyEmailProcessed,
            version: 1,
            aggregateId,
            data,
        }),
        requestLifecycleNotificationProcessedV1: (
            aggregateId: string,
            data: DeliveryRequestLifecycleNotificationProcessedPayload,
        ) => ({
            type: knownEventTypes.delivery
                .requestLifecycleNotificationProcessed,
            version: 1,
            aggregateId,
            data,
        }),
        requestLifecycleNotificationDecisionV1: (
            aggregateId: string,
            data: DeliveryRequestLifecycleNotificationDecisionPayload,
        ) => ({
            type: knownEventTypes.delivery.requestLifecycleNotificationDecision,
            version: 1,
            aggregateId,
            data,
        }),
        requestFulfilledV1: (
            aggregateId: string,
            data: DeliveryRequestFulfilledPayloadV1,
        ) => ({
            type: knownEventTypes.delivery.requestFulfilled,
            version: 1,
            aggregateId,
            data,
        }),
        requestFulfilledV2: (
            aggregateId: string,
            data: DeliveryRequestFulfilledPayloadV2,
        ) => ({
            type: knownEventTypes.delivery.requestFulfilled,
            version: 2,
            aggregateId,
            data,
        }),
        requestRouteStartedV1: (
            aggregateId: string,
            data: DeliveryRequestLifecycleTransitionPayload,
        ) => ({
            type: knownEventTypes.delivery.requestRouteStarted,
            version: 1,
            aggregateId,
            data,
        }),
        requestRouteProgressV1: (
            aggregateId: string,
            data: DeliveryRequestRouteProgressPayload,
        ) => ({
            type: knownEventTypes.delivery.requestRouteProgress,
            version: 1,
            aggregateId,
            data,
        }),
        requestArrivedV1: (
            aggregateId: string,
            data: DeliveryRequestLifecycleTransitionPayload,
        ) => ({
            type: knownEventTypes.delivery.requestArrived,
            version: 1,
            aggregateId,
            data,
        }),
        requestExceptionRecordedV1: (
            aggregateId: string,
            data: DeliveryRequestExceptionRecordedPayload,
        ) => ({
            type: knownEventTypes.delivery.requestExceptionRecorded,
            version: 1,
            aggregateId,
            data,
        }),
        requestExceptionRecoveredV1: (
            aggregateId: string,
            data: DeliveryRequestExceptionRecoveredPayload,
        ) => ({
            type: knownEventTypes.delivery.requestExceptionRecovered,
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
        runReassignedV1: (
            aggregateId: string,
            data: DeliveryRunReassignedPayload,
        ) => ({
            type: knownEventTypes.delivery.runReassigned,
            version: 1,
            aggregateId,
            data,
        }),
        runAbandonedV1: (
            aggregateId: string,
            data: DeliveryRunAbandonedPayload,
        ) => ({
            type: knownEventTypes.delivery.runAbandoned,
            version: 1,
            aggregateId,
            data,
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
    payouts: {
        requestedV1: (aggregateId: string, data: PayoutRequestedPayload) => ({
            type: knownEventTypes.payouts.requested,
            version: 1,
            aggregateId,
            data,
        }),
        approvedV1: (aggregateId: string, data: PayoutApprovedPayload) => ({
            type: knownEventTypes.payouts.approved,
            version: 1,
            aggregateId,
            data,
        }),
        rejectedV1: (aggregateId: string, data: PayoutRejectedPayload) => ({
            type: knownEventTypes.payouts.rejected,
            version: 1,
            aggregateId,
            data,
        }),
        paidV1: (aggregateId: string, data: PayoutPaidPayload) => ({
            type: knownEventTypes.payouts.paid,
            version: 1,
            aggregateId,
            data,
        }),
    },
};
