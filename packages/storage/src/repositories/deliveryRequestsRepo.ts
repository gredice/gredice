import { randomUUID } from 'node:crypto';
import type { OperationData, PlantSortData } from '@gredice/directory-types';
import {
    and,
    asc,
    desc,
    eq,
    gte,
    inArray,
    isNull,
    lte,
    notExists,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import 'server-only';
import { AUTO_CLOSE_WINDOW_MS } from '../helpers/timeSlotAutomation';
import {
    accounts,
    accountUsers,
    DeliveryRequestStates,
    deliveryAddresses,
    deliveryRequests,
    events,
    operations,
    pickupLocations,
    type SelectDeliveryRequest,
    TimeSlotStatuses,
    timeSlots,
    users,
} from '../schema';
import { storage } from '../storage';
import { getDeliveryAddress } from './deliveryAddressesRepo';
import { getEntitiesFormatted, getEntityFormatted } from './entitiesRepo';
import {
    createEvent,
    getEvents,
    knownEvents,
    knownEventTypes,
} from './eventsRepo';
import { getRaisedBed, getRaisedBedFieldsWithEvents } from './gardensRepo';
import { getOperationById, getOperationsByIds } from './operationsRepo';
import { getPickupLocation } from './pickupLocationsRepo';
import { closeTimeSlot, getTimeSlot } from './timeSlotsRepo';

type DbEvent = Awaited<ReturnType<typeof getEvents>>[number];

// TODO: Should use types from union of payloads for delivery events
interface DeliveryEventData {
    slotId?: number;
    newSlotId?: number;
    addressId?: number;
    locationId?: number;
    mode?: 'delivery' | 'pickup';
    requestNotes?: string;
    deliveryNotes?: string;
    cancelReason?: string;
    accountId?: string;
}

function parseDeliveryEventData(value: unknown): DeliveryEventData {
    if (!value || typeof value !== 'object') {
        return {};
    }

    const record = value as Record<string, unknown>;
    const data: DeliveryEventData = {};

    if (typeof record.slotId === 'number') {
        data.slotId = record.slotId;
    }
    if (typeof record.newSlotId === 'number') {
        data.newSlotId = record.newSlotId;
    }
    if (typeof record.addressId === 'number') {
        data.addressId = record.addressId;
    }
    if (typeof record.locationId === 'number') {
        data.locationId = record.locationId;
    }
    if (record.mode === 'delivery' || record.mode === 'pickup') {
        data.mode = record.mode;
    }
    if (typeof record.requestNotes === 'string') {
        data.requestNotes = record.requestNotes;
    }
    if (typeof record.deliveryNotes === 'string') {
        data.deliveryNotes = record.deliveryNotes;
    }
    if (typeof record.cancelReason === 'string') {
        data.cancelReason = record.cancelReason;
    }
    if (typeof record.accountId === 'string') {
        data.accountId = record.accountId;
    }

    return data;
}

const deliveryRequestEventTypes = [
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
];

interface DeliveryRequestStateProjection {
    state: string;
    slotId?: number;
    addressId?: number;
    locationId?: number;
    mode?: 'delivery' | 'pickup';
    cancelReason?: string;
    requestNotes?: string;
    deliveryNotes?: string;
    accountId?: string;
    surveySent: boolean;
}

function reconstructDeliveryRequestState(
    requestCreatedAt: Date,
    requestEvents: DbEvent[],
): DeliveryRequestStateProjection {
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

    const asNumber = (value: unknown): number | undefined => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string' && value !== '' && /^-?\d+$/.test(value))
            return Number(value);
        return undefined;
    };

    const asString = (value: unknown): string | undefined =>
        typeof value === 'string' ? value : undefined;

    const asMode = (value: unknown): 'delivery' | 'pickup' | undefined =>
        value === 'delivery' || value === 'pickup'
            ? (value as 'delivery' | 'pickup')
            : undefined;

    for (const event of requestEvents) {
        if (event.createdAt.getTime() < requestCreatedAt.getTime() - 5000) {
            continue;
        }

        const data = parseDeliveryEventData(event.data);

        if (event.type === knownEventTypes.delivery.requestCreated) {
            slotId = asNumber(data.slotId);
            addressId = asNumber(data.addressId);
            locationId = asNumber(data.locationId);
            mode = asMode(data.mode);
            requestNotes = asString(data.requestNotes);
            state = DeliveryRequestStates.PENDING;
            accountId = asString(data.accountId);
        } else if (
            event.type === knownEventTypes.delivery.requestAddressChanged
        ) {
            addressId = asNumber(data.addressId);
            locationId = asNumber(data.locationId);
            mode = asMode(data.mode);
            requestNotes = asString(data.requestNotes);
        } else if (event.type === knownEventTypes.delivery.requestConfirmed) {
            state = DeliveryRequestStates.CONFIRMED;
        } else if (event.type === knownEventTypes.delivery.requestPreparing) {
            state = DeliveryRequestStates.PREPARING;
        } else if (event.type === knownEventTypes.delivery.requestReady) {
            state = DeliveryRequestStates.READY;
        } else if (event.type === knownEventTypes.delivery.requestFulfilled) {
            state = DeliveryRequestStates.FULFILLED;
            deliveryNotes = data.deliveryNotes ?? deliveryNotes;
        } else if (event.type === knownEventTypes.delivery.requestSlotChanged) {
            slotId = asNumber(data.newSlotId);
        } else if (event.type === knownEventTypes.delivery.userCancelled) {
            state = DeliveryRequestStates.CANCELLED;
        } else if (event.type === knownEventTypes.delivery.requestCancelled) {
            state = DeliveryRequestStates.CANCELLED;
            cancelReason = asString(data.cancelReason);
        } else if (event.type === knownEventTypes.delivery.requestSurveySent) {
            surveySent = true;
        }
    }

    return {
        state,
        slotId,
        addressId,
        locationId,
        mode,
        cancelReason,
        requestNotes,
        deliveryNotes,
        accountId,
        surveySent,
    };
}

