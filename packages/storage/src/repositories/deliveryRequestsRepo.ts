import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import { AUTO_CLOSE_WINDOW_MS } from '../helpers/timeSlotAutomation';
import {
    accountUsers,
    DeliveryRequestStates,
    deliveryRequests,
    events,
    type SelectDeliveryRequest,
    TimeSlotStatuses,
    timeSlots,
    users,
} from '../schema';
import { storage } from '../storage';
import { getDeliveryAddress } from './deliveryAddressesRepo';
import {
    createEvent,
    type Event as DbEvent,
    getEvents,
    knownEvents,
    knownEventTypes,
} from './eventsRepo';
import { getPickupLocation } from './pickupLocationsRepo';
import { closeTimeSlot, getTimeSlot } from './timeSlotsRepo';

// Business state projection interface
export type DeliveryRequestWithEvents = ReturnType<
    typeof reconstructDeliveryRequestFromEvents
>;

// Helper function to reconstruct business state from events
async function reconstructDeliveryRequestFromEvents(
    request: SelectDeliveryRequest,
    events: DbEvent[],
) {
    let state: string = DeliveryRequestStates.PENDING;
    let slotId: number | undefined;
    let addressId: number | undefined;
    let locationId: number | undefined;
    let mode: 'delivery' | 'pickup' | undefined;
    let cancelReason: string | undefined;
    let requestNotes: string | undefined;
    let deliveryNotes: string | undefined;
    let accountId: string | undefined;
    let surveySent = false;

    for (const event of events) {
        const data = event.data as Record<string, any> | undefined;

        if (event.type === knownEventTypes.delivery.requestCreated) {
            slotId = data?.slotId;
            addressId = data?.addressId;
            locationId = data?.locationId;
            mode = data?.mode;
            requestNotes = data?.requestNotes;
            state = DeliveryRequestStates.PENDING;
            accountId = data?.accountId;
        } else if (
            event.type === knownEventTypes.delivery.requestAddressChanged
        ) {
            addressId = data?.addressId;
            locationId = data?.locationId;
            mode = data?.mode;
            requestNotes = data?.requestNotes;
        } else if (event.type === knownEventTypes.delivery.requestConfirmed) {
            state = DeliveryRequestStates.CONFIRMED;
        } else if (event.type === knownEventTypes.delivery.requestPreparing) {
            state = DeliveryRequestStates.PREPARING;
        } else if (event.type === knownEventTypes.delivery.requestReady) {
            state = DeliveryRequestStates.READY;
        } else if (event.type === knownEventTypes.delivery.requestFulfilled) {
            state = DeliveryRequestStates.FULFILLED;
        } else if (event.type === knownEventTypes.delivery.requestSlotChanged) {
            slotId = data?.newSlotId;
        } else if (event.type === knownEventTypes.delivery.userCancelled) {
            state = DeliveryRequestStates.CANCELLED;
        } else if (event.type === knownEventTypes.delivery.requestCancelled) {
            state = DeliveryRequestStates.CANCELLED;
            cancelReason = data?.cancelReason;
        } else if (event.type === knownEventTypes.delivery.requestSurveySent) {
            surveySent = true;
        }
    }

    const slot = slotId ? await getTimeSlot(slotId) : undefined;
    const address =
        addressId && accountId
            ? await getDeliveryAddress(addressId, accountId)
            : undefined;
    const location = locationId
        ? await getPickupLocation(locationId)
        : undefined;

    return {
        id: request.id,
        operationId: request.operationId,
        state,
        slot,
        address,
        location,
        mode,
        cancelReason,
        requestNotes,
        deliveryNotes,
        surveySent,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        accountId,
    };
}

