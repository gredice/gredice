import type { SelectTimeSlot } from '@gredice/storage';

// Type definitions shared across schedule components
export type RaisedBedField = {
    id: number;
    raisedBedId: number;
    positionIndex: number;
    plantStatus?: string;
    plantScheduledDate?: Date;
    plantSortId?: number;
    plantSowDate?: Date;
    plantGrowthDate?: Date;
    plantReadyDate?: Date;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
};

export type RaisedBed = {
    id: number;
    physicalId: string | null;
    name?: string | null;
    accountId?: string | null;
    gardenId?: number | null;
    blockId?: string | null;
    fields: RaisedBedField[];
};

export type Operation = {
    id: number;
    raisedBedId: number | null;
    raisedBedFieldId?: number | null;
    entityId: number;
    entityTypeName: string;
    accountId?: string | null;
    gardenId?: number | null;
    status: string;
    scheduledDate?: Date;
    completedAt?: Date;
    completedBy?: string;
    timestamp: Date;
    createdAt: Date;
    isAccepted: boolean;
    isDeleted: boolean;
};

export type DeliveryRequestAddress = {
    contactName?: string | null;
    phone?: string | null;
    street1?: string | null;
    street2?: string | null;
    city?: string | null;
    postalCode?: string | null;
};

export type DeliveryRequestLocation = {
    id: number;
    name?: string | null;
};

export type DeliveryRequestSlot = SelectTimeSlot | undefined;

export type DeliveryRequest = {
    id: string;
    operationId?: number | null;
    state: string;
    slot?: DeliveryRequestSlot;
    address?: DeliveryRequestAddress;
    location?: DeliveryRequestLocation | null;
    mode?: 'delivery' | 'pickup' | null;
    cancelReason?: string | null;
    requestNotes?: string | null;
    deliveryNotes?: string | null;
    surveySent: boolean;
    createdAt: Date;
    updatedAt: Date;
    accountId?: string | null;
};
