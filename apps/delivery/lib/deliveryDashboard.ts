import { notifyDeliveryRequestEvent } from '@gredice/notifications';
import {
    createDeliveryRun,
    DeliveryRequestStates,
    DeliveryRunStates,
    DeliveryRunStopStates,
    fulfillDeliveryRunStops,
    getActiveDeliveryRunForDriver,
    getDeliveryAccountContacts,
    getDeliveryRequest,
    getDeliveryRequestsWithEvents,
    getDeliveryRun,
    getDeliveryRunStopsForRequestIds,
    getUser,
    markDeliveryRunStopsArrived,
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
    DeliveryStopDeliverySummary,
    DeliveryStopSummary,
    DeliveryTrackingLocation,
} from './deliveryDashboardTypes';
import {
    DeliveryRoutePlanningError,
    formatDeliveryDestinationAddress,
    formatDeliveryGeocodingAddress,
    maximumDeliveryRouteStops,
    maximumDeliveryRouteWindowHours,
    planDeliveryRoute,
    recalculateDeliveryRoute,
} from './deliveryRouting';
import {
    buildDeliveryStopKey,
    groupByDeliveryStop,
} from './deliveryStopGrouping';

type ListedDeliveryRequest = Awaited<
    ReturnType<typeof getDeliveryRequestsWithEvents>
>[number];
type DeliveryRequest =
    | ListedDeliveryRequest
    | NonNullable<Awaited<ReturnType<typeof getDeliveryRequest>>>;
export type DeliveryRun = NonNullable<
    Awaited<ReturnType<typeof getDeliveryRun>>
>;
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

function deliveryRequestStopKey(request: DeliveryRequest) {
    if (!request.slot || !request.address) {
        return `request:${request.id}`;
    }

    return buildDeliveryStopKey(
        request.slot.id,
        formatDeliveryDestinationAddress(request.address),
    );
}

export type ResolvedDeliveryRunStop = {
    stop: DeliveryRunStop;
    request: DeliveryRequest | undefined;
    stopKey: string;
};

export type ResolvedDeliveryRunStopGroup = {
    stopKey: string;
    items: ResolvedDeliveryRunStop[];
};