// Get delivery requests with business state reconstructed from events
export async function getDeliveryRequestsWithEvents(
    accountId?: string,
    state?: string,
    slotId?: number,
    fromDate?: Date,
    toDate?: Date,
) {
    // First get the projection records
    const requests = await storage().query.deliveryRequests.findMany({
        orderBy: [desc(deliveryRequests.createdAt)],
        with: {
            operation: true,
        },
    });

    if (requests.length === 0) return [];

    // Get all events for these requests
    const aggregateIds = requests.map((r) => r.id);
    const allEvents = await getEvents(
        [
            knownEventTypes.delivery.requestCreated,
            knownEventTypes.delivery.requestCancelled,
            knownEventTypes.delivery.requestAddressChanged,
            knownEventTypes.delivery.requestConfirmed,
            knownEventTypes.delivery.requestPreparing,
            knownEventTypes.delivery.requestReady,
            knownEventTypes.delivery.requestFulfilled,
            knownEventTypes.delivery.requestSurveySent,
            knownEventTypes.delivery.requestSlotChanged,
            knownEventTypes.delivery.userCancelled,
        ],
        aggregateIds,
        0,
        100000,
    );

    // Reconstruct business state for each request
    const reconstructedRequests = await Promise.all(
        requests.map((request) => {
            const events = allEvents.filter(
                (event) =>
                    event.aggregateId === request.id &&
                    request.createdAt <=
                        new Date(event.createdAt.getTime() + 5000), // 5s offset
            );

            return reconstructDeliveryRequestFromEvents(request, events);
        }),
    );

    // Apply filters on reconstructed state
    let filteredRequests = reconstructedRequests;

    if (accountId) {
        filteredRequests = filteredRequests.filter(
            (r) => r.accountId === accountId,
        );
    }

    if (state) {
        filteredRequests = filteredRequests.filter((r) => r.state === state);
    }

    if (slotId) {
        filteredRequests = filteredRequests.filter(
            (r) => r.slot?.id === slotId,
        );
    }

    if (fromDate) {
        filteredRequests = filteredRequests.filter(
            (r) => r.createdAt >= fromDate,
        );
    }

    if (toDate) {
        filteredRequests = filteredRequests.filter(
            (r) => r.createdAt <= toDate,
        );
    }

    // Note: Date filtering would require joining with slots
    // This is a simplified implementation

    return filteredRequests;
}

// Get delivery requests for an account (legacy function signature)
export function getDeliveryRequests(
    accountId?: string,
    state?: string,
    slotId?: number,
    fromDate?: Date,
    toDate?: Date,
) {
    return getDeliveryRequestsWithEvents(
        accountId,
        state,
        slotId,
        fromDate,
        toDate,
    );
}

// Get a specific delivery request by ID with events
export async function getDeliveryRequest(
    requestId: string,
): Promise<DeliveryRequestWithEvents | undefined> {
    const request = await storage().query.deliveryRequests.findFirst({
        where: and(eq(deliveryRequests.id, requestId)),
        with: {
            operation: true,
        },
    });

    if (!request) return undefined;

    // Get events for this request
    const events = await getEvents(
        [
            knownEventTypes.delivery.requestCreated,
            knownEventTypes.delivery.requestCancelled,
            knownEventTypes.delivery.requestAddressChanged,
            knownEventTypes.delivery.requestConfirmed,
            knownEventTypes.delivery.requestPreparing,
            knownEventTypes.delivery.requestReady,
            knownEventTypes.delivery.requestFulfilled,
            knownEventTypes.delivery.requestSurveySent,
            knownEventTypes.delivery.requestSlotChanged,
            knownEventTypes.delivery.userCancelled,
        ],
        [request.id],
        0,
        100000,
    );

    return reconstructDeliveryRequestFromEvents(request, events);
}

// Get delivery requests by operation ID
export async function getDeliveryRequestByOperation(
    operationId: number,
): Promise<DeliveryRequestWithEvents | undefined> {
    const request = await storage().query.deliveryRequests.findFirst({
        where: and(eq(deliveryRequests.operationId, operationId)),
        with: {
            operation: true,
        },
    });

    if (!request) return undefined;

    // Get events and reconstruct state
    const events = await getEvents(
        [
            knownEventTypes.delivery.requestCreated,
            knownEventTypes.delivery.requestCancelled,
            knownEventTypes.delivery.requestAddressChanged,
            knownEventTypes.delivery.requestConfirmed,
            knownEventTypes.delivery.requestPreparing,
            knownEventTypes.delivery.requestReady,
            knownEventTypes.delivery.requestFulfilled,
            knownEventTypes.delivery.requestSurveySent,
            knownEventTypes.delivery.requestSlotChanged,
            knownEventTypes.delivery.userCancelled,
        ],
        [request.id],
        0,
        100000,
    );

    return reconstructDeliveryRequestFromEvents(request, events);
}

