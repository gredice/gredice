import type { DeliveryBatchSummary } from './deliveryDashboardTypes';

export type DeliveryRouteSelectionCandidate = {
    requestId: string;
    stopKey: string;
    readyForPickup: boolean;
    pickupLocationId: number;
    pickupLocationName: string | null;
    pickupAddress: string | null;
    slotId: number;
    slotStartAt: string;
    slotEndAt: string;
    deliveryAddress: string;
};

export type DeliveryRouteSelectionPickupLocation = {
    id: number;
    name: string | null;
    address: string | null;
    requestIds: string[];
};

export type DeliveryRouteSelectionSlot = {
    id: number;
    startAt: string;
    endAt: string;
    requestIds: string[];
};

export type DeliveryRouteSelectionConflict = {
    code:
        | 'delivery-window-invalid'
        | 'mixed-pickup-locations'
        | 'route-stop-limit-exceeded'
        | 'route-window-span-exceeded';
    message: string;
    conflictingRequestIds: string[];
    pickupLocations: DeliveryRouteSelectionPickupLocation[];
    slots: DeliveryRouteSelectionSlot[];
    deliveryAddress: string | null;
    separateRouteRequestIds: string[];
};

export type DeliveryRouteSelectionSummary = {
    requestIds: string[];
    deliveryCount: number;
    stopCount: number;
    pickupLocations: DeliveryRouteSelectionPickupLocation[];
    slots: DeliveryRouteSelectionSlot[];
    windowStartAt: string | null;
    windowEndAt: string | null;
    windowSpanMinutes: number;
};

export type DeliveryRouteSelectionInspection = {
    summary: DeliveryRouteSelectionSummary;
    conflict: DeliveryRouteSelectionConflict | null;
};

export type DeliveryRouteSelectionChange =
    | {
          status: 'accepted';
          requestIds: string[];
          summary: DeliveryRouteSelectionSummary;
      }
    | {
          status: 'rejected';
          requestIds: string[];
          summary: DeliveryRouteSelectionSummary;
          conflict: DeliveryRouteSelectionConflict;
      };

function pickupLocationLabel(location: DeliveryRouteSelectionPickupLocation) {
    return (
        location.name?.trim() ||
        location.address?.trim() ||
        `Lokacija preuzimanja ${location.id}`
    );
}

function formatSlotDateTime(value: number) {
    return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Europe/Zagreb',
    }).format(value);
}

function uniqueCandidates(
    candidates: readonly DeliveryRouteSelectionCandidate[],
    requestIds: readonly string[],
) {
    const candidateByRequestId = new Map(
        candidates.map((candidate) => [candidate.requestId, candidate]),
    );
    const uniqueRequestIds = Array.from(new Set(requestIds));
    return uniqueRequestIds.flatMap((requestId) => {
        const candidate = candidateByRequestId.get(requestId);
        return candidate?.readyForPickup ? [candidate] : [];
    });
}

function pickupLocations(
    candidates: readonly DeliveryRouteSelectionCandidate[],
) {
    const grouped = new Map<number, DeliveryRouteSelectionPickupLocation>();
    for (const candidate of candidates) {
        const existing = grouped.get(candidate.pickupLocationId);
        if (existing) {
            existing.requestIds.push(candidate.requestId);
        } else {
            grouped.set(candidate.pickupLocationId, {
                id: candidate.pickupLocationId,
                name: candidate.pickupLocationName,
                address: candidate.pickupAddress,
                requestIds: [candidate.requestId],
            });
        }
    }
    return Array.from(grouped.values());
}

function slots(candidates: readonly DeliveryRouteSelectionCandidate[]) {
    const grouped = new Map<number, DeliveryRouteSelectionSlot>();
    for (const candidate of candidates) {
        const existing = grouped.get(candidate.slotId);
        if (existing) {
            existing.requestIds.push(candidate.requestId);
        } else {
            grouped.set(candidate.slotId, {
                id: candidate.slotId,
                startAt: candidate.slotStartAt,
                endAt: candidate.slotEndAt,
                requestIds: [candidate.requestId],
            });
        }
    }
    return Array.from(grouped.values()).sort(
        (first, second) =>
            new Date(first.startAt).getTime() -
            new Date(second.startAt).getTime(),
    );
}

