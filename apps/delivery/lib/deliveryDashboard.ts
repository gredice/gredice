import { notifyDeliveryRequestEvent } from '@gredice/notifications';
import {
    createDeliveryRun,
    DeliveryRequestStates,
    DeliveryRunStates,
    DeliveryRunStopStates,
    fulfillDeliveryRunStop,
    getActiveDeliveryRunForDriver,
    getDeliveryAccountContacts,
    getDeliveryRequest,
    getDeliveryRequestsWithEvents,
    getDeliveryRun,
    getDeliveryRunStop,
    getDeliveryRunStopsForRequestIds,
    getUser,
    markDeliveryRunStopArrived,
    readyDeliveryRequest,
    updateDeliveryRunEstimates,
    updateDeliveryRunLocation,
} from '@gredice/storage';
import 'server-only';
import type {
    ActiveDeliveryRunSummary,
    DeliveryContactSummary,
    DeliveryDashboard,
    DeliveryHarvestSummary,
    DeliveryRouteOrderSummary,
    DeliveryStopSummary,
    DeliveryTrackingLocation,
} from './deliveryDashboardTypes';
import {
    DeliveryRoutePlanningError,
    formatDeliveryDestinationAddress,
    maximumDeliveryRouteStops,
    maximumDeliveryRouteWindowHours,
    planDeliveryRoute,
    recalculateDeliveryRoute,
} from './deliveryRouting';

type ListedDeliveryRequest = Awaited<
    ReturnType<typeof getDeliveryRequestsWithEvents>
>[number];
type DeliveryRequest =
    | ListedDeliveryRequest
    | NonNullable<Awaited<ReturnType<typeof getDeliveryRequest>>>;
type DeliveryRun = NonNullable<Awaited<ReturnType<typeof getDeliveryRun>>>;
type DeliveryRunStop = DeliveryRun['stops'][number];
type DeliveryAccountContact = Awaited<
    ReturnType<typeof getDeliveryAccountContacts>
>[number];

const driverRoles = new Set(['driver', 'admin']);
const batchStates: ReadonlySet<string> = new Set([
    DeliveryRequestStates.CONFIRMED,
    DeliveryRequestStates.PREPARING,
    DeliveryRequestStates.READY,
]);
const etaRefreshIntervalMs = 2 * 60 * 1000;

export class DeliveryRunStartError extends Error {
    override name = 'DeliveryRunStartError';
}

function iso(value?: Date | null) {
    return value?.toISOString() ?? null;
}

function trackingLocation(run: {
    currentLatitude: number | null;
    currentLongitude: number | null;
    currentLocationAccuracy: number | null;
    currentLocationHeading: number | null;
    currentLocationSpeed: number | null;
    currentLocationRecordedAt: Date | null;
}): DeliveryTrackingLocation | null {
    if (
        run.currentLatitude === null ||
        run.currentLongitude === null ||
        !run.currentLocationRecordedAt
    ) {
        return null;
    }

    return {
        latitude: run.currentLatitude,
        longitude: run.currentLongitude,
        accuracy: run.currentLocationAccuracy,
        heading: run.currentLocationHeading,
        speed: run.currentLocationSpeed,
        recordedAt: run.currentLocationRecordedAt.toISOString(),
    };
}

function accountContacts(
    accountId: string | undefined,
    contacts: DeliveryAccountContact[],
): DeliveryContactSummary[] {
    if (!accountId) {
        return [];
    }

    return contacts
        .filter((contact) => contact.accountId === accountId)
        .map((contact) => ({
            id: contact.id,
            email: contact.userName,
            displayName: contact.displayName ?? contact.userName,
            avatarUrl: contact.avatarUrl,
        }));
}

function plantName(request: DeliveryRequest) {
    return (
        request.plantSort?.information?.name ??
        request.plantSort?.information?.plant?.information?.name ??
        request.operationData?.information?.label ??
        'Urod'
    );
}

function raisedBedName(request: DeliveryRequest) {
    const physicalId = request.raisedBed?.physicalId;
    return physicalId ? `Gredica ${physicalId}` : null;
}

function fieldName(request: DeliveryRequest) {
    const positionIndex = request.raisedBedField?.positionIndex;
    return typeof positionIndex === 'number'
        ? `Polje ${positionIndex + 1}`
        : null;
}