function groupEventsByAggregateId(requestEvents: DbEvent[]) {
    const eventsByAggregateId = new Map<string, DbEvent[]>();

    for (const event of requestEvents) {
        const aggregateEvents = eventsByAggregateId.get(event.aggregateId);
        if (aggregateEvents) {
            aggregateEvents.push(event);
        } else {
            eventsByAggregateId.set(event.aggregateId, [event]);
        }
    }

    return eventsByAggregateId;
}

async function getDeliveryRequestWhereConditions(
    accountId?: string,
    fromDate?: Date,
    toDate?: Date,
) {
    const whereConditions = [];

    if (accountId) {
        const operationRows = await storage().query.operations.findMany({
            columns: {
                id: true,
            },
            where: and(
                eq(operations.accountId, accountId),
                eq(operations.isDeleted, false),
            ),
        });

        const operationIds = operationRows.map((operation) => operation.id);
        if (operationIds.length === 0) {
            return null;
        }

        whereConditions.push(
            inArray(deliveryRequests.operationId, operationIds),
        );
    }

    if (fromDate) {
        whereConditions.push(gte(deliveryRequests.createdAt, fromDate));
    }

    if (toDate) {
        whereConditions.push(lte(deliveryRequests.createdAt, toDate));
    }

    return whereConditions;
}

async function reconstructDeliveryRequestRows<
    TRequest extends {
        id: string;
        operationId: number;
        createdAt: Date;
        updatedAt: Date;
    },