function buildSummary(
    candidates: readonly DeliveryRouteSelectionCandidate[],
): DeliveryRouteSelectionSummary {
    const timestamps = candidates.flatMap((candidate) => {
        const startAt = new Date(candidate.slotStartAt).getTime();
        const endAt = new Date(candidate.slotEndAt).getTime();
        return Number.isFinite(startAt) && Number.isFinite(endAt)
            ? [{ startAt, endAt }]
            : [];
    });
    const windowStart =
        timestamps.length > 0
            ? Math.min(...timestamps.map(({ startAt }) => startAt))
            : null;
    const windowEnd =
        timestamps.length > 0
            ? Math.max(...timestamps.map(({ endAt }) => endAt))
            : null;

    return {
        requestIds: candidates.map((candidate) => candidate.requestId),
        deliveryCount: candidates.length,
        stopCount: new Set(candidates.map((candidate) => candidate.stopKey))
            .size,
        pickupLocations: pickupLocations(candidates),
        slots: slots(candidates),
        windowStartAt:
            windowStart === null ? null : new Date(windowStart).toISOString(),
        windowEndAt:
            windowEnd === null ? null : new Date(windowEnd).toISOString(),
        windowSpanMinutes:
            windowStart === null || windowEnd === null
                ? 0
                : Math.round((windowEnd - windowStart) / 60_000),
    };
}

function findConflict({
    candidates,
    maximumRouteStops,
    maximumRouteWindowHours,
}: {
    candidates: readonly DeliveryRouteSelectionCandidate[];
    maximumRouteStops: number;
    maximumRouteWindowHours: number;
}): Omit<DeliveryRouteSelectionConflict, 'separateRouteRequestIds'> | null {
    const selectedPickupLocations = pickupLocations(candidates);
    const selectedSlots = slots(candidates);
    const invalidWindowCandidate = candidates.find((candidate) => {
        const startAt = new Date(candidate.slotStartAt).getTime();
        const endAt = new Date(candidate.slotEndAt).getTime();
        return (
            !Number.isFinite(startAt) ||
            !Number.isFinite(endAt) ||
            startAt >= endAt
        );
    });
    if (invalidWindowCandidate) {
        return {
            code: 'delivery-window-invalid',
            message: `Termin dostave za adresu ${invalidWindowCandidate.deliveryAddress} nije valjan. Osvježi popis i pokušaj ponovno.`,
            conflictingRequestIds: [invalidWindowCandidate.requestId],
            pickupLocations: selectedPickupLocations,
            slots: selectedSlots,
            deliveryAddress: invalidWindowCandidate.deliveryAddress,
        };
    }

    if (selectedPickupLocations.length > 1) {
        const [firstLocation, secondLocation] = selectedPickupLocations;
        if (firstLocation && secondLocation) {
            return {
                code: 'mixed-pickup-locations',
                message: `Odabrani urodi čekaju na više lokacija preuzimanja: ${pickupLocationLabel(firstLocation)} i ${pickupLocationLabel(secondLocation)}. Pokreni zasebnu rutu za svaku lokaciju.`,
                conflictingRequestIds: secondLocation.requestIds,
                pickupLocations: selectedPickupLocations,
                slots: selectedSlots,
                deliveryAddress: null,
            };
        }
    }

    const stopGroups = new Map<string, DeliveryRouteSelectionCandidate[]>();
    for (const candidate of candidates) {
        const group = stopGroups.get(candidate.stopKey);
        if (group) group.push(candidate);
        else stopGroups.set(candidate.stopKey, [candidate]);
    }
    if (stopGroups.size > maximumRouteStops) {
        const conflictingGroup = Array.from(stopGroups.values())[
            maximumRouteStops
        ];
        const conflictingCandidate = conflictingGroup?.[0];
        return {
            code: 'route-stop-limit-exceeded',
            message: `Jedna ruta može sadržavati najviše ${maximumRouteStops} fizičkih stanica. Adresu ${conflictingCandidate?.deliveryAddress ?? 'sljedeće dostave'} ostavi za zasebnu rutu.`,
            conflictingRequestIds:
                conflictingGroup?.map((candidate) => candidate.requestId) ?? [],
            pickupLocations: selectedPickupLocations,
            slots: selectedSlots,
            deliveryAddress: conflictingCandidate?.deliveryAddress ?? null,
        };
    }

    const timestamps = candidates.map((candidate) => ({
        candidate,
        startAt: new Date(candidate.slotStartAt).getTime(),
        endAt: new Date(candidate.slotEndAt).getTime(),
    }));
    if (timestamps.length > 0) {
        const earliest = timestamps.reduce((first, current) =>
            current.startAt < first.startAt ? current : first,
        );
        const latest = timestamps.reduce((first, current) =>
            current.endAt > first.endAt ? current : first,
        );
        if (
            latest.endAt - earliest.startAt >
            maximumRouteWindowHours * 60 * 60 * 1_000
        ) {
            const conflictingSlot = selectedSlots.find(
                (slot) => slot.id === latest.candidate.slotId,
            );
            return {
                code: 'route-window-span-exceeded',
                message: `Odabrani termini traju od ${formatSlotDateTime(earliest.startAt)} do ${formatSlotDateTime(latest.endAt)}, dulje od dopuštenih ${maximumRouteWindowHours} sata. Termin od ${formatSlotDateTime(latest.startAt)} ostavi za zasebnu rutu.`,
                conflictingRequestIds: conflictingSlot?.requestIds ?? [
                    latest.candidate.requestId,
                ],
                pickupLocations: selectedPickupLocations,
                slots: selectedSlots,
                deliveryAddress: latest.candidate.deliveryAddress,
            };
        }
    }

    return null;
}