function harvestSummary(request: DeliveryRequest): DeliveryHarvestSummary {
    return {
        plantName: plantName(request),
        operationName: request.operationData?.information?.label ?? null,
        raisedBedName: raisedBedName(request),
        fieldName: fieldName(request),
        tracePath: request.trace?.publicPath ?? null,
    };
}

function statusLabel({
    requestState,
    stopState,
    isCurrent,
    runState,
}: {
    requestState: string;
    stopState?: string | null;
    isCurrent: boolean;
    runState?: string | null;
}) {
    if (
        stopState === DeliveryRunStopStates.DELIVERED ||
        requestState === DeliveryRequestStates.FULFILLED
    ) {
        return 'Dostavljeno';
    }
    if (stopState === DeliveryRunStopStates.ARRIVED) {
        return 'Vozač je stigao';
    }
    if (runState === DeliveryRunStates.ACTIVE) {
        return isCurrent ? 'Vozač stiže' : 'U dostavi';
    }

    switch (requestState) {
        case DeliveryRequestStates.PENDING:
            return 'Čeka potvrdu';
        case DeliveryRequestStates.CONFIRMED:
            return 'Dostava potvrđena';
        case DeliveryRequestStates.PREPARING:
            return 'Urod se priprema';
        case DeliveryRequestStates.READY:
            return 'Spremno za dostavu';
        case DeliveryRequestStates.CANCELLED:
            return 'Otkazano';
        default:
            return requestState;
    }
}

type DeliveryRunSnapshot = Pick<
    DeliveryRun,
    | 'id'
    | 'state'
    | 'currentLatitude'
    | 'currentLongitude'
    | 'currentLocationAccuracy'
    | 'currentLocationHeading'
    | 'currentLocationSpeed'
    | 'currentLocationRecordedAt'
>;

function deliveryStopSummary({
    request,
    stop,
    run,
    isCurrent,
    contacts,
    includeTracking,
}: {
    request: DeliveryRequest;
    stop?: DeliveryRunStop | null;
    run?: DeliveryRunSnapshot | null;
    isCurrent: boolean;
    contacts: DeliveryAccountContact[];
    includeTracking: boolean;
}): DeliveryStopSummary {
    const address = request.address;
    const formattedAddress = address
        ? formatDeliveryDestinationAddress(address)
        : 'Adresa nije dostupna';
    const runLocation = run ? trackingLocation(run) : null;

    return {
        id: stop?.id ?? null,
        requestId: request.id,
        sequence: stop?.sequence ?? null,
        stopState: stop?.state ?? null,
        requestState: request.state,
        statusLabel: statusLabel({
            requestState: request.state,
            stopState: stop?.state,
            isCurrent,
            runState: run?.state,
        }),
        isCurrent,
        contactName: address?.contactName ?? 'Nepoznat kontakt',
        phone: address?.phone ?? null,
        address: formattedAddress,
        addressLabel: address?.label ?? null,
        requestNotes: request.requestNotes ?? null,
        deliveryNotes: request.deliveryNotes ?? null,
        slotStartAt: iso(request.slot?.startAt),
        slotEndAt: iso(request.slot?.endAt),
        estimatedArrivalAt: iso(stop?.estimatedArrivalAt),
        estimatedTravelSeconds: stop?.estimatedTravelSeconds ?? null,
        estimatedDistanceMeters: stop?.estimatedDistanceMeters ?? null,
        arrivedAt: iso(stop?.arrivedAt),
        deliveredAt: iso(stop?.deliveredAt),
        harvest: harvestSummary(request),
        accountContacts: accountContacts(request.accountId, contacts),
        tracking: includeTracking ? runLocation : null,
        runId: run?.id ?? null,
    };
}

async function activeRunSummary(
    run: DeliveryRun,
): Promise<ActiveDeliveryRunSummary> {
    const requests = await Promise.all(
        run.stops.map((stop) => getDeliveryRequest(stop.deliveryRequestId)),
    );
    const accountIds = Array.from(
        new Set(
            requests
                .map((request) => request?.accountId)
                .filter((accountId): accountId is string => Boolean(accountId)),
        ),
    );
    const contacts = await getDeliveryAccountContacts(accountIds);
    const currentStop = run.stops.find(
        (stop) => stop.state !== DeliveryRunStopStates.DELIVERED,
    );
    const stops = run.stops.flatMap((stop, index) => {
        const request = requests[index];
        return request
            ? [
                  deliveryStopSummary({
                      request,
                      stop,
                      run,
                      isCurrent: currentStop?.id === stop.id,
                      contacts,
                      includeTracking: true,
                  }),
              ]
            : [];
    });

    return {
        id: run.id,
        state: run.state,
        startedAt: run.startedAt.toISOString(),
        completedAt: iso(run.completedAt),
        totalDistanceMeters: run.totalDistanceMeters,
        totalDurationSeconds: run.totalDurationSeconds,
        location: trackingLocation(run),
        estimatesUpdatedAt: iso(run.estimatesUpdatedAt),
        mapUrl: `/api/map/${run.id}`,
        stops,
    };
}

