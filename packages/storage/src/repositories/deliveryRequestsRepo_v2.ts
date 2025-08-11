import 'server-only';
import { and, eq, desc } from "drizzle-orm";
import { storage } from "../storage";
import {
    deliveryRequests,
    operations,
    timeSlots,
    deliveryAddresses,
    pickupLocations,
    DeliveryRequestStates,
    CancelReasonCodes
} from "../schema";
import { createEvent, getEvents } from "./eventsRepo";
import { randomUUID } from 'node:crypto';

// Event types for delivery requests
const knownEventTypes = {
    deliveryRequest: {
        create: 'delivery_request.create',
        cancel: 'delivery_request.cancel',
        statusUpdate: 'delivery_request.status_update',
    }
};

// Business state projection interface
export interface DeliveryRequestWithEvents {
    id: string;
    operationId: number;
    state: string;
    slotId?: number;
    addressId?: number;
    locationId?: number;
    mode?: 'delivery' | 'pickup';
    cancelReason?: string;
    requestNotes?: string;
    deliveryNotes?: string;
    createdAt: Date;
    updatedAt: Date;

    // Related entities (populated separately if needed)
    operation?: any;
    slot?: any;
    address?: any;
    location?: any;
}

// Helper function to reconstruct business state from events
function reconstructDeliveryRequestFromEvents(request: any, events: any[]): DeliveryRequestWithEvents {
    let state: string = DeliveryRequestStates.PENDING;
    let slotId: number | undefined = undefined;
    let addressId: number | undefined = undefined;
    let locationId: number | undefined = undefined;
    let mode: 'delivery' | 'pickup' | undefined = undefined;
    let cancelReason: string | undefined = undefined;
    let requestNotes: string | undefined = undefined;
    let deliveryNotes: string | undefined = undefined;

    for (const event of events) {
        const data = event.data as Record<string, any> | undefined;

        if (event.type === knownEventTypes.deliveryRequest.create) {
            slotId = data?.slotId;
            addressId = data?.addressId;
            locationId = data?.locationId;
            mode = data?.mode;
            requestNotes = data?.requestNotes;
            state = DeliveryRequestStates.PENDING;
        }
        else if (event.type === knownEventTypes.deliveryRequest.cancel) {
            state = DeliveryRequestStates.CANCELLED;
            cancelReason = data?.cancelReason;
        }
        else if (event.type === knownEventTypes.deliveryRequest.statusUpdate) {
            state = data?.status ?? state;
            if (data?.deliveryNotes) {
                deliveryNotes = data.deliveryNotes;
            }
        }
    }

    return {
        id: request.id,
        operationId: request.operationId,
        state,
        slotId,
        addressId,
        locationId,
        mode,
        cancelReason,
        requestNotes,
        deliveryNotes,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        operation: request.operation
    };
}

