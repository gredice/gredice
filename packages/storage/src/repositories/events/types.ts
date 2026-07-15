import type { ScheduleTaskBlockPayload } from './scheduleTaskBlock';

// ============================================================================
// Account event payload types
// ============================================================================
export type AccountAssignUserPayload = {
    userId: string;
};

export type AccountSunflowersPayload = {
    amount: number;
    reason: string;
};

export type AccountSunflowerDropSpawnPayload = {
    amount: number;
    expiresAt: string;
    gardenId: number;
    rewardDate: string;
    sourceBlockId: string;
    spawnId: string;
};

export type AccountSunflowerDropEarnPayload = AccountSunflowersPayload & {
    gardenId: number;
    rewardDate: string;
    sourceBlockId: string;
    spawnId: string;
};

export type AiRequestKind = 'raisedBedImageAnalysis';

export type AccountAiRequestPayload = {
    accountId: string;
    aiRequestKind: AiRequestKind;
    requestedAt: string;
};

// ============================================================================
// User event payload types
// ============================================================================

export type UserBirthdayRewardPayload = {
    rewardDate: string;
    accountId: string;
    amount: number;
    late: boolean;
};

// ============================================================================
// Advent event payload types
// ============================================================================
export type AdventGiftAward =
    | {
          kind: 'gift';
          gift: 'advent-box';
          delivery: 'digital' | 'digital+physical';
      }
    | { kind: 'gift'; gift: 'christmas-tree'; delivery: 'digital' };

export type AdventAward =
    | { kind: 'sunflowers'; amount: number }
    | { kind: 'plant'; plantSortId: number; title?: string }
    | { kind: 'decoration'; blockId: string; title?: string }
    | { kind: 'tree-decoration'; day: number; title?: string }
    | AdventGiftAward;

export type AdventCalendarOpenPayload = {
    year: number;
    day: number;
    openedBy: string;
    awards: AdventAward[];
    /** @deprecated Use awards instead */
    award?: AdventAward;
};

// ============================================================================
// Inventory event payload types
// ============================================================================
export type InventoryChangePayload = {
    entityTypeName: string;
    entityId: string;
    amount: number;
    source?: string | null;
};

// ============================================================================
// Garden event payload types
// ============================================================================
export type GardenCreatePayload = {
    name: string;
    accountId: string;
};

export type GardenRenamePayload = {
    name: string;
};

export type GardenBlockPlacePayload = {
    id: string;
    name: string;
};

export type GardenBlockRemovePayload = {
    id: string;
};

// ============================================================================
// Transaction event payload types
// ============================================================================
export type TransactionCreatePayload = {
    accountId: string;
    amount: number;
    currency: string;
    status: string;
};

export type TransactionUpdatePayload = {
    status: string;
};

// ============================================================================
// Invoice event payload types
// ============================================================================
export type InvoiceCreatePayload = {
    accountId: string;
    invoiceNumber: string;
    totalAmount: string;
    status: string;
};

export type InvoiceUpdatePayload = {
    status?: string;
};

export type InvoicePaidPayload = {
    paidDate: string;
    receiptId?: string;
    receiptNumber?: string;
};

// ============================================================================
// Receipt event payload types
// ============================================================================
export type ReceiptCreatePayload = {
    invoiceId: string | null;
    receiptNumber: string;
    totalAmount: string;
    paymentMethod: string;
};

export type ReceiptFiscalizePayload = {
    jir?: string;
    zki?: string;
    cisStatus: string;
    cisResponse?: string | null;
};

// ============================================================================
// Raised bed event payload types
// ============================================================================
export type RaisedBedCreatePayload = {
    gardenId: number;
    blockId: string;
};

export type RaisedBedAbandonPayload = {
    status: 'abandoned';
    reason?: 'inactivity' | 'user';
};

export type RaisedBedWeedStateLevel = 'none' | 'light' | 'heavy';

export type RaisedBedWeedStateSource = 'admin' | 'ai';

export type RaisedBedWeedStateSetPayload = {
    level: RaisedBedWeedStateLevel;
    source: RaisedBedWeedStateSource;
    observedAt?: string | null;
    notes?: string | null;
};

// ============================================================================
// Raised bed field event payload types
// ============================================================================
export type RaisedBedFieldCreatePayload = {
    status: string;
};
export type RaisedBedFieldDeletePayload = {
    canceledBy?: string;
    expectedPlantCycleEventId?: number;
    expectedPlantCycleVersionEventId?: number;
    expectedPlantSortId?: number;
    notificationRequested?: boolean;
    refundAmount?: number;
    reason?: string;
};