async function driverDashboard({
    userId,
    role,
}: {
    userId: string;
    role: string;
}): Promise<DeliveryDashboard> {
    const [user, activeRun, requests] = await Promise.all([
        getUser(userId),
        getActiveDeliveryRunForDriver(userId),
        getDeliveryRequestsWithEvents(),
    ]);
    if (!user) {
        throw new Error('Korisnik nije pronađen.');
    }

    const now = Date.now();
    const candidateRequests = requests.filter(
        (request) =>
            request.mode === 'delivery' &&
            request.address &&
            request.slot &&
            batchStates.has(request.state) &&
            request.slot.endAt.getTime() >= now &&
            request.slot.startAt.getTime() <= now + 14 * 24 * 60 * 60 * 1000,
    );
    const assigned = await getDeliveryRunStopsForRequestIds(
        candidateRequests.map((request) => request.id),
    );
    const assignedRequestIds = new Set(
        assigned.map(({ stop }) => stop.deliveryRequestId),
    );
    const batchesBySlot = new Map<
        number,
        {
            startAt: Date;
            endAt: Date;
            pickupLocationName: string | null;
            pickupAddress: string | null;
            orders: DeliveryRouteOrderSummary[];
        }
    >();
    for (const request of candidateRequests) {
        if (
            !request.slot ||
            !request.address ||
            assignedRequestIds.has(request.id)
        ) {
            continue;
        }
        const order = {
            requestId: request.id,
            contactName: request.address.contactName,
            address: formatDeliveryDestinationAddress(request.address),
            addressLabel: request.address.label,
            requestNotes: request.requestNotes ?? null,
            harvest: harvestSummary(request),
        } satisfies DeliveryRouteOrderSummary;
        const batch = batchesBySlot.get(request.slot.id);
        if (batch) {
            batch.orders.push(order);
        } else {
            const pickupLocation = request.slot.location;
            batchesBySlot.set(request.slot.id, {
                startAt: request.slot.startAt,
                endAt: request.slot.endAt,
                pickupLocationName: pickupLocation?.name ?? null,
                pickupAddress: pickupLocation
                    ? formatDeliveryDestinationAddress(pickupLocation)
                    : null,
                orders: [order],
            });
        }
    }

    return {
        kind: 'driver',
        user: {
            id: user.id,
            displayName: user.displayName ?? user.userName,
            role,
        },
        activeRun: activeRun ? await activeRunSummary(activeRun) : null,
        batches: Array.from(batchesBySlot, ([slotId, batch]) => ({
            slotId,
            startAt: batch.startAt.toISOString(),
            endAt: batch.endAt.toISOString(),
            pickupLocationName: batch.pickupLocationName,
            pickupAddress: batch.pickupAddress,
            deliveryCount: batch.orders.length,
            orders: batch.orders.sort((first, second) =>
                first.address.localeCompare(second.address, 'hr'),
            ),
        })).sort((first, second) =>
            first.startAt.localeCompare(second.startAt),
        ),
        maximumRouteDeliveries: maximumDeliveryRouteStops,
        maximumRouteWindowHours: maximumDeliveryRouteWindowHours,
        refreshedAt: new Date().toISOString(),
    };
}

