import type { DeliveryRequestDetails } from './DeliveryRequestListTypes';

type DateValue = Date | string | null | undefined;

type GroupableDeliveryRequest = {
    id: string;
    accountId?: string | null;
    operation?:
        | {
              accountId?: string | null;
          }
        | null
        | undefined;
    slot?:
        | {
              id?: number | null;
              startAt?: DateValue;
              endAt?: DateValue;
          }
        | null
        | undefined;
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

function getAccountKey(request: GroupableDeliveryRequest) {
    const accountId = request.accountId ?? request.operation?.accountId;

    return accountId ? `account:${accountId}` : `request:${request.id}`;
}

function getSlotKey(request: GroupableDeliveryRequest) {
    if (typeof request.slot?.id === 'number') {
        return `slot:${request.slot.id}`;
    }

    if (!request.slot?.startAt && !request.slot?.endAt) {
        return `slot:unknown:${request.id}`;
    }

    return [
        'slot',
        dateKey(request.slot?.startAt),
        dateKey(request.slot?.endAt),
    ].join(':');
}

function getDeliveryRequestGroupKey(request: GroupableDeliveryRequest) {
    return [getAccountKey(request), getSlotKey(request)].join('|');
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