>(requests: TRequest[]) {
    if (requests.length === 0) {
        return [];
    }

    const requestEvents = await getEvents(
        deliveryRequestEventTypes,
        requests.map((request) => request.id),
        0,
        100000,
    );
    const eventsByAggregateId = groupEventsByAggregateId(requestEvents);
    const reconstructedRows = requests.map((request) => {
        const projection = reconstructDeliveryRequestState(
            request.createdAt,
            eventsByAggregateId.get(request.id) ?? [],
        );

        return {
            request,
            projection,
        };
    });

    const slotIds = Array.from(
        new Set(
            reconstructedRows
                .map((row) => row.projection.slotId)
                .filter((id): id is number => id !== undefined),
        ),
    );
    const addressIds = Array.from(
        new Set(
            reconstructedRows
                .map((row) => row.projection.addressId)
                .filter((id): id is number => id !== undefined),
        ),
    );
    const locationIds = Array.from(
        new Set(
            reconstructedRows
                .map((row) => row.projection.locationId)
                .filter((id): id is number => id !== undefined),
        ),
    );

    const [slots, addresses, locations] = await Promise.all([
        slotIds.length > 0
            ? storage().query.timeSlots.findMany({
                  where: inArray(timeSlots.id, slotIds),
                  with: {
                      location: true,
                  },
              })
            : Promise.resolve([]),
        addressIds.length > 0
            ? storage().query.deliveryAddresses.findMany({
                  where: and(
                      inArray(deliveryAddresses.id, addressIds),
                      isNull(deliveryAddresses.deletedAt),
                  ),
              })
            : Promise.resolve([]),
        locationIds.length > 0
            ? storage().query.pickupLocations.findMany({
                  where: inArray(pickupLocations.id, locationIds),
              })
            : Promise.resolve([]),
    ]);

    const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
    const addressesById = new Map(
        addresses.map((address) => [address.id, address]),
    );
    const locationsById = new Map(
        locations.map((location) => [location.id, location]),
    );

    return reconstructedRows.map((row) => ({
        ...row,
        slot: row.projection.slotId
            ? slotsById.get(row.projection.slotId)
            : undefined,
        address: row.projection.addressId
            ? addressesById.get(row.projection.addressId)
            : undefined,
        location: row.projection.locationId
            ? locationsById.get(row.projection.locationId)
            : undefined,
    }));
}

function filterDeliveryRequestRows<
    TRow extends {
        request: {
            createdAt: Date;
        };
        projection: {
            state: string;
        };
        slot?: {
            id: number;
        };
    },
>(
    rows: TRow[],
    filters: {
        state?: string;
        slotId?: number;
        fromDate?: Date;
        toDate?: Date;
    },
) {
    return rows.filter((row) => {
        if (filters.state && row.projection.state !== filters.state) {
            return false;
        }

        if (filters.slotId && row.slot?.id !== filters.slotId) {
            return false;
        }

        if (filters.fromDate && row.request.createdAt < filters.fromDate) {
            return false;
        }

        if (filters.toDate && row.request.createdAt > filters.toDate) {
            return false;
        }

        return true;
    });
}

// Business state projection interface
export type DeliveryRequestWithEvents = Awaited<
    ReturnType<typeof reconstructDeliveryRequestFromEvents>
>;

