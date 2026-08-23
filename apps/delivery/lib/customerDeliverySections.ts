import type {
    CustomerDeliveryDashboardRequest,
    CustomerDeliveryProgressSummary,
    CustomerDeliveryRequestSummary,
} from './deliveryDashboardTypes';
import type { DeliveryDeepLinkTarget } from './deliveryDeepLink';

export const customerDeliveryInitialHistoryCount = 6;

export type CustomerDeliverySections = {
    active: CustomerDeliveryRequestSummary[];
    upcoming: CustomerDeliveryDashboardRequest[];
    history: CustomerDeliveryDashboardRequest[];
};

export type CustomerDeliveryDeepLinkSelection =
    | { kind: 'none' }
    | { kind: 'unavailable' }
    | {
          kind: 'selected';
          section: keyof CustomerDeliverySections;
          index: number;
          request: CustomerDeliveryDashboardRequest;
      };

type IndexedRequest<TRequest extends CustomerDeliveryDashboardRequest> = {
    index: number;
    request: TRequest;
};

const activePhaseRanks: Record<
    CustomerDeliveryProgressSummary['phase'],
    number
> = {
    arrived: 0,
    next: 1,
    'on-route': 2,
    scheduled: 3,
    unavailable: 4,
};

function activePhaseRank(request: CustomerDeliveryDashboardRequest) {
    return request.mode === 'delivery'
        ? activePhaseRanks[request.progress.phase]
        : Number.MAX_SAFE_INTEGER;
}

function canonicalTimestamp(value: string | null) {
    if (!value) return null;
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return null;
    return new Date(timestamp).toISOString() === value ? timestamp : null;
}

function requestSlotTimestamp(request: CustomerDeliveryDashboardRequest) {
    return (
        canonicalTimestamp(request.slotStartAt) ??
        canonicalTimestamp(request.slotEndAt)
    );
}

function requestCompletionTimestamp(request: CustomerDeliveryDashboardRequest) {
    const completedAt =
        request.mode === 'delivery' ? request.deliveredAt : request.pickedUpAt;
    return canonicalTimestamp(completedAt) ?? requestSlotTimestamp(request);
}

function compareNullableNumbers(
    first: number | null,
    second: number | null,
    direction: 'ascending' | 'descending',
) {
    if (first === null) return second === null ? 0 : 1;
    if (second === null) return -1;
    if (first === second) return 0;
    if (direction === 'ascending') return first < second ? -1 : 1;
    return first > second ? -1 : 1;
}

function stableSort<TRequest extends CustomerDeliveryDashboardRequest>(
    requests: IndexedRequest<TRequest>[],
    compare: (first: TRequest, second: TRequest) => number,
) {
    return requests
        .sort(
            (first, second) =>
                compare(first.request, second.request) ||
                first.index - second.index,
        )
        .map(({ request }) => request);
}

function activeStopsAhead(request: CustomerDeliveryDashboardRequest) {
    if (request.mode !== 'delivery') return null;
    const { stopsAhead } = request.progress;
    return Number.isSafeInteger(stopsAhead) && (stopsAhead ?? -1) >= 0
        ? stopsAhead
        : null;
}

function compareActiveRequests(
    first: CustomerDeliveryRequestSummary,
    second: CustomerDeliveryRequestSummary,
) {
    const phaseDifference = activePhaseRank(first) - activePhaseRank(second);
    if (phaseDifference !== 0) return phaseDifference;

    const stopsDifference = compareNullableNumbers(
        activeStopsAhead(first),
        activeStopsAhead(second),
        'ascending',
    );
    if (stopsDifference !== 0) return stopsDifference;

    return compareNullableNumbers(
        requestSlotTimestamp(first),
        requestSlotTimestamp(second),
        'ascending',
    );
}

function historyRecoveryRank(request: CustomerDeliveryDashboardRequest) {
    return request.mode === 'delivery' && request.recovery !== null ? 0 : 1;
}

export function organizeCustomerDeliverySections(
    requests: readonly CustomerDeliveryDashboardRequest[],
): CustomerDeliverySections {
    const active: IndexedRequest<CustomerDeliveryRequestSummary>[] = [];
    const upcoming: IndexedRequest<CustomerDeliveryDashboardRequest>[] = [];
    const history: IndexedRequest<CustomerDeliveryDashboardRequest>[] = [];

    requests.forEach((request, index) => {
        const indexed = { index, request };
        switch (request.lifecycle) {
            case 'active':
                if (request.mode === 'delivery') {
                    active.push({ index, request });
                }
                break;
            case 'upcoming':
                upcoming.push(indexed);
                break;
            case 'history':
                history.push(indexed);
                break;
        }
    });

    return {
        active: stableSort(active, compareActiveRequests),
        upcoming: stableSort(upcoming, (first, second) =>
            compareNullableNumbers(
                requestSlotTimestamp(first),
                requestSlotTimestamp(second),
                'ascending',
            ),
        ),
        history: stableSort(history, (first, second) => {
            const recoveryDifference =
                historyRecoveryRank(first) - historyRecoveryRank(second);
            if (recoveryDifference !== 0) return recoveryDifference;
            return compareNullableNumbers(
                requestCompletionTimestamp(first),
                requestCompletionTimestamp(second),
                'descending',
            );
        }),
    };
}

export function selectCustomerDeliveryDeepLink(
    sections: CustomerDeliverySections,
    target: DeliveryDeepLinkTarget,
): CustomerDeliveryDeepLinkSelection {
    if (target.kind === 'none') return { kind: 'none' };
    if (target.kind === 'invalid') return { kind: 'unavailable' };

    for (const section of ['active', 'upcoming', 'history'] as const) {
        const index = sections[section].findIndex(
            ({ requestId }) => requestId === target.requestId,
        );
        const request = sections[section][index];
        if (request) return { kind: 'selected', section, index, request };
    }

    return { kind: 'unavailable' };
}