export type RaisedBedFieldSowingLocation = 'direct' | 'greenhouse';

export type RaisedBedFieldPlantPurchase =
    | {
          cartItemId: number;
          currency: 'sunflower';
          sunflowerAmount: number;
      }
    | {
          cartItemId: number;
          currency: 'eur';
          euroAmountCents: number;
      }
    | {
          cartItemId: number;
          currency: 'inventory';
      };

export type RaisedBedFieldPlantPlacePayload = {
    plantSortId: string;
    scheduledDate: string | null | undefined;
    sowingLocation?: RaisedBedFieldSowingLocation;
    purchase?: RaisedBedFieldPlantPurchase;
};

export type RaisedBedFieldPlantSchedulePayload = {
    scheduledDate: string | null | undefined;
    sowingLocation?: RaisedBedFieldSowingLocation;
};

type RaisedBedFieldPlantUpdateEffectiveDate = {
    effectiveDate?: string | null;
};

export type RaisedBedFieldPlantUpdatePayload =
    | ({
          status: string;
          assignedUserId?: undefined;
          assignedUserIds?: undefined;
          assignedBy?: undefined;
      } & RaisedBedFieldPlantUpdateEffectiveDate)
    | ({
          status?: string;
          assignedUserId: string;
          assignedUserIds?: string[];
          assignedBy: string;
      } & RaisedBedFieldPlantUpdateEffectiveDate)
    | ({
          status?: string;
          assignedUserId: null;
          assignedUserIds?: string[];
          assignedBy?: string | null;
      } & RaisedBedFieldPlantUpdateEffectiveDate)
    | ({
          status?: string;
          assignedUserIds: string[];
          assignedBy?: string | null;
      } & RaisedBedFieldPlantUpdateEffectiveDate);

export type RaisedBedFieldPlantReplaceSortPayload = {
    plantSortId: string;
};
export type RaisedBedFieldAiAnalysisPayload = {
    markdown: string;
    imageUrl: string;
    imageUrls?: string[];
    model: string;
    analyzedAt: string;
    referenceDate?: string;
    accountId?: string;
    aiRequestKind?: AiRequestKind;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
};
export type RaisedBedFieldPlantEventsPayload =
    | RaisedBedFieldPlantPlacePayload
    | RaisedBedFieldPlantSchedulePayload
    | RaisedBedFieldPlantUpdatePayload
    | ScheduleTaskBlockPayload
    | RaisedBedFieldPlantReplaceSortPayload
    | RaisedBedFieldAiAnalysisPayload;
export type RaisedBedFieldPlantEventsAnyPayload = Partial<
    RaisedBedFieldPlantPlacePayload &
        RaisedBedFieldPlantSchedulePayload &
        RaisedBedFieldPlantUpdatePayload &
        ScheduleTaskBlockPayload &
        RaisedBedFieldPlantReplaceSortPayload &
        RaisedBedFieldAiAnalysisPayload
>;

// ============================================================================
// Operation event payload types
// ============================================================================
export type OperationSchedulePayload = {
    scheduledDate: string;
};

export type OperationAcceptancePayload = {
    accepted: boolean;
};

export type OperationEntityChangePayload = {
    entityId: number;
    entityTypeName: string;
};

export type OperationAssignPayload =
    | {
          assignedUserId: string;
          assignedUserIds?: string[];
          assignedBy: string;
      }
    | {
          assignedUserId: null;
          assignedUserIds?: string[];
          assignedBy: string;
      }
    | {
          assignedUserId?: string | null;
          assignedUserIds: string[];
          assignedBy: string;
      };

export type OperationCompletePayload = {
    completedBy: string;
    images?: string[];
    notes?: string;
};

export type OperationBlockPayload = ScheduleTaskBlockPayload;
export type RaisedBedFieldPlantBlockPayload = ScheduleTaskBlockPayload;

export type OperationCompletionEvidenceUpdatePayload = {
    updatedBy: string;
    images: string[];
    notes: string;
};

export type OperationVerifyPayload = {
    verifiedBy: string;
};

export type OperationFailPayload = {
    error: string;
    errorCode: string;
};

export type OperationCancelPayload = {
    canceledBy: string;
    expectedEntityId?: number;
    expectedTaskVersionEventId?: number;
    notificationRequested?: boolean;
    operatorNotificationRequested?: boolean;
    refundAmount?: number;
    reason: string;
};