// Create a new delivery request with event sourcing
export async function createDeliveryRequest(data: {
    operationId: number;
    slotId: number;
    mode: 'delivery' | 'pickup';
    addressId?: number;
    locationId?: number;
    notes?: string;
    accountId: string;
}): Promise<string> {
    const requestId = randomUUID();

    // Validate slot is available and not in the past
    const slot = await storage().query.timeSlots.findFirst({
        where: eq(timeSlots.id, data.slotId),
    });

    if (!slot) {
        throw new Error('Time slot not found');
    }

    if (slot.status !== TimeSlotStatuses.SCHEDULED) {
        throw new Error('Time slot is not available for booking');
    }

    const now = new Date();

    if (slot.startAt < now) {
        throw new Error('Cannot book slots in the past');
    }

    if (
        slot.type === 'delivery' &&
        slot.startAt.getTime() - now.getTime() < AUTO_CLOSE_WINDOW_MS
    ) {
        await closeTimeSlot(slot.id);
        throw new Error('Time slot is not available for booking');
    }

    // Validate mode-specific requirements
    if (data.mode === 'delivery' && !data.addressId) {
        throw new Error('Address ID is required for delivery mode');
    }

    if (data.mode === 'pickup' && !data.locationId) {
        throw new Error('Location ID is required for pickup mode');
    }

    // Check if operation already has a delivery request
    const existingRequest = await getDeliveryRequestByOperation(
        data.operationId,
    );
    if (existingRequest) {
        throw new Error('Operation already has a delivery request');
    }

    // Create the projection record first (minimal schema)
    await storage().insert(deliveryRequests).values({
        id: requestId,
        operationId: data.operationId,
    });

    // Create the event with all business data

    await createEvent(
        knownEvents.delivery.requestCreatedV1(requestId, {
            operationId: data.operationId,
            slotId: data.slotId,
            mode: data.mode,
            addressId: data.addressId,
            locationId: data.locationId,
            notes: data.notes,
            accountId: data.accountId,
        }),
    );

    return requestId;
}

// Change the time slot for an existing delivery request
export async function changeDeliveryRequestSlot(
    requestId: string,
    newSlotId: number,
): Promise<void> {
    const request = await getDeliveryRequest(requestId);

    if (!request) {
        throw new Error('Delivery request not found');
    }

    if (!request.slot?.id) {
        throw new Error('Delivery request has no slot to change');
    }

    // If slot is the same, no-op
    if (request.slot.id === newSlotId) {
        return;
    }

    // Validate new slot
    const slot = await storage().query.timeSlots.findFirst({
        where: eq(timeSlots.id, newSlotId),
    });

    if (!slot) {
        throw new Error('Time slot not found');
    }

    if (slot.status === TimeSlotStatuses.ARCHIVED) {
        throw new Error('Time slot is archived and cannot be used');
    }

    if (slot.status !== TimeSlotStatuses.SCHEDULED) {
        throw new Error('Time slot is not available for booking');
    }

    const now = new Date();

    if (
        slot.type === 'delivery' &&
        slot.startAt.getTime() - now.getTime() < AUTO_CLOSE_WINDOW_MS
    ) {
        await closeTimeSlot(slot.id);
        throw new Error('Time slot is not available for booking');
    }

    await createEvent(
        knownEvents.delivery.requestSlotChangedV1(requestId, {
            previousSlotId: request.slot.id,
            newSlotId,
        }),
    );
}

// Cancel a delivery request
export async function cancelDeliveryRequest(
    requestId: string,
    actorType: 'user' | 'admin' | 'system',
    cancelReason: string,
    note?: string,
    actorId?: string,
): Promise<void> {
    const request = await getDeliveryRequest(requestId);

    if (!request) {
        throw new Error('Delivery request not found');
    }

    if (request.state === DeliveryRequestStates.CANCELLED) {
        // Idempotent - already cancelled
        return;
    }

    if (request.state === DeliveryRequestStates.FULFILLED) {
        throw new Error('Cannot cancel a fulfilled delivery request');
    }

    // Check cutoff time for user cancellations
    if (actorType === 'user' && request.slot?.id) {
        const cutoffHours = 12; // Default cutoff
        const cutoffTime = new Date(
            request.slot.startAt.getTime() - cutoffHours * 60 * 60 * 1000,
        );

        if (new Date() >= cutoffTime) {
            throw new Error('Cannot cancel - cutoff time has passed');
        }
    }

    // Create the cancellation event
    await createEvent(
        knownEvents.delivery.requestCancelledV1(requestId, {
            actorType,
            cancelReason,
            note,
            cancelledBy: actorId,
        }),
    );
}

// Confirm a delivery request
export async function confirmDeliveryRequest(requestId: string): Promise<void> {
    const request = await getDeliveryRequest(requestId);

    if (!request) {
        throw new Error('Delivery request not found');
    }

    if (request.state === DeliveryRequestStates.CONFIRMED) {
        // Idempotent - already confirmed
        return;
    }

    // Create the confirmation event
    await createEvent(
        knownEvents.delivery.requestConfirmedV1(requestId, {
            status: DeliveryRequestStates.CONFIRMED,
        }),
    );
}

