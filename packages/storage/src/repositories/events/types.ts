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
    invoiceId: string;
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
};

// ============================================================================
// Raised bed field event payload types
// ============================================================================
export type RaisedBedFieldCreatePayload = {
    status: string;
};

export type RaisedBedFieldPlantPlacePayload = {
    plantSortId: string;
    scheduledDate: string | null | undefined;
};

export type RaisedBedFieldPlantSchedulePayload = {
    scheduledDate: string | null | undefined;
};

export type RaisedBedFieldPlantUpdatePayload = {
    status: string;
};

export type RaisedBedFieldPlantReplaceSortPayload = {
    plantSortId: string;
};
export type RaisedBedFieldPlantEventsPayload =
    | RaisedBedFieldPlantPlacePayload
    | RaisedBedFieldPlantSchedulePayload
    | RaisedBedFieldPlantUpdatePayload
    | RaisedBedFieldPlantReplaceSortPayload;
export type RaisedBedFieldPlantEventsAnyPayload = Partial<
    RaisedBedFieldPlantPlacePayload &
        RaisedBedFieldPlantSchedulePayload &
        RaisedBedFieldPlantUpdatePayload &
        RaisedBedFieldPlantReplaceSortPayload
>;

// ============================================================================
// Operation event payload types
// ============================================================================
export type OperationSchedulePayload = {
    scheduledDate: string;
};

export type OperationCompletePayload = {
    completedBy: string;
    images?: string[];
};

export type OperationFailPayload = {
    error: string;
    errorCode: string;
};

export type OperationCancelPayload = {
    canceledBy: string;
    reason: string;
};

/** Union of all operation event payloads */
export type OperationEventsPayload =
    | OperationSchedulePayload
    | OperationCompletePayload
    | OperationFailPayload
    | OperationCancelPayload;

export type OperationEventsAnyPayload = Partial<
    OperationSchedulePayload &
        OperationCompletePayload &
        OperationFailPayload &
        OperationCancelPayload
>;

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
export type DeliveryRequestEventsPayload =
    | DeliveryRequestCreatePayload
    | DeliveryRequestSlotChangedPayload
    | DeliveryRequestAddressChangedPayload
    | DeliveryRequestCancelledPayload
    | DeliveryRequestStatusPayload
    | DeliveryRequestFulfilledPayload
    | DeliveryRequestSurveySentPayload;

export type DeliveryRequestEventsAnyPayload = Partial<
    DeliveryRequestCreatePayload &
        DeliveryRequestSlotChangedPayload &
        DeliveryRequestAddressChangedPayload &
        DeliveryRequestCancelledPayload &
        DeliveryRequestStatusPayload &
        DeliveryRequestFulfilledPayload &
        DeliveryRequestSurveySentPayload
>;

// ============================================================================
// Generic event type
// ============================================================================
export type Event = {
    type: string;
    version: number;
    aggregateId: string;
    data?: unknown | null | undefined;
};