/** Union of all operation event payloads */
export type OperationEventsPayload =
    | OperationAcceptancePayload
    | OperationAssignPayload
    | OperationEntityChangePayload
    | OperationSchedulePayload
    | OperationCompletePayload
    | OperationBlockPayload
    | OperationCompletionEvidenceUpdatePayload
    | OperationVerifyPayload
    | OperationFailPayload
    | OperationCancelPayload;

export type OperationEventsAnyPayload = Partial<
    OperationAcceptancePayload &
        OperationAssignPayload &
        OperationEntityChangePayload &
        OperationSchedulePayload &
        OperationCompletePayload &
        OperationCompletionEvidenceUpdatePayload &
        OperationVerifyPayload &
        OperationFailPayload &
        OperationCancelPayload
>;

// ============================================================================
// Approval request event payload types
// ============================================================================
export type PlantStatusApprovalTarget = {
    kind: 'raisedBedField.plantStatus';
    raisedBedId: number;
    positionIndex: number;
    raisedBedFieldId?: number | null;
    plantCycleEventId?: number | null;
    plantCycleVersionEventId?: number | null;
    accountId?: string | null;
    gardenId?: number | null;
    plantSortId?: number | null;
    currentStatus?: string | null;
    requestedStatus: string;
    effectiveAt?: string | null;
};

export type ApprovalRequestTarget = PlantStatusApprovalTarget;

export type ApprovalRequestCreatePayload = {
    target: ApprovalRequestTarget;
    requestedBy: string;
    requestedAt: string;
    note?: string | null;
};

export type ApprovalRequestReviewPayload = {
    reviewedBy: string;
    reviewedAt: string;
    note?: string | null;
};

// ============================================================================
// Delivery event payload types
// ============================================================================
export type DeliveryRequestCreatePayload = {
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
};

export type DeliveryRequestSlotChangedPayload = {
    previousSlotId: number;
    newSlotId: number;
};

export type DeliveryRequestAddressChangedPayload = {
    addressId: number;
};

export type DeliveryRequestCancelledPayload = {
    actorType: string;
    cancelReason: string;
    note?: string;
    cancelledBy?: string;
};

export type DeliveryRequestStatusPayload = {
    status: string;
};

export type DeliveryRequestFulfilledPayload = {
    status: string;
    deliveryNotes?: string;
};

export type DeliveryRequestSurveySentPayload = {
    sentTo: string[];
};

export type DeliveryRequestReadyEmailProcessedPayload = {
    readyEventId: number;
    sentTo: string[];
    batchRequestIds: string[];
    completed?: boolean;
    skipped?: boolean;
};

export type DeliveryRequestEventsPayload =
    | DeliveryRequestCreatePayload
    | DeliveryRequestSlotChangedPayload
    | DeliveryRequestAddressChangedPayload
    | DeliveryRequestCancelledPayload
    | DeliveryRequestStatusPayload
    | DeliveryRequestFulfilledPayload
    | DeliveryRequestSurveySentPayload
    | DeliveryRequestReadyEmailProcessedPayload;

export type DeliveryRequestEventsAnyPayload = Partial<
    DeliveryRequestCreatePayload &
        DeliveryRequestSlotChangedPayload &
        DeliveryRequestAddressChangedPayload &
        DeliveryRequestCancelledPayload &
        DeliveryRequestStatusPayload &
        DeliveryRequestFulfilledPayload &
        DeliveryRequestSurveySentPayload &
        DeliveryRequestReadyEmailProcessedPayload
>;

// ============================================================================
// Payout events
// ============================================================================
export type PayoutRequestedPayload = {
    userId: string;
    farmId: number;
    amount: number;
    currency: string;
};

export type PayoutApprovedPayload = {
    approvedByUserId: string;
    adminNote?: string;
    originalAmount?: number;
    adjustmentTotal?: number;
    approvedAmount?: number;
    currency?: string;
    adjustments?: {
        label: string;
        amount: number;
    }[];
};

export type PayoutRejectedPayload = {
    rejectionReason?: string;
};

export type PayoutPaidPayload = {
    bankReference: string;
    receiptId: number;
};

// ============================================================================
// Generic event type
// ============================================================================
export type Event = {
    type: string;
    version: number;
    aggregateId: string;
    data?: unknown | null | undefined;
    createdAt?: Date;
};