export async function resolveDeliveryRunStopGroups(
    run: DeliveryRun,
): Promise<ResolvedDeliveryRunStopGroup[]> {
    const requests = await Promise.all(
        run.stops.map((stop) => getDeliveryRequest(stop.deliveryRequestId)),
    );

    return groupByDeliveryStop(
        run.stops.map((stop, index) => {
            const request = requests[index];
            return {
                stop,
                request,
                stopKey: request
                    ? deliveryRequestStopKey(request)
                    : `request:${stop.deliveryRequestId}`,
            };
        }),
    );
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

function pickupStatusLabel(requestState: string) {
    if (requestState === DeliveryRequestStates.READY) {
        return 'Spremno za preuzimanje';
    }
    if (requestState === DeliveryRequestStates.PREPARING) {
        return 'U pripremi na lokaciji preuzimanja';
    }
    return 'Još nije spremno za preuzimanje';
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

function deliverySummaryItem(
    request: DeliveryRequest,
    contacts: DeliveryAccountContact[],
): DeliveryStopDeliverySummary {
    const address = request.address;
    return {
        requestId: request.id,
        requestState: request.state,
        contactName: address?.contactName ?? 'Nepoznat kontakt',
        phone: address?.phone ?? null,
        addressLabel: address?.label ?? null,
        requestNotes: request.requestNotes ?? null,
        deliveryNotes: request.deliveryNotes ?? null,
        harvest: harvestSummary(request),
        accountContacts: accountContacts(request.accountId, contacts),
    };
}

function deliveryStopSummary({
    items,
    run,
    isCurrent,
    contacts,
    includeTracking,
    sequence,
}: {
    items: { request: DeliveryRequest; stop?: DeliveryRunStop | null }[];
    run?: DeliveryRunSnapshot | null;
    isCurrent: boolean;
    contacts: DeliveryAccountContact[];
    includeTracking: boolean;
    sequence?: number | null;
}): DeliveryStopSummary {
    const primary = items[0];
    if (!primary) {
        throw new Error('Dostavna stanica nema nijednu dostavu.');
    }
    const request = primary.request;
    const stops = items.flatMap((item) => (item.stop ? [item.stop] : []));
    const representativeStop =
        stops.find((stop) => stop.state !== DeliveryRunStopStates.DELIVERED) ??
        stops[0];
    const stopState =
        stops.length > 0 &&
        stops.every((stop) => stop.state === DeliveryRunStopStates.DELIVERED)
            ? DeliveryRunStopStates.DELIVERED
            : stops.some((stop) => stop.state === DeliveryRunStopStates.ARRIVED)
              ? DeliveryRunStopStates.ARRIVED
              : (representativeStop?.state ?? null);
    const address = request.address;
    const formattedAddress = address
        ? formatDeliveryDestinationAddress(address)
        : 'Adresa nije dostupna';
    const runLocation = run ? trackingLocation(run) : null;

    return {
        id: representativeStop?.id ?? null,
        requestId: request.id,
        sequence: sequence ?? representativeStop?.sequence ?? null,
        stopState,
        requestState: request.state,
        statusLabel: statusLabel({
            requestState: request.state,
            stopState,
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
        estimatedArrivalAt: iso(representativeStop?.estimatedArrivalAt),
        estimatedTravelSeconds:
            representativeStop?.estimatedTravelSeconds ?? null,
        estimatedDistanceMeters:
            representativeStop?.estimatedDistanceMeters ?? null,
        arrivedAt: iso(stops.find((stop) => stop.arrivedAt)?.arrivedAt),
        deliveredAt: iso(stops.find((stop) => stop.deliveredAt)?.deliveredAt),
        harvest: harvestSummary(request),
        accountContacts: accountContacts(request.accountId, contacts),
        tracking: includeTracking ? runLocation : null,
        runId: run?.id ?? null,
        deliveryCount: items.length,
        deliveries: items.map((item) =>
            deliverySummaryItem(item.request, contacts),
        ),
    };
}

async function activeRunSummary(
    run: DeliveryRun,
): Promise<ActiveDeliveryRunSummary> {
    const groups = await resolveDeliveryRunStopGroups(run);
    const requests = groups.flatMap((group) =>
        group.items.flatMap((item) => (item.request ? [item.request] : [])),
    );
    const accountIds = Array.from(
        new Set(
            requests
                .map((request) => request?.accountId)
                .filter((accountId): accountId is string => Boolean(accountId)),
        ),
    );
    const contacts = await getDeliveryAccountContacts(accountIds);
    const currentGroup = groups.find((group) =>
        group.items.some(
            ({ stop }) => stop.state !== DeliveryRunStopStates.DELIVERED,
        ),
    );
    const stops: DeliveryStopSummary[] = [];
    for (const group of groups) {
        const items = group.items.flatMap(({ request, stop }) =>
            request ? [{ request, stop }] : [],
        );
        if (items.length === 0) continue;
        stops.push(
            deliveryStopSummary({
                items,
                run,
                isCurrent: currentGroup?.stopKey === group.stopKey,
                contacts,
                includeTracking: true,
                sequence: stops.length + 1,
            }),
        );
    }

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
        deliveryCount: stops.reduce(
            (count, stop) => count + stop.deliveryCount,
            0,
        ),
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
            stopKey: deliveryRequestStopKey(request),
            readyForPickup: request.state === DeliveryRequestStates.READY,
            pickupStatusLabel: pickupStatusLabel(request.state),
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
            stopCount: new Set(batch.orders.map((order) => order.stopKey)).size,
            orders: batch.orders.sort((first, second) =>
                first.address.localeCompare(second.address, 'hr'),
            ),
        })).sort((first, second) =>
            first.startAt.localeCompare(second.startAt),
        ),
        maximumRouteStops: maximumDeliveryRouteStops,
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
    const currentStopIdsByRunId = new Map<string, Set<number>>();
    for (const run of activeRuns) {
        if (!run) continue;
        const groups = await resolveDeliveryRunStopGroups(run);
        const currentGroup = groups.find((group) =>
            group.items.some(
                ({ stop }) => stop.state !== DeliveryRunStopStates.DELIVERED,
            ),
        );
        if (currentGroup) {
            currentStopIdsByRunId.set(
                run.id,
                new Set(currentGroup.items.map(({ stop }) => stop.id)),
            );
        }
    }

    const deliveries = requests
        .map((request) => {
            const row = rowsByRequestId.get(request.id);
            const isCurrent = row
                ? (currentStopIdsByRunId.get(row.run.id)?.has(row.stop.id) ??
                  false)
                : false;
            return deliveryStopSummary({
                items: [{ request, stop: row?.stop }],
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
    if (deliveryRequestIds.length === 0) {
        throw new DeliveryRunStartError('Odaberi barem jednu dostavu.');
    }

    const requests = await getDeliveryRequestsWithEvents();
    const requestsById = new Map(
        requests.map((request) => [request.id, request]),
    );
    const selectedStopKeys = new Set<string>();
    const now = new Date();
    for (const requestId of deliveryRequestIds) {
        const request = requestsById.get(requestId);
        if (
            request?.mode !== 'delivery' ||
            !request.address ||
            !request.slot ||
            request.state !== DeliveryRequestStates.READY ||
            request.slot.endAt < now
        ) {
            throw new DeliveryRunStartError(
                'Jedna ili više odabranih dostava još nije spremna za preuzimanje. Osvježi popis i pokušaj ponovno.',
            );
        }
        selectedStopKeys.add(deliveryRequestStopKey(request));
    }
    if (selectedStopKeys.size > maximumDeliveryRouteStops) {
        throw new DeliveryRunStartError(
            `Jedna ruta može sadržavati najviše ${maximumDeliveryRouteStops} fizičkih stanica. Dostave na istoj adresi u istom terminu računaju se kao jedna stanica.`,
        );
    }

    const candidates = requests.filter(
        (request) =>
            request.mode === 'delivery' &&
            request.address &&
            request.slot &&
            request.state === DeliveryRequestStates.READY &&
            request.slot.endAt >= now &&
            selectedStopKeys.has(deliveryRequestStopKey(request)),
    );

    const existingStops = await getDeliveryRunStopsForRequestIds(
        candidates.map((request) => request.id),
    );
    if (existingStops.length > 0) {
        throw new DeliveryRunStartError(
            'Jedna ili više odabranih dostava već je dodijeljena drugoj ruti. Osvježi popis i odaberi ponovno.',
        );
    }

    const candidateGroups = groupByDeliveryStop(
        candidates.map((request) => ({
            request,
            stopKey: deliveryRequestStopKey(request),
        })),
    );
    const candidateGroupsByRepresentativeId = new Map<
        string,
        (typeof candidateGroups)[number]
    >();
    const plan = await planDeliveryRoute({
        candidates: candidateGroups.map((group) => {
            const representative = group.items[0]?.request;
            if (!representative?.address || !representative.slot) {
                throw new DeliveryRunStartError(
                    'Odabrana dostava nema valjanu adresu ili termin.',
                );
            }
            candidateGroupsByRepresentativeId.set(representative.id, group);
            return {
                deliveryRequestId: representative.id,
                formattedAddress: formatDeliveryDestinationAddress(
                    representative.address,
                ),
                geocodingAddress: formatDeliveryGeocodingAddress(
                    representative.address,
                ),
                windowStartAt: representative.slot.startAt,
                windowEndAt: representative.slot.endAt,
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
    let storedSequence = 0;
    const storedStops = plan.stops.flatMap((plannedStop) => {
        const group = candidateGroupsByRepresentativeId.get(
            plannedStop.deliveryRequestId,
        );
        if (!group) {
            throw new DeliveryRunStartError(
                'Planirana dostavna stanica nije pronađena.',
            );
        }

        return group.items.map(({ request }) => {
            storedSequence += 1;
            return {
                deliveryRequestId: request.id,
                sequence: storedSequence,
                latitude: plannedStop.latitude,
                longitude: plannedStop.longitude,
                formattedAddress: plannedStop.formattedAddress,
                estimatedArrivalAt: plannedStop.estimatedArrivalAt,
                estimatedTravelSeconds: plannedStop.estimatedTravelSeconds,
                estimatedDistanceMeters: plannedStop.estimatedDistanceMeters,
            };
        });
    });
    const run = await createDeliveryRun({
        driverUserId,
        timeSlotId: primarySlot.id,
        encodedPolyline: plan.encodedPolyline,
        totalDistanceMeters: plan.totalDistanceMeters,
        totalDurationSeconds: plan.totalDurationSeconds,
        stops: storedStops,
    });

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
    const group = await getOwnedDeliveryRunStopGroup({
        driverUserId,
        runId,
        stopId,
    });
    return await markDeliveryRunStopsArrived({
        driverUserId,
        runId,
        stopIds: group.items.map(({ stop }) => stop.id),
    });
}

async function getOwnedDeliveryRunStopGroup({
    driverUserId,
    runId,
    stopId,
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
}) {
    const run = await getDeliveryRun(runId);
    if (!run || run.driverUserId !== driverUserId) {
        throw new Error('Aktivna dostava nije pronađena.');
    }
    const groups = await resolveDeliveryRunStopGroups(run);
    const targetGroup = groups.find((group) =>
        group.items.some(({ stop }) => stop.id === stopId),
    );
    if (!targetGroup) {
        throw new Error('Aktivna dostava nije pronađena.');
    }
    const targetIsDelivered = targetGroup.items.every(
        ({ stop }) => stop.state === DeliveryRunStopStates.DELIVERED,
    );
    if (targetIsDelivered) {
        return targetGroup;
    }
    if (run.state !== DeliveryRunStates.ACTIVE) {
        throw new Error('Aktivna dostava nije pronađena.');
    }
    const currentGroup = groups.find((group) =>
        group.items.some(
            ({ stop }) => stop.state !== DeliveryRunStopStates.DELIVERED,
        ),
    );
    if (currentGroup?.stopKey !== targetGroup.stopKey) {
        throw new Error('Dostave se moraju završiti redoslijedom rute.');
    }
    if (targetGroup.items.some(({ request }) => !request)) {
        throw new Error('Dostava u ruti nije pronađena.');
    }

    return targetGroup;
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
    const group = await getOwnedDeliveryRunStopGroup({
        driverUserId,
        runId,
        stopId,
    });
    const requestIds = await fulfillDeliveryRunStops({
        driverUserId,
        runId,
        stopIds: group.items.map(({ stop }) => stop.id),
        deliveryNotes: notes,
    });
    await Promise.all(
        requestIds.map((requestId) =>
            notifyDeliveryRequestEvent(requestId, 'updated', {
                status: DeliveryRequestStates.FULFILLED,
                note: notes,
            }),
        ),
    );
}

export async function accountCanTrackDeliveryRun({
    accountId,
    runId,
}: {
    accountId: string;
    runId: string;
}) {
    const run = await getDeliveryRun(runId);
    if (!run || run.state !== DeliveryRunStates.ACTIVE) {
        return false;
    }
    const groups = await resolveDeliveryRunStopGroups(run);
    return accountCanTrackCurrentDeliveryGroup({
        accountId,
        runState: run.state,
        groups,
    });
}

export function accountCanTrackCurrentDeliveryGroup({
    accountId,
    runState,
    groups,
}: {
    accountId: string;
    runState: string;
    groups: ReadonlyArray<{
        items: ReadonlyArray<{
            stop: { state: string };
            request?: { accountId?: string | null };
        }>;
    }>;
}) {
    if (runState !== DeliveryRunStates.ACTIVE) {
        return false;
    }
    const currentGroup = groups.find((group) =>
        group.items.some(
            ({ stop }) => stop.state !== DeliveryRunStopStates.DELIVERED,
        ),
    );

    return Boolean(
        currentGroup?.items.some(
            ({ request }) => request?.accountId === accountId,
        ),
    );
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

    const groups = await resolveDeliveryRunStopGroups(run);
    const remainingGroups = groups.flatMap((group) => {
        const items = group.items.filter(
            ({ stop }) => stop.state !== DeliveryRunStopStates.DELIVERED,
        );
        return items.length > 0 ? [{ ...group, items }] : [];
    });
    const groupsByRepresentativeId = new Map<
        string,
        (typeof remainingGroups)[number]
    >();
    const routeStops = remainingGroups.flatMap((group) => {
        const representative = group.items.find(({ request }) => request);
        if (!representative) return [];
        groupsByRepresentativeId.set(
            representative.stop.deliveryRequestId,
            group,
        );
        return [
            {
                deliveryRequestId: representative.stop.deliveryRequestId,
                formattedAddress: representative.stop.formattedAddress,
                latitude: representative.stop.latitude,
                longitude: representative.stop.longitude,
                windowStartAt: representative.request?.slot?.startAt,
                windowEndAt: representative.request?.slot?.endAt,
            },
        ];
    });
    const plan = await recalculateDeliveryRoute({
        origin: { latitude, longitude },
        stops: routeStops,
    });
    const estimates = plan.stops.flatMap((estimate) => {
        const group = groupsByRepresentativeId.get(estimate.deliveryRequestId);
        return (
            group?.items.map(({ stop }) => ({
                deliveryRequestId: stop.deliveryRequestId,
                estimatedArrivalAt: estimate.estimatedArrivalAt,
                estimatedTravelSeconds: estimate.estimatedTravelSeconds,
                estimatedDistanceMeters: estimate.estimatedDistanceMeters,
            })) ?? []
        );
    });
    await updateDeliveryRunEstimates({
        runId,
        encodedPolyline: plan.encodedPolyline,
        totalDistanceMeters: plan.totalDistanceMeters,
        totalDurationSeconds: plan.totalDurationSeconds,
        estimates,
    });
}

export function deliveryRunStartErrorMessage(error: unknown) {
    return error instanceof DeliveryRunStartError ||
        error instanceof DeliveryRoutePlanningError
        ? error.message
        : null;
}

export function deliveryRunStartErrorLogContext(error: unknown) {
    if (error instanceof DeliveryRoutePlanningError) {
        return {
            errorName: error.name,
            errorCode: error.code,
            deliveryRequestId: error.deliveryRequestId,
        };
    }
    if (error instanceof DeliveryRunStartError) {
        return {
            errorName: error.name,
            errorCode: 'invalid-selection',
        };
    }
    return { error };
}