function compatibleRequestIds({
    candidates,
    maximumRouteStops,
    maximumRouteWindowHours,
}: {
    candidates: readonly DeliveryRouteSelectionCandidate[];
    maximumRouteStops: number;
    maximumRouteWindowHours: number;
}) {
    const groups = new Map<string, DeliveryRouteSelectionCandidate[]>();
    for (const candidate of candidates) {
        const group = groups.get(candidate.stopKey);
        if (group) group.push(candidate);
        else groups.set(candidate.stopKey, [candidate]);
    }

    const accepted: DeliveryRouteSelectionCandidate[] = [];
    for (const group of groups.values()) {
        const proposed = [...accepted, ...group];
        if (
            !findConflict({
                candidates: proposed,
                maximumRouteStops,
                maximumRouteWindowHours,
            })
        ) {
            accepted.push(...group);
        }
    }
    return accepted.map((candidate) => candidate.requestId);
}

export function inspectDeliveryRouteSelection({
    candidates,
    requestIds,
    maximumRouteStops,
    maximumRouteWindowHours,
}: {
    candidates: readonly DeliveryRouteSelectionCandidate[];
    requestIds: readonly string[];
    maximumRouteStops: number;
    maximumRouteWindowHours: number;
}): DeliveryRouteSelectionInspection {
    const selectedCandidates = uniqueCandidates(candidates, requestIds);
    const summary = buildSummary(selectedCandidates);
    const conflict = findConflict({
        candidates: selectedCandidates,
        maximumRouteStops,
        maximumRouteWindowHours,
    });
    return {
        summary,
        conflict: conflict
            ? {
                  ...conflict,
                  separateRouteRequestIds: compatibleRequestIds({
                      candidates: selectedCandidates,
                      maximumRouteStops,
                      maximumRouteWindowHours,
                  }),
              }
            : null,
    };
}