// Prepare a delivery request
export async function prepareDeliveryRequest(requestId: string): Promise<void> {
    const request = await getDeliveryRequest(requestId);

    if (!request) {
        throw new Error('Delivery request not found');
    }

    if (request.state === DeliveryRequestStates.PREPARING) {
        // Idempotent - already preparing
        return;
    }

    // Create the preparation event
    await createEvent(
        knownEvents.delivery.requestPreparingV1(requestId, {
            status: DeliveryRequestStates.PREPARING,
        }),
    );
}

// Ready a delivery request
export async function readyDeliveryRequest(requestId: string): Promise<void> {
    const request = await getDeliveryRequest(requestId);

    if (!request) {
        throw new Error('Delivery request not found');
    }

    if (request.state === DeliveryRequestStates.READY) {
        // Idempotent - already ready
        return;
    }

    // Create the ready event
    await createEvent(
        knownEvents.delivery.requestReadyV1(requestId, {
            status: DeliveryRequestStates.READY,
        }),
    );
}

// Fulfill a delivery request
export async function fulfillDeliveryRequest(
    requestId: string,
    deliveryNotes?: string,
): Promise<void> {
    const request = await getDeliveryRequest(requestId);

    if (!request) {
        throw new Error('Delivery request not found');
    }

    if (request.state === DeliveryRequestStates.FULFILLED) {
        // Idempotent - already fulfilled
        return;
    }

    if (request.state === DeliveryRequestStates.CANCELLED) {
        throw new Error('Cannot fulfill a cancelled delivery request');
    }

    // Create the fulfillment event
    await createEvent(
        knownEvents.delivery.requestFulfilledV1(requestId, {
            status: DeliveryRequestStates.FULFILLED,
            deliveryNotes,
        }),
    );
}

export interface DeliverySurveyCandidate {
    requestId: string;
    accountId: string;
    operationId: number;
    fulfilledAt: Date;
    userEmails: { userId: string; email: string }[];
}

export async function getDeliverySurveyCandidates({
    since,
}: {
    since: Date;
}): Promise<DeliverySurveyCandidate[]> {
    const fulfilledEvents = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.delivery.requestFulfilled),
            gte(events.createdAt, since),
        ),
        orderBy: [asc(events.createdAt)],
    });

    if (fulfilledEvents.length === 0) {
        return [];
    }

    const requestIds = fulfilledEvents.map((event) => event.aggregateId);

    const surveySentEvents = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.delivery.requestSurveySent),
            inArray(events.aggregateId, requestIds),
        ),
    });

    const surveySentIds = new Set(
        surveySentEvents.map((event) => event.aggregateId),
    );

    const pendingEvents = fulfilledEvents.filter(
        (event) => !surveySentIds.has(event.aggregateId),
    );

    if (pendingEvents.length === 0) {
        return [];
    }

    const pendingRequestIds = pendingEvents.map((event) => event.aggregateId);

    const requests = await storage().query.deliveryRequests.findMany({
        where: inArray(deliveryRequests.id, pendingRequestIds),
        with: {
            operation: true,
        },
    });

    const accountIds = Array.from(
        new Set(
            requests
                .map((request) => request.operation?.accountId)
                .filter((id): id is string => Boolean(id)),
        ),
    );

    const accountUserRows = accountIds.length
        ? await storage()
              .select({
                  accountId: accountUsers.accountId,
                  userId: accountUsers.userId,
                  email: users.userName,
              })
              .from(accountUsers)
              .innerJoin(users, eq(accountUsers.userId, users.id))
              .where(inArray(accountUsers.accountId, accountIds))
        : [];

    return pendingEvents
        .map((event) => {
            const request = requests.find(
                (item) => item.id === event.aggregateId,
            );

            const accountId = request?.operation?.accountId;
            const operationId = request?.operationId;

            if (!accountId || !operationId) {
                return null;
            }

            const userEmails = accountUserRows
                .filter((row) => row.accountId === accountId)
                .map((row) => ({
                    userId: row.userId,
                    email: row.email ?? '',
                }))
                .filter((row) => row.email.length > 0);

            return {
                requestId: event.aggregateId,
                accountId,
                operationId,
                fulfilledAt: event.createdAt,
                userEmails,
            } satisfies DeliverySurveyCandidate;
        })
        .filter(
            (candidate): candidate is DeliverySurveyCandidate =>
                candidate !== null,
        );
}

export async function markDeliverySurveySent(
    requestId: string,
    sentTo: string[],
) {
    await createEvent(
        knownEvents.delivery.requestSurveySentV1(requestId, {
            sentTo,
        }),
    );
}