// Helper function to reconstruct business state from events
async function reconstructDeliveryRequestFromEvents(
    request: SelectDeliveryRequest,
    events: DbEvent[],
) {
    const {
        state,
        slotId,
        addressId,
        locationId,
        mode,
        cancelReason,
        requestNotes,
        deliveryNotes,
        accountId,
        surveySent,
    } = reconstructDeliveryRequestState(request.createdAt, events);

    // Fetch slot, address, location, and operation in parallel
    const [slot, address, location, operation] = await Promise.all([
        slotId ? getTimeSlot(slotId) : undefined,
        addressId && accountId
            ? getDeliveryAddress(addressId, accountId)
            : undefined,
        locationId ? getPickupLocation(locationId) : undefined,
        getOperationById(request.operationId),
    ]);

    // Fetch operation entity, raised bed, and plantSort fields in parallel
    const [operationEntity, raisedBed, fields] = await Promise.all([
        operation?.entityId
            ? getEntityFormatted<OperationData>(operation.entityId).catch(
                  (error) => {
                      console.error('Failed to fetch operation entity:', error);
                      return null;
                  },
              )
            : null,
        operation?.raisedBedId
            ? getRaisedBed(operation.raisedBedId).catch((error) => {
                  console.error('Failed to fetch raised bed:', error);
                  return null;
              })
            : null,
        operation?.raisedBedId && operation?.raisedBedFieldId
            ? getRaisedBedFieldsWithEvents(operation.raisedBedId).catch(
                  (error) => {
                      console.error(
                          'Failed to fetch raised bed fields:',
                          error,
                      );
                      return [];
                  },
              )
            : [],
    ]);

    // Get plantSort info if we have fields
    let plantSort: PlantSortData | null = null;
    if (fields.length > 0 && operation?.raisedBedFieldId) {
        const field = fields.find((f) => f.id === operation.raisedBedFieldId);
        if (field?.plantSortId) {
            try {
                const plantSortEntity = await getEntityFormatted<PlantSortData>(
                    field.plantSortId,
                );
                if (plantSortEntity) {
                    plantSort = plantSortEntity;
                }
            } catch (error) {
                console.error('Failed to fetch plantSort info:', error);
            }
        }
    }

    // Get the field for position index info
    const raisedBedField =
        fields.length > 0 && operation?.raisedBedFieldId
            ? fields.find((f) => f.id === operation.raisedBedFieldId)
            : null;

    return {
        id: request.id,
        operationId: request.operationId,
        operation,
        operationData: operationEntity,
        raisedBed,
        raisedBedField,
        plantSort,
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

export async function getDeliveryRequestsSummary(
    accountId?: string,
    state?: string,
    slotId?: number,
    fromDate?: Date,
    toDate?: Date,
) {
    const whereConditions = await getDeliveryRequestWhereConditions(
        accountId,
        fromDate,
        toDate,
    );
    if (whereConditions === null) {
        return [];
    }

    const requests = await storage().query.deliveryRequests.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
        orderBy: [desc(deliveryRequests.createdAt)],
    });
    const reconstructedRows = await reconstructDeliveryRequestRows(requests);
    const filteredRows = filterDeliveryRequestRows(reconstructedRows, {
        state,
        slotId,
        fromDate,
        toDate,
    });

    return filteredRows.map(
        ({ request, projection, slot, address, location }) => ({
            id: request.id,
            operationId: request.operationId,
            state: projection.state,
            slot,
            address,
            location,
            mode: projection.mode,
            cancelReason: projection.cancelReason,
            requestNotes: projection.requestNotes,
            deliveryNotes: projection.deliveryNotes,
            surveySent: projection.surveySent,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            accountId: projection.accountId,
        }),
    );
}