export function applyDeliveryRouteSelection({
    candidates,
    currentRequestIds,
    nextRequestIds,
    maximumRouteStops,
    maximumRouteWindowHours,
}: {
    candidates: readonly DeliveryRouteSelectionCandidate[];
    currentRequestIds: readonly string[];
    nextRequestIds: readonly string[];
    maximumRouteStops: number;
    maximumRouteWindowHours: number;
}): DeliveryRouteSelectionChange {
    const current = inspectDeliveryRouteSelection({
        candidates,
        requestIds: currentRequestIds,
        maximumRouteStops,
        maximumRouteWindowHours,
    });
    const next = inspectDeliveryRouteSelection({
        candidates,
        requestIds: nextRequestIds,
        maximumRouteStops,
        maximumRouteWindowHours,
    });
    if (!next.conflict) {
        return {
            status: 'accepted',
            requestIds: next.summary.requestIds,
            summary: next.summary,
        };
    }

    let conflict = next.conflict;
    if (
        conflict.code === 'route-window-span-exceeded' &&
        current.summary.requestIds.length > 0 &&
        current.summary.windowStartAt &&
        current.summary.windowEndAt
    ) {
        const currentRequestIdSet = new Set(current.summary.requestIds);
        const candidateByRequestId = new Map(
            candidates.map((candidate) => [candidate.requestId, candidate]),
        );
        const currentWindowStart = new Date(
            current.summary.windowStartAt,
        ).getTime();
        const currentWindowEnd = new Date(
            current.summary.windowEndAt,
        ).getTime();
        const attemptedCandidates = next.summary.requestIds.flatMap(
            (requestId) => {
                const candidate = candidateByRequestId.get(requestId);
                return !currentRequestIdSet.has(requestId) && candidate
                    ? [candidate]
                    : [];
            },
        );
        const attemptedCandidate = attemptedCandidates.sort((first, second) => {
            const firstStart = new Date(first.slotStartAt).getTime();
            const firstEnd = new Date(first.slotEndAt).getTime();
            const secondStart = new Date(second.slotStartAt).getTime();
            const secondEnd = new Date(second.slotEndAt).getTime();
            const firstExtension = Math.max(
                currentWindowStart - firstStart,
                firstEnd - currentWindowEnd,
                0,
            );
            const secondExtension = Math.max(
                currentWindowStart - secondStart,
                secondEnd - currentWindowEnd,
                0,
            );
            return secondExtension - firstExtension;
        })[0];
        if (attemptedCandidate) {
            const attemptedSlotRequestIds = attemptedCandidates
                .filter(
                    (candidate) =>
                        candidate.slotId === attemptedCandidate.slotId,
                )
                .map((candidate) => candidate.requestId);
            conflict = {
                ...conflict,
                message: `Dodani termin ${formatSlotDateTime(new Date(attemptedCandidate.slotStartAt).getTime())} – ${formatSlotDateTime(new Date(attemptedCandidate.slotEndAt).getTime())} proširuje odabrani raspon na više od ${maximumRouteWindowHours} sata. Ostavi taj termin za zasebnu rutu.`,
                conflictingRequestIds: attemptedSlotRequestIds,
                deliveryAddress: attemptedCandidate.deliveryAddress,
            };
        }
    }

    return {
        status: 'rejected',
        requestIds: current.summary.requestIds,
        summary: current.summary,
        conflict,
    };
}

export function deliveryRouteSelectionCandidatesFromBatches(
    batches: readonly DeliveryBatchSummary[],
) {
    return batches.flatMap((batch) =>
        batch.orders.map(
            (order): DeliveryRouteSelectionCandidate => ({
                requestId: order.requestId,
                stopKey: order.stopKey,
                readyForPickup: order.readyForPickup,
                pickupLocationId: batch.pickupLocationId,
                pickupLocationName: batch.pickupLocationName,
                pickupAddress: batch.pickupAddress,
                slotId: batch.slotId,
                slotStartAt: batch.startAt,
                slotEndAt: batch.endAt,
                deliveryAddress: order.address,
            }),
        ),
    );
}