async function customerDashboard({
    accountId,
    userId,
    role,
}: {
    accountId: string;
    userId: string;
    role: string;
}): Promise<DeliveryDashboard> {
    const [user, requests] = await Promise.all([
        getUser(userId),
        getDeliveryRequestsWithEvents(accountId),
    ]);
    if (!user) {
        throw new Error('Korisnik nije pronađen.');
    }

    const runRows = await getDeliveryRunStopsForRequestIds(
        requests.map((request) => request.id),
    );
    const rowsByRequestId = new Map(
        runRows.map((row) => [row.stop.deliveryRequestId, row]),
    );
    const contacts = await getDeliveryAccountContacts([accountId]);
    const activeRunIds = Array.from(
        new Set(
            runRows.flatMap(({ run }) =>
                run.state === DeliveryRunStates.ACTIVE ? [run.id] : [],
            ),
        ),
    );
    const activeRuns = await Promise.all(activeRunIds.map(getDeliveryRun));
    const currentByRunId = new Map<string, number>();
    for (const run of activeRuns) {
        const currentStop = run?.stops.find(
            (stop) => stop.state !== DeliveryRunStopStates.DELIVERED,
        );
        if (run && currentStop) {
            currentByRunId.set(run.id, currentStop.id);
        }
    }

    const deliveries = requests
        .map((request) => {
            const row = rowsByRequestId.get(request.id);
            const isCurrent = row
                ? currentByRunId.get(row.run.id) === row.stop.id
                : false;
            return deliveryStopSummary({
                request,
                stop: row?.stop,
                run: row?.run,
                isCurrent,
                contacts,
                includeTracking:
                    row?.run.state === DeliveryRunStates.ACTIVE &&
                    row.stop.state !== DeliveryRunStopStates.DELIVERED &&
                    isCurrent,
            });
        })
        .sort((first, second) => {
            const firstTime = first.slotStartAt ?? '';
            const secondTime = second.slotStartAt ?? '';
            return secondTime.localeCompare(firstTime);
        });

    return {
        kind: 'customer',
        user: {
            id: user.id,
            displayName: user.displayName ?? user.userName,
            role,
        },
        deliveries,
        refreshedAt: new Date().toISOString(),
    };
}

export async function getDeliveryDashboard({
    accountId,
    userId,
    role,
}: {
    accountId: string;
    userId: string;
    role: string;
}) {
    return driverRoles.has(role)
        ? await driverDashboard({ userId, role })
        : await customerDashboard({ accountId, userId, role });
}

async function ensureRunRequestsReady(run: DeliveryRun) {
    await Promise.all(
        run.stops.map(async (stop) => {
            const request = await getDeliveryRequest(stop.deliveryRequestId);
            if (!request) {
                throw new Error('Dostava u ruti nije pronađena.');
            }
            if (request.state === DeliveryRequestStates.READY) {
                return;
            }
            if (!batchStates.has(request.state)) {
                throw new Error('Dostava više nije dostupna za preuzimanje.');
            }

            await readyDeliveryRequest(stop.deliveryRequestId);
            await notifyDeliveryRequestEvent(
                stop.deliveryRequestId,
                'updated',
                {
                    status: DeliveryRequestStates.READY,
                    note: 'Vozač je preuzeo urod i započeo dostavu.',
                },
            );
        }),
    );
}

export async function startDeliveryRun({
    driverUserId,
    deliveryRequestIds,
}: {
    driverUserId: string;
    deliveryRequestIds: string[];
}) {
    const existingRun = await getActiveDeliveryRunForDriver(driverUserId);
    if (existingRun) {
        await ensureRunRequestsReady(existingRun);
        return existingRun;
    }
    if (
        deliveryRequestIds.length === 0 ||
        deliveryRequestIds.length > maximumDeliveryRouteStops
    ) {
        throw new DeliveryRunStartError(
            `Odaberi između 1 i ${maximumDeliveryRouteStops} dostava.`,
        );
    }

    const requests = await getDeliveryRequestsWithEvents();
    const requestsById = new Map(
        requests.map((request) => [request.id, request]),
    );
    const candidates: ListedDeliveryRequest[] = [];
    const now = new Date();
    for (const requestId of deliveryRequestIds) {
        const request = requestsById.get(requestId);
        if (
            request?.mode !== 'delivery' ||
            !request.address ||
            !request.slot ||
            !batchStates.has(request.state) ||
            request.slot.endAt < now
        ) {
            throw new DeliveryRunStartError(
                'Jedna ili više odabranih dostava više nije dostupna za preuzimanje. Osvježi popis i pokušaj ponovno.',
            );
        }
        candidates.push(request);
    }

    const existingStops = await getDeliveryRunStopsForRequestIds(
        candidates.map((request) => request.id),
    );
    if (existingStops.length > 0) {
        throw new DeliveryRunStartError(
            'Jedna ili više odabranih dostava već je dodijeljena drugoj ruti. Osvježi popis i odaberi ponovno.',
        );
    }

    const plan = await planDeliveryRoute({
        candidates: candidates.map((request) => {
            if (!request.address || !request.slot) {
                throw new DeliveryRunStartError(
                    'Odabrana dostava nema valjanu adresu ili termin.',
                );
            }
            return {
                deliveryRequestId: request.id,
                formattedAddress: formatDeliveryDestinationAddress(
                    request.address,
                ),
                windowStartAt: request.slot.startAt,
                windowEndAt: request.slot.endAt,
            };
        }),
    });
    const primarySlot = candidates
        .map((request) => request.slot)
        .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot))
        .sort(
            (first, second) =>
                first.startAt.getTime() - second.startAt.getTime(),
        )[0];
    if (!primarySlot) {
        throw new DeliveryRunStartError(
            'Odabrane dostave nemaju valjani termin.',
        );
    }
    const run = await createDeliveryRun({
        driverUserId,
        timeSlotId: primarySlot.id,
        encodedPolyline: plan.encodedPolyline,
        totalDistanceMeters: plan.totalDistanceMeters,
        totalDurationSeconds: plan.totalDurationSeconds,
        stops: plan.stops,
    });

    await ensureRunRequestsReady(run);

    return run;
}