// Get delivery requests with business state reconstructed from events
export async function getDeliveryRequestsWithEvents(
    accountId?: string,
    state?: string,
    slotId?: number,
    fromDate?: Date,
    toDate?: Date,
) {
    const whereConditions = await getDeliveryRequestWhereConditions(
        accountId,
        fromDate,
        toDate,
    );
    if (whereConditions === null) {
        return [];
    }

    const requests = await storage().query.deliveryRequests.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
        orderBy: [desc(deliveryRequests.createdAt)],
        with: {
            operation: {
                with: {
                    raisedBed: true,
                    raisedBedField: true,
                },
            },
        },
    });
    const reconstructedRows = await reconstructDeliveryRequestRows(requests);
    const filteredRows = filterDeliveryRequestRows(reconstructedRows, {
        state,
        slotId,
        fromDate,
        toDate,
    });

    if (filteredRows.length === 0) {
        return [];
    }

    const filteredOperationIds = filteredRows.map(
        (row) => row.request.operationId,
    );
    const uniqueRaisedBedIds = Array.from(
        new Set(
            filteredRows
                .map((row) => row.request.operation?.raisedBedId)
                .filter((id): id is number => id !== null && id !== undefined),
        ),
    );

    const [operationsWithState, operationEntities, fields] = await Promise.all([
        getOperationsByIds(filteredOperationIds),
        getEntitiesFormatted<OperationData>('operation').catch((error) => {
            console.error('Failed to fetch operation entities:', error);
            return null;
        }),
        uniqueRaisedBedIds.length > 0
            ? Promise.all(
                  uniqueRaisedBedIds.map(async (raisedBedId) => {
                      try {
                          return await getRaisedBedFieldsWithEvents(
                              raisedBedId,
                          );
                      } catch (error) {
                          console.error(
                              'Failed to fetch raised bed fields:',
                              error,
                          );
                          return [];
                      }
                  }),
              ).then((fieldGroups) => fieldGroups.flat())
            : Promise.resolve([]),
    ]);

    const operationsById = new Map(
        operationsWithState.map((operation) => [operation.id, operation]),
    );
    const operationEntitiesById = new Map(
        (operationEntities ?? []).map((operationEntity) => [
            operationEntity.id,
            operationEntity,
        ]),
    );
    const fieldsById = new Map(fields.map((field) => [field.id, field]));
    const plantSortIds = Array.from(
        new Set(
            filteredRows
                .map((row) => row.request.operation?.raisedBedFieldId)
                .filter((id): id is number => id !== null && id !== undefined)
                .map((id) => fieldsById.get(id)?.plantSortId)
                .filter(
                    (plantSortId): plantSortId is number =>
                        plantSortId !== undefined,
                ),
        ),
    );
    const plantSorts = plantSortIds.length
        ? await getEntitiesFormatted<PlantSortData>('plantSort').catch(
              (error) => {
                  console.error('Failed to fetch plant sorts:', error);
                  return null;
              },
          )
        : null;
    const plantSortsById = new Map(
        (plantSorts ?? []).map((plantSort) => [plantSort.id, plantSort]),
    );

    return filteredRows.map(
        ({ request, projection, slot, address, location }) => {
            const rawOperation = request.operation;
            const operation =
                operationsById.get(request.operationId) ??
                rawOperation ??
                undefined;
            const raisedBedFieldId = rawOperation?.raisedBedFieldId;
            const raisedBedFieldWithEvents =
                typeof raisedBedFieldId === 'number'
                    ? fieldsById.get(raisedBedFieldId)
                    : undefined;
            const raisedBedField =
                typeof raisedBedFieldId === 'number'
                    ? (raisedBedFieldWithEvents ?? rawOperation?.raisedBedField)
                    : rawOperation?.raisedBedField;
            const plantSort =
                typeof raisedBedFieldWithEvents?.plantSortId === 'number'
                    ? (plantSortsById.get(
                          raisedBedFieldWithEvents.plantSortId,
                      ) ?? null)
                    : null;

            return {
                id: request.id,
                operationId: request.operationId,
                operation,
                operationData: rawOperation?.entityId
                    ? (operationEntitiesById.get(rawOperation.entityId) ?? null)
                    : null,
                raisedBed: rawOperation?.raisedBed ?? null,
                raisedBedField: raisedBedField ?? null,
                plantSort,
                state: projection.state,
                slot,
                address,
                location,
                mode: projection.mode,
                cancelReason: projection.cancelReason,
                requestNotes: projection.requestNotes,
                deliveryNotes: projection.deliveryNotes,
                surveySent: projection.surveySent,
                createdAt: request.createdAt,
                updatedAt: request.updatedAt,
                accountId: projection.accountId,
            };
        },
    );
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
            operation: {
                with: {
                    raisedBed: true,
                    raisedBedField: true,
                    entity: {
                        with: {
                            attributes: {
                                with: {
                                    attributeDefinition: true,
                                },
                            },
                        },
                    },
                },
            },
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

