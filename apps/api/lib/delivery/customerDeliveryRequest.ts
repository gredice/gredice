type CustomerImageSource = {
    cover?: {
        url?: string | null;
    } | null;
} | null;

type CustomerDeliveryRequestSource = {
    id: string;
    operationId: number;
    mode?: unknown;
    state: string;
    createdAt: Date;
    slot?: {
        id: number;
        startAt: Date;
        endAt: Date;
    } | null;
    address?: {
        id: number;
        label: string;
        street1: string;
        street2?: string | null;
        city: string;
        postalCode: string;
        countryCode: string;
    } | null;
    location?: {
        id: number;
        name: string;
        street1: string;
        street2?: string | null;
        city: string;
        postalCode: string;
        countryCode: string;
    } | null;
    operationData?: {
        information?: {
            label?: string | null;
            name?: string | null;
        } | null;
        image?: CustomerImageSource;
    } | null;
    plantSort?: {
        information?: {
            name?: string | null;
        } | null;
        image?: CustomerImageSource;
    } | null;
    raisedBed?: {
        name: string;
        physicalId?: string | null;
    } | null;
    raisedBedField?: {
        positionIndex: number;
    } | null;
    requestNotes?: string;
    cancelReason?: string;
    trace?: {
        publicPath: string;
    } | null;
    customerHandoffReceipt?: {
        fulfilledAt: Date;
        verification: 'verified' | 'no-label' | 'skipped' | 'not-recorded';
    };
};

function customerImage(image: CustomerImageSource | undefined) {
    const url = image?.cover?.url;
    return typeof url === 'string' && url.length > 0
        ? { cover: { url } }
        : null;
}

function customerOperationData(
    operationData: CustomerDeliveryRequestSource['operationData'],
) {
    if (!operationData) return null;

    return {
        information: {
            label: operationData.information?.label ?? null,
            name: operationData.information?.name ?? null,
        },
        image: customerImage(operationData.image),
    };
}

function customerPlantSort(
    plantSort: CustomerDeliveryRequestSource['plantSort'],
) {
    if (!plantSort) return null;

    return {
        information: {
            name: plantSort.information?.name ?? null,
        },
        image: customerImage(plantSort.image),
    };
}

function customerSlot(slot: CustomerDeliveryRequestSource['slot']) {
    if (!slot) return null;

    return {
        id: slot.id,
        startAt: slot.startAt,
        endAt: slot.endAt,
    };
}

function customerAddress(address: CustomerDeliveryRequestSource['address']) {
    if (!address) return null;

    return {
        id: address.id,
        label: address.label,
        street1: address.street1,
        street2: address.street2 ?? null,
        city: address.city,
        postalCode: address.postalCode,
        countryCode: address.countryCode,
    };
}

function customerPickupLocation(
    location: CustomerDeliveryRequestSource['location'],
) {
    if (!location) return null;

    return {
        id: location.id,
        name: location.name,
        street1: location.street1,
        street2: location.street2 ?? null,
        city: location.city,
        postalCode: location.postalCode,
        countryCode: location.countryCode,
    };
}

type CustomerDeliveryRequest = {
    id: string;
    operationId: number;
    state: string;
    createdAt: Date;
    slot: ReturnType<typeof customerSlot>;
    operationData: ReturnType<typeof customerOperationData>;
    plantSort: ReturnType<typeof customerPlantSort>;
    raisedBed: {
        name: string;
        physicalId: string | null;
    } | null;
    raisedBedField: {
        positionIndex: number;
    } | null;
    trace: {
        publicPath: string;
    } | null;
    requestNotes?: string;
    cancelReason?: string;
} & (
    | {
          mode: 'delivery';
          address: ReturnType<typeof customerAddress>;
          location?: null;
          customerHandoffReceipt?: {
              fulfilledAt: Date;
              verification:
                  | 'verified'
                  | 'no-label'
                  | 'skipped'
                  | 'not-recorded';
          };
      }
    | {
          mode: 'pickup';
          location: ReturnType<typeof customerPickupLocation>;
          address?: null;
          customerHandoffReceipt?: never;
      }
);

/**
 * Projects the storage aggregate to the fields used by account-owned customer
 * clients. The mode branches prevent delivery-only data from crossing into a
 * pickup response (and vice versa), while unknown legacy modes fail closed.
 */
export function customerDeliveryRequest<
    const TRequest extends CustomerDeliveryRequestSource,
>(request: TRequest): CustomerDeliveryRequest | null {
    if (request.mode !== 'delivery' && request.mode !== 'pickup') {
        return null;
    }

    const common = {
        id: request.id,
        operationId: request.operationId,
        state: request.state,
        createdAt: request.createdAt,
        slot: customerSlot(request.slot),
        operationData: customerOperationData(request.operationData),
        plantSort: customerPlantSort(request.plantSort),
        raisedBed: request.raisedBed
            ? {
                  name: request.raisedBed.name,
                  physicalId: request.raisedBed.physicalId ?? null,
              }
            : null,
        raisedBedField: request.raisedBedField
            ? { positionIndex: request.raisedBedField.positionIndex }
            : null,
        trace: request.trace ? { publicPath: request.trace.publicPath } : null,
        ...(typeof request.requestNotes === 'string'
            ? { requestNotes: request.requestNotes }
            : {}),
        ...(typeof request.cancelReason === 'string'
            ? { cancelReason: request.cancelReason }
            : {}),
    };

    if (request.mode === 'pickup') {
        return {
            ...common,
            mode: 'pickup',
            location: customerPickupLocation(request.location),
        };
    }

    return {
        ...common,
        mode: 'delivery',
        address: customerAddress(request.address),
        ...(request.state === 'fulfilled' && request.customerHandoffReceipt
            ? {
                  customerHandoffReceipt: {
                      fulfilledAt: request.customerHandoffReceipt.fulfilledAt,
                      verification: request.customerHandoffReceipt.verification,
                  },
              }
            : {}),
    };
}
