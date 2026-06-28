import type { DeliveryRequestDetails } from './DeliveryRequestListTypes';

type DateValue = Date | string | null | undefined;

type GroupableDeliveryRequest = {
    id: string;
    accountId?: string | null;
    mode?: string | null;
    state: string;
    slot?:
        | {
              id?: number | null;
              startAt?: DateValue;
              endAt?: DateValue;
          }
        | null
        | undefined;
    address?:
        | {
              id?: number | null;
              contactName?: string | null;
              phone?: string | null;
              street1?: string | null;
              street2?: string | null;
              postalCode?: string | null;
              city?: string | null;
              countryCode?: string | null;
          }
        | null
        | undefined;
    location?:
        | {
              id?: number | null;
              name?: string | null;
              street1?: string | null;
              street2?: string | null;
              postalCode?: string | null;
              city?: string | null;
              countryCode?: string | null;
          }
        | null
        | undefined;
    requestNotes?: string | null;
    deliveryNotes?: string | null;
    cancelReason?: string | null;
    createdAt: Date | string;
    raisedBed?:
        | {
              id: number;
              physicalId?: string | null;
          }
        | null
        | undefined;
    raisedBedField?:
        | {
              positionIndex?: number | null;
          }
        | null
        | undefined;
    plantSort?:
        | {
              information?: {
                  name?: string | null;
              };
          }
        | null
        | undefined;
};

export type DeliveryRequestGroup<
    Request extends GroupableDeliveryRequest = DeliveryRequestDetails,
> = {
    key: string;
    requests: Request[];
};

function normalizeKeyPart(value: string | null | undefined) {
    const trimmed = value?.trim().toLowerCase();
    return trimmed || 'unknown';
}

function dateKey(value: DateValue) {
    if (!value) {
        return 'unknown';
    }

    return typeof value === 'string' ? value : value.toISOString();
}

function getSlotKey(request: GroupableDeliveryRequest) {
    if (typeof request.slot?.id === 'number') {
        return `slot:${request.slot.id}`;
    }

    return [
        'slot',
        dateKey(request.slot?.startAt),
        dateKey(request.slot?.endAt),
    ].join(':');
}

function getDestinationKey(request: GroupableDeliveryRequest) {
    if (request.mode === 'pickup') {
        const location = request.location;

        return [
            'pickup',
            location?.id ?? 'unknown',
            normalizeKeyPart(location?.name),
            normalizeKeyPart(location?.street1),
            normalizeKeyPart(location?.street2),
            normalizeKeyPart(location?.postalCode),
            normalizeKeyPart(location?.city),
            normalizeKeyPart(location?.countryCode),
        ].join(':');
    }

    const address = request.address;

    return [
        'delivery',
        address?.id ?? 'unknown',
        normalizeKeyPart(address?.contactName),
        normalizeKeyPart(address?.phone),
        normalizeKeyPart(address?.street1),
        normalizeKeyPart(address?.street2),
        normalizeKeyPart(address?.postalCode),
        normalizeKeyPart(address?.city),
        normalizeKeyPart(address?.countryCode),
    ].join(':');
}

function getNotesKey(request: GroupableDeliveryRequest) {
    return [
        normalizeKeyPart(request.requestNotes),
        normalizeKeyPart(request.deliveryNotes),
        normalizeKeyPart(request.cancelReason),
    ].join(':');
}

function getDeliveryRequestGroupKey(request: GroupableDeliveryRequest) {
    return [
        request.accountId ?? 'account:unknown',
        request.mode ?? 'mode:unknown',
        request.state,
        getSlotKey(request),
        getDestinationKey(request),
        getNotesKey(request),
    ].join('|');
}

function comparePhysicalIds(left: string, right: string) {
    if (!left && !right) {
        return 0;
    }

    if (!left) {
        return 1;
    }

    if (!right) {
        return -1;
    }

    const leftNumber = Number(left);
    const rightNumber = Number(right);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        return leftNumber - rightNumber;
    }

    return left.localeCompare(right, undefined, { numeric: true });
}

function compareMaybeDate(left: Date | string, right: Date | string) {
    const leftDate = typeof left === 'string' ? new Date(left) : left;
    const rightDate = typeof right === 'string' ? new Date(right) : right;

    return leftDate.getTime() - rightDate.getTime();
}

function compareDeliveryRequestContents(
    left: GroupableDeliveryRequest,
    right: GroupableDeliveryRequest,
) {
    const leftPhysicalId = left.raisedBed?.physicalId ?? '';
    const rightPhysicalId = right.raisedBed?.physicalId ?? '';
    const physicalIdComparison = comparePhysicalIds(
        leftPhysicalId,
        rightPhysicalId,
    );
    if (physicalIdComparison !== 0) {
        return physicalIdComparison;
    }

    const raisedBedComparison =
        (left.raisedBed?.id ?? 0) - (right.raisedBed?.id ?? 0);
    if (raisedBedComparison !== 0) {
        return raisedBedComparison;
    }

    const positionComparison =
        (left.raisedBedField?.positionIndex ?? Number.POSITIVE_INFINITY) -
        (right.raisedBedField?.positionIndex ?? Number.POSITIVE_INFINITY);
    if (positionComparison !== 0) {
        return positionComparison;
    }

    const plantSortComparison = normalizeKeyPart(
        left.plantSort?.information?.name,
    ).localeCompare(
        normalizeKeyPart(right.plantSort?.information?.name),
        undefined,
        { numeric: true },
    );
    if (plantSortComparison !== 0) {
        return plantSortComparison;
    }

    return compareMaybeDate(left.createdAt, right.createdAt);
}

export function groupDeliveryRequests<Request extends GroupableDeliveryRequest>(
    requests: Request[],
): DeliveryRequestGroup<Request>[] {
    const groups = new Map<string, Request[]>();

    for (const request of requests) {
        const key = getDeliveryRequestGroupKey(request);
        const existingRequests = groups.get(key);

        if (existingRequests) {
            existingRequests.push(request);
        } else {
            groups.set(key, [request]);
        }
    }

    return [...groups.entries()].map(([key, groupRequests]) => ({
        key,
        requests: groupRequests.toSorted(compareDeliveryRequestContents),
    }));
}