export async function arriveAtDeliveryStop({
    driverUserId,
    runId,
    stopId,
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
}) {
    return await markDeliveryRunStopArrived({
        driverUserId,
        runId,
        stopId,
    });
}

export async function deliverDeliveryStop({
    driverUserId,
    runId,
    stopId,
    notes,
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
    notes?: string;
}) {
    const stop = await getDeliveryRunStop(stopId);
    if (
        !stop ||
        stop.run.id !== runId ||
        stop.run.driverUserId !== driverUserId ||
        stop.run.state !== DeliveryRunStates.ACTIVE
    ) {
        throw new Error('Aktivna dostava nije pronađena.');
    }

    await fulfillDeliveryRunStop({
        driverUserId,
        runId,
        stopId,
        deliveryNotes: notes,
    });
    await notifyDeliveryRequestEvent(stop.deliveryRequestId, 'updated', {
        status: DeliveryRequestStates.FULFILLED,
        note: notes,
    });
}

export async function recordDriverLocation({
    driverUserId,
    runId,
    latitude,
    longitude,
    accuracy,
    heading,
    speed,
    recordedAt,
}: {
    driverUserId: string;
    runId: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
    recordedAt: Date;
}) {
    await updateDeliveryRunLocation({
        runId,
        driverUserId,
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
        recordedAt,
    });

    const run = await getDeliveryRun(runId);
    if (!run || run.driverUserId !== driverUserId) {
        return;
    }
    const estimatesAreFresh =
        run.estimatesUpdatedAt &&
        Date.now() - run.estimatesUpdatedAt.getTime() < etaRefreshIntervalMs;
    if (estimatesAreFresh) {
        return;
    }

    const remainingStops = run.stops.filter(
        (stop) => stop.state !== DeliveryRunStopStates.DELIVERED,
    );
    const requests = await Promise.all(
        remainingStops.map((stop) =>
            getDeliveryRequest(stop.deliveryRequestId),
        ),
    );
    const requestsById = new Map(
        requests.flatMap((request) =>
            request ? [[request.id, request] as const] : [],
        ),
    );
    const plan = await recalculateDeliveryRoute({
        origin: { latitude, longitude },
        stops: remainingStops.map((stop) => {
            const request = requestsById.get(stop.deliveryRequestId);
            return {
                deliveryRequestId: stop.deliveryRequestId,
                formattedAddress: stop.formattedAddress,
                latitude: stop.latitude,
                longitude: stop.longitude,
                windowStartAt: request?.slot?.startAt,
                windowEndAt: request?.slot?.endAt,
            };
        }),
    });
    await updateDeliveryRunEstimates({
        runId,
        encodedPolyline: plan.encodedPolyline,
        totalDistanceMeters: plan.totalDistanceMeters,
        totalDurationSeconds: plan.totalDurationSeconds,
        estimates: plan.stops,
    });
}

export function deliveryRunStartErrorMessage(error: unknown) {
    return error instanceof DeliveryRunStartError ||
        error instanceof DeliveryRoutePlanningError
        ? error.message
        : null;
}