// Get delivery requests with business state reconstructed from events
export async function getDeliveryRequestsWithEvents(
    accountId?: string,
    state?: string,
    slotId?: number,
    fromDate?: Date,
    toDate?: Date
): Promise<DeliveryRequestWithEvents[]> {
    // First get the projection records
    const requests = await storage().query.deliveryRequests.findMany({
        where: eq(deliveryRequests.isDeleted, false),
        orderBy: [desc(deliveryRequests.createdAt)],
        with: {
            operation: true
        }
    });

    if (requests.length === 0) return [];

    // Get all events for these requests
    const aggregateIds = requests.map(r => r.id);
    const allEvents = await getEvents([
        knownEventTypes.deliveryRequest.create,
        knownEventTypes.deliveryRequest.cancel,
        knownEventTypes.deliveryRequest.statusUpdate,
    ], aggregateIds, 0, 100000);

    // Reconstruct business state for each request
    const reconstructedRequests = requests.map((request) => {
        const events = allEvents.filter(event =>
            event.aggregateId === request.id &&
            request.createdAt <= new Date(event.createdAt.getTime() + 5000) // 5s offset
        );

        return reconstructDeliveryRequestFromEvents(request, events);
    });

    // Apply filters on reconstructed state
    let filteredRequests = reconstructedRequests;

    if (state) {
        filteredRequests = filteredRequests.filter(r => r.state === state);
    }

    if (slotId) {
        filteredRequests = filteredRequests.filter(r => r.slotId === slotId);
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
    toDate?: Date
): Promise<DeliveryRequestWithEvents[]> {
    return getDeliveryRequestsWithEvents(accountId, state, slotId, fromDate, toDate);
}

// Get a specific delivery request by ID with events
export async function getDeliveryRequest(requestId: string): Promise<DeliveryRequestWithEvents | undefined> {
    const request = await storage().query.deliveryRequests.findFirst({
        where: and(
            eq(deliveryRequests.id, requestId),
            eq(deliveryRequests.isDeleted, false)
        ),
        with: {
            operation: true
        }
    });

    if (!request) return undefined;

    // Get events for this request
    const events = await getEvents([
        knownEventTypes.deliveryRequest.create,
        knownEventTypes.deliveryRequest.cancel,
        knownEventTypes.deliveryRequest.statusUpdate,
    ], [request.id], 0, 100000);

    return reconstructDeliveryRequestFromEvents(request, events);
}

// Get delivery requests by operation ID
export async function getDeliveryRequestByOperation(operationId: number): Promise<DeliveryRequestWithEvents | undefined> {
    const request = await storage().query.deliveryRequests.findFirst({
        where: and(
            eq(deliveryRequests.operationId, operationId),
            eq(deliveryRequests.isDeleted, false)
        ),
        with: {
            operation: true
        }
    });

    if (!request) return undefined;

    // Get events and reconstruct state
    const events = await getEvents([
        knownEventTypes.deliveryRequest.create,
        knownEventTypes.deliveryRequest.cancel,
        knownEventTypes.deliveryRequest.statusUpdate,
    ], [request.id], 0, 100000);

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
}): Promise<string> {
    const requestId = randomUUID();

    // Validate slot is available and not in the past
    const slot = await storage().query.timeSlots.findFirst({
        where: eq(timeSlots.id, data.slotId)
    });

    if (!slot) {
        throw new Error('Time slot not found');
    }

    if (slot.status !== 'scheduled') {
        throw new Error('Time slot is not available for booking');
    }

    if (slot.startAt < new Date()) {
        throw new Error('Cannot book slots in the past');
    }

    // Validate mode-specific requirements
    if (data.mode === 'delivery' && !data.addressId) {
        throw new Error('Address ID is required for delivery mode');
    }

    if (data.mode === 'pickup' && !data.locationId) {
        throw new Error('Location ID is required for pickup mode');
    }

    // Check if operation already has a delivery request
    const existingRequest = await getDeliveryRequestByOperation(data.operationId);
    if (existingRequest) {
        throw new Error('Operation already has a delivery request');
    }

    // Create the projection record first (minimal schema)
    await storage().insert(deliveryRequests).values({
        id: requestId,
        operationId: data.operationId,
    });

    // Create the event with all business data
    await createEvent({
        type: knownEventTypes.deliveryRequest.create,
        version: 1,
        aggregateId: requestId,
        data: {
            operationId: data.operationId,
            slotId: data.slotId,
            mode: data.mode,
            addressId: data.addressId,
            locationId: data.locationId,
            requestNotes: data.notes
        }
    });

    return requestId;
}

// Cancel a delivery request
export async function cancelDeliveryRequest(
    requestId: string,
    actorType: 'user' | 'admin' | 'system',
    reasonCode: string,
    note?: string,
    actorId?: string
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
    if (actorType === 'user' && request.slotId) {
        const slot = await storage().query.timeSlots.findFirst({
            where: eq(timeSlots.id, request.slotId)
        });

        if (slot) {
            const cutoffHours = 12; // Default cutoff
            const cutoffTime = new Date(slot.startAt.getTime() - cutoffHours * 60 * 60 * 1000);

            if (new Date() >= cutoffTime) {
                throw new Error('Cannot cancel - cutoff time has passed');
            }
        }
    }

    // Create the cancellation event
    await createEvent({
        type: knownEventTypes.deliveryRequest.cancel,
        version: 1,
        aggregateId: requestId,
        data: {
            actorType,
            cancelReason: reasonCode,
            note,
            cancelledBy: actorId
        }
    });
}

// Fulfill a delivery request
export async function fulfillDeliveryRequest(requestId: string, deliveryNotes?: string): Promise<void> {
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
    await createEvent({
        type: knownEventTypes.deliveryRequest.statusUpdate,
        version: 1,
        aggregateId: requestId,
        data: {
            status: DeliveryRequestStates.FULFILLED,
            deliveryNotes
        }
    });
}

// Update delivery request status (generic status update function)
export async function updateDeliveryRequestStatus(
    requestId: string,
    status: string,
    notes?: string
): Promise<void> {
    await createEvent({
        type: knownEventTypes.deliveryRequest.statusUpdate,
        version: 1,
        aggregateId: requestId,
        data: {
            status,
            deliveryNotes: notes
        }
    });
}