export async function getPendingDeliveryReadyEmailRequestIds({
    readyBefore,
    limit = 200,
}: {
    readyBefore: Date;
    limit?: number;
}): Promise<string[]> {
    const processedEvents = alias(
        events,
        'delivery_ready_email_processed_events',
    );
    const pendingReadyEvents = await storage()
        .selectDistinct({
            requestId: events.aggregateId,
        })
        .from(events)
        .where(
            and(
                eq(events.type, knownEventTypes.delivery.requestReady),
                lte(events.createdAt, readyBefore),
                notExists(
                    storage()
                        .select({ id: processedEvents.id })
                        .from(processedEvents)
                        .where(
                            and(
                                eq(
                                    processedEvents.type,
                                    knownEventTypes.delivery
                                        .requestReadyEmailProcessed,
                                ),
                                eq(
                                    processedEvents.aggregateId,
                                    events.aggregateId,
                                ),
                            ),
                        ),
                ),
            ),
        )
        .limit(limit);

    return pendingReadyEvents.map((event) => event.requestId);
}

export async function markDeliveryReadyEmailsProcessed({
    requestIds,
    recipients,
    batchRequestIds = requestIds,
    skipped,
}: {
    requestIds: string[];
    recipients: string[];
    batchRequestIds?: string[];
    skipped?: boolean;
}): Promise<void> {
    const uniqueRequestIds = Array.from(new Set(requestIds));
    if (uniqueRequestIds.length === 0) {
        return;
    }

    await Promise.all(
        uniqueRequestIds.map((requestId) =>
            createEvent(
                knownEvents.delivery.requestReadyEmailProcessedV1(requestId, {
                    sentTo: recipients,
                    batchRequestIds,
                    skipped,
                }),
            ),
        ),
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
    accountTimeZone: string;
    operationId: number;
    fulfilledAt: Date;
    userEmails: { userId: string; email: string }[];
    monthKey: string;
    monthAlreadySent: boolean;
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

    const fulfilledEventMap = new Map(
        fulfilledEvents.map((event) => [event.aggregateId, event] as const),
    );

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

    const requests = await storage().query.deliveryRequests.findMany({
        where: inArray(deliveryRequests.id, requestIds),
        with: {
            operation: true,
        },
    });

    const requestsById = new Map(
        requests.map((request) => [request.id, request] as const),
    );

    const getMonthKey = (date: Date) => {
        const monthDate = new Date(date);
        const year = monthDate.getFullYear();
        const month = String(monthDate.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    };

    const sentMonthKeys = new Set<string>();

    for (const event of surveySentEvents) {
        const request = requestsById.get(event.aggregateId);
        const fulfilledEvent = fulfilledEventMap.get(event.aggregateId);

        const accountId = request?.operation?.accountId;
        if (!accountId || !fulfilledEvent) {
            continue;
        }

        const monthKey = getMonthKey(fulfilledEvent.createdAt);
        sentMonthKeys.add(`${accountId}:${monthKey}`);
    }

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

    // Fetch account timezones
    const accountTimeZones = accountIds.length
        ? await storage()
              .select({
                  id: accounts.id,
                  timeZone: accounts.timeZone,
              })
              .from(accounts)
              .where(inArray(accounts.id, accountIds))
        : [];

    const accountTimeZoneMap = new Map(
        accountTimeZones.map((a) => [a.id, a.timeZone] as const),
    );

    return pendingEvents
        .map((event) => {
            const request = requestsById.get(event.aggregateId);

            const accountId = request?.operation?.accountId;
            const operationId = request?.operationId;

            if (!accountId || !operationId) {
                return null;
            }

            const monthKey = getMonthKey(event.createdAt);
            const monthAlreadySent = sentMonthKeys.has(
                `${accountId}:${monthKey}`,
            );

            const userEmails = accountUserRows
                .filter((row) => row.accountId === accountId)
                .map((row) => ({
                    userId: row.userId,
                    email: row.email ?? '',
                }))
                .filter((row) => row.email.length > 0);

            const accountTimeZone =
                accountTimeZoneMap.get(accountId) ?? 'Europe/Paris';

            return {
                requestId: event.aggregateId,
                accountId,
                accountTimeZone,
                operationId,
                fulfilledAt: event.createdAt,
                userEmails,
                monthKey,
                monthAlreadySent,
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
