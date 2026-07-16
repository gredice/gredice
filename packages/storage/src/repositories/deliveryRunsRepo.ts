import {
    createHash,
    randomBytes,
    randomUUID,
    timingSafeEqual,
} from 'node:crypto';
import {
    and,
    asc,
    desc,
    eq,
    inArray,
    isNotNull,
    isNull,
    lt,
    lte,
    notInArray,
    or,
    sql,
} from 'drizzle-orm';
import 'server-only';
import {
    accountUsers,
    DeliveryRequestStates,
    type DeliveryRunEstimateSource,
    DeliveryRunEstimateSources,
    type DeliveryRunExceptionOperationStoredResult,
    type DeliveryRunExceptionOutcome,
    DeliveryRunExceptionOutcomes,
    type DeliveryRunExceptionReason,
    DeliveryRunExceptionReasons,
    type DeliveryRunHandoffItemSnapshot,
    type DeliveryRunHandoffItemState,
    DeliveryRunHandoffItemStates,
    DeliveryRunHandoffOperationKinds,
    type DeliveryRunHandoffOperationStoredResult,
    type DeliveryRunHandoffSkipReason,
    DeliveryRunHandoffSkipReasons,
    type DeliveryRunHandoffSnapshot,
    type DeliveryRunManifestItemState,
    DeliveryRunManifestItemStates,
    DeliveryRunManifestStates,
    DeliveryRunPickupOperationKinds,
    type DeliveryRunPickupOperationStoredResult,
    type DeliveryRunPreparationPlanPayload,
    type DeliveryRunPreparationPlanPayloadV1,
    type DeliveryRunPreparationPlanPayloadV2,
    type DeliveryRunPreparationPlanPayloadV3,
    DeliveryRunStates,
    type DeliveryRunStopOperationKind,
    DeliveryRunStopOperationKinds,
    type DeliveryRunStopOperationStoredResult,
    type DeliveryRunStopState,
    DeliveryRunStopStates,
    deliveryAddresses,
    deliveryRequests,
    deliveryRunExceptionOperations,
    deliveryRunHandoffOperations,
    deliveryRunPickupNodes,
    deliveryRunPickupOperations,
    deliveryRunPreparations,
    deliveryRunSlots,
    deliveryRunStopOperations,
    deliveryRunStops,
    deliveryRuns,
    events,
    harvestTraceLinks,
    isDeliveryRunStopActionable,
    isDeliveryRunStopTerminal,
    operations,
    type PreparedDeliveryRunEstimateSource,
    pickupLocations,
    timeSlots,
    users,
} from '../schema';
import { storage } from '../storage';
import {
    acquireDeliveryDispatchLock,
    withDeliveryDispatchTransaction,
} from './deliveryDispatchRepo';
import {
    DeliveryRequestFulfillmentError,
    deliveryDispatchEventTypes,
    fulfillDeliveryRequest,
    getDeliveryRequest,
    getDeliveryRequestDispatchSnapshots,
} from './deliveryRequestsRepo';
import { createEvent, knownEvents } from './eventsRepo';
import { normalizeHarvestTraceToken } from './harvestTraceLinksRepo';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = StorageClient | TransactionClient;
export type DeliveryRunTransactionClient = TransactionClient;

export type CreateDeliveryRunStopInput = {
    deliveryRequestId: string;
    sequence: number;
    latitude: number;
    longitude: number;
    formattedAddress: string;
    estimatedArrivalAt?: Date;
    estimatedTravelSeconds?: number;
    estimatedDistanceMeters?: number;
    itinerarySequence?: number;
    serviceDurationSeconds?: number;
    timeSlotId?: number;
    stopKey?: string;
    requestDispatchEventId?: number;
    deliveryAddressId?: number;
    deliveryAddressUpdatedAt?: Date;
};

export type CreateDeliveryRunPickupNodeInput = {
    pickupLocationId: number;
    sequence: number;
    name: string;
    street1: string;
    street2?: string | null;
    city: string;
    postalCode: string;
    countryCode: string;
    sourceUpdatedAt: Date;
    latitude?: number;
    longitude?: number;
    itinerarySequence?: number;
    estimatedArrivalAt?: Date;
    incomingTravelSeconds?: number;
    incomingDistanceMeters?: number;
    serviceDurationSeconds?: number;
};

export type CreateDeliveryRunSlotInput = {
    timeSlotId: number;
    pickupLocationId: number;
    sequence: number;
    manifestId?: string;
    windowStartAt: Date;
    windowEndAt: Date;
    sourceUpdatedAt: Date;
};

export type CreateDeliveryRunInput = {
    driverUserId: string;
    timeSlotId: number;
    encodedPolyline?: string;
    totalDistanceMeters?: number;
    totalDurationSeconds?: number;
    routePlanVersion?: number;
    estimateSource?: DeliveryRunEstimateSource;
    pickupNodes?: CreateDeliveryRunPickupNodeInput[];
    runSlots?: CreateDeliveryRunSlotInput[];
    stops: CreateDeliveryRunStopInput[];
};

export type CreatePreparedDeliveryRunPickupNodeInput =
    CreateDeliveryRunPickupNodeInput & {
        latitude: number;
        longitude: number;
        itinerarySequence: number;
        estimatedArrivalAt: Date;
        incomingTravelSeconds: number;
        incomingDistanceMeters: number;
        serviceDurationSeconds: number;
    };

export type CreatePreparedDeliveryRunStopInput = CreateDeliveryRunStopInput & {
    estimatedArrivalAt: Date;
    estimatedTravelSeconds: number;
    estimatedDistanceMeters: number;
    itinerarySequence: number;
    serviceDurationSeconds: number;
    timeSlotId: number;
    stopKey: string;
    requestDispatchEventId: number;
    deliveryAddressId: number;
    deliveryAddressUpdatedAt: Date;
};

export type CreatePreparedDeliveryRunManifestItemInput = {
    deliveryRequestId: string;
    timeSlotId: number;
    harvestTraceLinkId?: number;
    traceToken?: string;
};

export type CreatePreparedDeliveryRunInput = Omit<
    CreateDeliveryRunInput,
    | 'totalDistanceMeters'
    | 'totalDurationSeconds'
    | 'routePlanVersion'
    | 'estimateSource'
    | 'pickupNodes'
    | 'runSlots'
    | 'stops'
> & {
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    routePlanVersion: number;
    estimateSource: PreparedDeliveryRunEstimateSource;
    pickupNodes: CreatePreparedDeliveryRunPickupNodeInput[];
    runSlots: CreateDeliveryRunSlotInput[];
    stops: CreatePreparedDeliveryRunStopInput[];
    manifestItems: CreatePreparedDeliveryRunManifestItemInput[];
};

export type DeliveryRunRequestSnapshotInput = {
    deliveryRequestId: string;
    requestDispatchEventId: number;
    state: string;
    stopKey: string;
    address: {
        id: number;
        updatedAt: Date;
        label: string;
        contactName: string;
        phone: string;
        street1: string;
        street2?: string | null;
        city: string;
        postalCode: string;
        countryCode: string;
    };
    slot: {
        id: number;
        updatedAt: Date;
        locationId: number;
        startAt: Date;
        endAt: Date;
    };
    pickupLocation: {
        id: number;
        updatedAt: Date;
        name: string;
        street1: string;
        street2?: string | null;
        city: string;
        postalCode: string;
        countryCode: string;
    };
};

export const DeliveryRunPersistenceErrorCodes = {
    ACTIVE_RUN_EXISTS: 'active-run-exists',
    ALREADY_ASSIGNED: 'delivery-already-assigned',
    INVALID_PLAN: 'invalid-plan',
    PREPARATION_EXPIRED: 'preparation-expired',
    PREPARATION_NOT_FOUND: 'preparation-not-found',
    PREPARATION_OWNER_MISMATCH: 'preparation-owner-mismatch',
    PREPARATION_SELECTION_MISMATCH: 'preparation-selection-mismatch',
    PREPARATION_TOKEN_INVALID: 'preparation-token-invalid',
    REQUEST_CHANGED: 'delivery-request-changed',
    SOURCE_CHANGED: 'delivery-source-changed',
} as const;

export type DeliveryRunPersistenceErrorCode =
    (typeof DeliveryRunPersistenceErrorCodes)[keyof typeof DeliveryRunPersistenceErrorCodes];

export class DeliveryRunPersistenceError extends Error {
    override name = 'DeliveryRunPersistenceError';

    constructor(
        readonly code: DeliveryRunPersistenceErrorCode,
        message: string,
        readonly context: {
            deliveryRequestId?: string;
            activeRunId?: string;
        } = {},
    ) {
        super(message);
    }

    get deliveryRequestId() {
        return this.context.deliveryRequestId;
    }

    get activeRunId() {
        return this.context.activeRunId;
    }
}

export const DeliveryRunExecutionErrorCodes = {
    ACTIVE_RUN_NOT_FOUND: 'active-run-not-found',
    PICKUP_NOT_CURRENT: 'pickup-not-current',
    PICKUP_TRACE_INVALID: 'pickup-trace-invalid',
    PICKUP_ITEM_NOT_FOUND: 'pickup-item-not-found',
    PICKUP_ITEM_STATE_INVALID: 'pickup-item-state-invalid',
    PICKUP_MANIFEST_NOT_FOUND: 'pickup-manifest-not-found',
    PICKUP_MANIFEST_INCOMPLETE: 'pickup-manifest-incomplete',
    PICKUP_OPERATION_CONFLICT: 'pickup-operation-conflict',
    HANDOFF_OPERATION_CONFLICT: 'handoff-operation-conflict',
    HANDOFF_OPERATION_INVALID: 'handoff-operation-invalid',
    PICKUP_DEPENDENCY_PENDING: 'pickup-dependency-pending',
    ROUTE_ORDER: 'route-order',
    ROUTE_REVISION_CONFLICT: 'route-revision-conflict',
    EXCEPTION_OPERATION_CONFLICT: 'exception-operation-conflict',
    EXCEPTION_INVALID: 'exception-invalid',
    EXCEPTION_TRANSITION_INVALID: 'exception-transition-invalid',
    STOP_OPERATION_CONFLICT: 'stop-operation-conflict',
    STOP_OPERATION_INVALID: 'stop-operation-invalid',
    STOP_OPERATION_STATE_CONFLICT: 'stop-operation-state-conflict',
    RUN_DRIVER_CONFLICT: 'run-driver-conflict',
    RUN_MUTATION_INVALID: 'run-mutation-invalid',
    LOCATION_CONFLICT: 'location-conflict',
    LOCATION_STALE: 'location-stale',
} as const;

export type DeliveryRunExecutionErrorCode =
    (typeof DeliveryRunExecutionErrorCodes)[keyof typeof DeliveryRunExecutionErrorCodes];

export class DeliveryRunExecutionError extends Error {
    override name = 'DeliveryRunExecutionError';

    constructor(
        readonly code: DeliveryRunExecutionErrorCode,
        message: string,
    ) {
        super(message);
    }
}

export const deliveryRunTrackingLiveThresholdMs = 30 * 1000;
export const deliveryRunExactLocationTtlMs = 2 * 60 * 1000;

export type DeliveryRunExecutionStep =
    | {
          kind: 'pickup';
          pickupNodeId: string;
          itinerarySequence: number;
          manifestIds: string[];
          state: 'completed' | 'current' | 'upcoming';
      }
    | {
          kind: 'delivery';
          itinerarySequence: number;
          stopKey: string | null;
          stopIds: number[];
          actionableStopIds: number[];
          pickupConfirmed: boolean;
          retryLaneRank?: number;
          retryAttempt?: number;
          state: 'completed' | 'current' | 'upcoming';
      };

type DeliveryRunPickupMutationBase = {
    clientOperationId: string;
    occurredAt: Date;
};

export type DeliveryRunPickupMutation =
    | (DeliveryRunPickupMutationBase & {
          kind: 'scan';
          traceToken: string;
      })
    | (DeliveryRunPickupMutationBase & {
          kind: 'mark-item';
          stopId: number;
          outcome: Exclude<DeliveryRunManifestItemState, 'scanned'>;
      })
    | (DeliveryRunPickupMutationBase & {
          kind: 'confirm-manifest';
          manifestId: string;
      });

export type DeliveryRunPickupMutationResult = {
    clientOperationId: string;
    replayed: boolean;
    result: DeliveryRunPickupOperationStoredResult;
};

type DeliveryRunHandoffMutationBase = {
    clientOperationId: string;
    occurredAt: Date;
};

export type DeliveryRunHandoffMutation =
    | (DeliveryRunHandoffMutationBase & {
          kind: 'scan';
          tracePath: string;
      })
    | (DeliveryRunHandoffMutationBase & {
          kind: 'mark-item';
          stopId: number;
          outcome: 'no-label' | 'missing' | 'skipped';
          reason?: DeliveryRunHandoffSkipReason;
      });

export type DeliveryRunHandoffMutationResult = {
    clientOperationId: string;
    retryAttempt: number;
    replayed: boolean;
    result: DeliveryRunHandoffOperationStoredResult;
};

export type DeliveryRunHandoffManifest = DeliveryRunHandoffSnapshot & {
    runId: string;
    targetStopId: number;
};

export type DeliveryRunStopExceptionInput = {
    stopId: number;
    outcome: DeliveryRunExceptionOutcome;
    reason: DeliveryRunExceptionReason;
    note?: string;
};

export type RecordDeliveryRunStopExceptionsInput = {
    driverUserId: string;
    runId: string;
    expectedRouteRevision?: number;
    clientOperationId: string;
    occurredAt: Date;
    exceptions: DeliveryRunStopExceptionInput[];
};

export type RecordDeliveryRunStopExceptionsResult = {
    clientOperationId: string;
    replayed: boolean;
    result: DeliveryRunExceptionOperationStoredResult;
};

type RecordDeliveryRunStopOperationBase = {
    driverUserId: string;
    runId: string;
    targetStopId: number;
    expectedRouteRevision: number;
    clientOperationId: string;
    occurredAt: Date;
};

export type RecordDeliveryRunStopOperationInput =
    | (RecordDeliveryRunStopOperationBase & {
          kind: 'arrive';
      })
    | (RecordDeliveryRunStopOperationBase & {
          kind: 'deliver';
          deliveryNotes?: string;
      });

export type RecordDeliveryRunStopOperationResult = {
    clientOperationId: string;
    replayed: boolean;
    result: DeliveryRunStopOperationStoredResult;
};

export type SaveDeliveryRunPreparationInput = {
    dispatchRevision: number;
    selectionRequestIds: string[];
    createRunInput: CreatePreparedDeliveryRunInput;
    requestSnapshots: DeliveryRunRequestSnapshotInput[];
};

export type ConsumeDeliveryRunPreparationInput = {
    preparationToken: string;
    driverUserId: string;
    deliveryRequestIds: string[];
};

const deliveryRunPreparationTtlMs = 2 * 60 * 1000;
const deliveryRunPreparationConsumedRetentionMs = 24 * 60 * 60 * 1000;
const deliveryRunPreparationCleanupLimit = 100;
const preparationTokenPattern =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{32,})$/i;

function hashValue(value: string) {
    return createHash('sha256').update(value).digest('hex');
}

function selectionHash(requestIds: string[]) {
    return hashValue(Array.from(new Set(requestIds)).sort().join('\n'));
}

function tokenMatches(secret: string, expectedHash: string) {
    const actual = Buffer.from(hashValue(secret), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (
        actual.length === expected.length && timingSafeEqual(actual, expected)
    );
}

async function pruneDeliveryRunPreparations(db: TransactionClient, now: Date) {
    const consumedBefore = new Date(
        now.getTime() - deliveryRunPreparationConsumedRetentionMs,
    );
    const staleRows = await db
        .select({ id: deliveryRunPreparations.id })
        .from(deliveryRunPreparations)
        .where(
            or(
                and(
                    isNull(deliveryRunPreparations.consumedAt),
                    lte(deliveryRunPreparations.expiresAt, now),
                ),
                lte(deliveryRunPreparations.consumedAt, consumedBefore),
            ),
        )
        .orderBy(asc(deliveryRunPreparations.expiresAt))
        .limit(deliveryRunPreparationCleanupLimit);
    if (staleRows.length > 0) {
        await db.delete(deliveryRunPreparations).where(
            inArray(
                deliveryRunPreparations.id,
                staleRows.map((row) => row.id),
            ),
        );
    }
}

function iso(value: Date) {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Delivery run preparation contains an invalid date',
        );
    }
    return value.toISOString();
}

function sameDate(first: Date, second: string) {
    return first.toISOString() === second;
}

function formatAddress(address: {
    street1: string;
    street2?: string | null;
    postalCode: string;
    city: string;
    countryCode: string;
}) {
    return [
        address.street1,
        address.street2,
        `${address.postalCode} ${address.city}`,
        address.countryCode,
    ]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
        .join(', ');
}

function stopKey(slotId: number, address: Parameters<typeof formatAddress>[0]) {
    const normalizedAddress = formatAddress(address)
        .normalize('NFKC')
        .toLocaleLowerCase('hr-HR')
        .replace(/\s*,\s*/g, ',')
        .replace(/\s+/g, ' ')
        .trim();
    return `${slotId}:${normalizedAddress}`;
}

function isNonnegativeInteger(value: unknown): value is number {
    return Number.isInteger(value) && Number(value) >= 0;
}

function isPreparedEstimateSource(
    value: DeliveryRunEstimateSource | undefined,
): value is PreparedDeliveryRunEstimateSource {
    return (
        value === DeliveryRunEstimateSources.GOOGLE ||
        value === DeliveryRunEstimateSources.LOCAL
    );
}

function normalizePreparationPlan({
    dispatchRevision,
    selectionRequestIds,
    createRunInput,
    requestSnapshots,
}: SaveDeliveryRunPreparationInput): DeliveryRunPreparationPlanPayloadV3 {
    if (!Number.isInteger(dispatchRevision) || dispatchRevision < 0) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Delivery dispatch revision is invalid',
        );
    }
    if (
        !Number.isInteger(createRunInput.routePlanVersion) ||
        createRunInput.routePlanVersion < 2 ||
        !isPreparedEstimateSource(createRunInput.estimateSource) ||
        !isNonnegativeInteger(createRunInput.totalDistanceMeters) ||
        !isNonnegativeInteger(createRunInput.totalDurationSeconds)
    ) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Delivery route plan provenance is invalid',
        );
    }
    const pickupNodes = createRunInput.pickupNodes;
    const runSlots = createRunInput.runSlots;
    const manifestItems = createRunInput.manifestItems;
    if (
        !pickupNodes?.length ||
        !runSlots?.length ||
        createRunInput.stops.length === 0 ||
        requestSnapshots.length !== createRunInput.stops.length ||
        manifestItems.length !== createRunInput.stops.length
    ) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Delivery run preparation is incomplete',
        );
    }
    const uniqueSelectionRequestIds = new Set(selectionRequestIds);
    if (
        selectionRequestIds.length === 0 ||
        uniqueSelectionRequestIds.size !== selectionRequestIds.length
    ) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Delivery run selection must contain unique request IDs',
        );
    }

    const pickupLocationIds = new Set<number>();
    const pickupSequences = new Set<number>();
    const pickupItinerarySequences = new Map<number, number>();
    for (const node of pickupNodes) {
        if (
            !Number.isInteger(node.sequence) ||
            node.sequence <= 0 ||
            pickupLocationIds.has(node.pickupLocationId) ||
            pickupSequences.has(node.sequence) ||
            !Number.isInteger(node.itinerarySequence) ||
            node.itinerarySequence <= 0 ||
            Array.from(pickupItinerarySequences.values()).includes(
                node.itinerarySequence,
            ) ||
            !isNonnegativeInteger(node.incomingTravelSeconds) ||
            !isNonnegativeInteger(node.incomingDistanceMeters) ||
            !isNonnegativeInteger(node.serviceDurationSeconds) ||
            (node.itinerarySequence === 1 &&
                (node.incomingTravelSeconds !== 0 ||
                    node.incomingDistanceMeters !== 0))
        ) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Delivery pickup nodes are invalid',
            );
        }
        ensureCoordinates(node.latitude, node.longitude);
        iso(node.estimatedArrivalAt);
        pickupLocationIds.add(node.pickupLocationId);
        pickupSequences.add(node.sequence);
        pickupItinerarySequences.set(
            node.pickupLocationId,
            node.itinerarySequence,
        );
    }
    const pickupNodesByItinerary = [...pickupNodes].sort(
        (first, second) => first.itinerarySequence - second.itinerarySequence,
    );
    if (
        pickupNodesByItinerary.some(
            (node, index) => node.sequence !== index + 1,
        )
    ) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Pickup node sequence must follow pickup itinerary order',
        );
    }

    const timeSlotIds = new Set<number>();
    const slotSequences = new Set<number>();
    const manifestIds = new Set<string>();
    const normalizedSlots = runSlots.map((slot) => {
        const manifestId = slot.manifestId ?? randomUUID();
        if (
            !pickupLocationIds.has(slot.pickupLocationId) ||
            !Number.isInteger(slot.sequence) ||
            slot.sequence <= 0 ||
            timeSlotIds.has(slot.timeSlotId) ||
            slotSequences.has(slot.sequence) ||
            manifestIds.has(manifestId) ||
            slot.windowEndAt <= slot.windowStartAt
        ) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Delivery run slots are invalid',
            );
        }
        timeSlotIds.add(slot.timeSlotId);
        slotSequences.add(slot.sequence);
        manifestIds.add(manifestId);
        return {
            ...slot,
            manifestId,
            windowStartAt: iso(slot.windowStartAt),
            windowEndAt: iso(slot.windowEndAt),
            sourceUpdatedAt: iso(slot.sourceUpdatedAt),
        };
    });
    if (!timeSlotIds.has(createRunInput.timeSlotId)) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Primary delivery time slot is not part of the run',
        );
    }

    const snapshotsByRequestId = new Map<
        string,
        DeliveryRunRequestSnapshotInput
    >();
    for (const snapshot of requestSnapshots) {
        if (snapshotsByRequestId.has(snapshot.deliveryRequestId)) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Delivery request snapshots must be unique',
            );
        }
        snapshotsByRequestId.set(snapshot.deliveryRequestId, snapshot);
    }
    if (
        selectionRequestIds.some(
            (requestId) => !snapshotsByRequestId.has(requestId),
        )
    ) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Delivery run selection is not part of the prepared bulk set',
        );
    }

    const representedPickupLocationIds = new Set(
        requestSnapshots.map((snapshot) => snapshot.pickupLocation.id),
    );
    if (
        representedPickupLocationIds.size !== pickupNodes.length ||
        pickupNodes.some(
            (node) => !representedPickupLocationIds.has(node.pickupLocationId),
        )
    ) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Pickup nodes do not exactly represent request snapshots',
        );
    }
    for (const node of pickupNodes) {
        const snapshots = requestSnapshots.filter(
            (snapshot) => snapshot.pickupLocation.id === node.pickupLocationId,
        );
        if (
            snapshots.some(
                ({ pickupLocation }) =>
                    pickupLocation.name !== node.name ||
                    pickupLocation.street1 !== node.street1 ||
                    !sourceTextEqual(pickupLocation.street2, node.street2) ||
                    pickupLocation.city !== node.city ||
                    pickupLocation.postalCode !== node.postalCode ||
                    pickupLocation.countryCode !== node.countryCode ||
                    pickupLocation.updatedAt.getTime() !==
                        node.sourceUpdatedAt.getTime(),
            )
        ) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Pickup node source snapshot does not match its requests',
            );
        }
    }

    const representedTimeSlotIds = new Set(
        requestSnapshots.map((snapshot) => snapshot.slot.id),
    );
    if (
        representedTimeSlotIds.size !== runSlots.length ||
        runSlots.some((slot) => !representedTimeSlotIds.has(slot.timeSlotId))
    ) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Run slots do not exactly represent request snapshots',
        );
    }
    for (const runSlot of runSlots) {
        const snapshots = requestSnapshots.filter(
            (snapshot) => snapshot.slot.id === runSlot.timeSlotId,
        );
        if (
            snapshots.some(
                (snapshot) =>
                    snapshot.slot.locationId !== runSlot.pickupLocationId ||
                    snapshot.pickupLocation.id !== runSlot.pickupLocationId ||
                    snapshot.slot.startAt.getTime() !==
                        runSlot.windowStartAt.getTime() ||
                    snapshot.slot.endAt.getTime() !==
                        runSlot.windowEndAt.getTime() ||
                    snapshot.slot.updatedAt.getTime() !==
                        runSlot.sourceUpdatedAt.getTime(),
            )
        ) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Run slot source snapshot does not match its requests',
            );
        }
    }
    const stopRequestIds = new Set<string>();
    const stopSequences = new Set<number>();
    const physicalStopsByStopKey = new Map<
        string,
        {
            itinerarySequence: number;
            latitude: number;
            longitude: number;
            formattedAddress: string;
            estimatedArrivalAt: string;
            estimatedTravelSeconds: number;
            estimatedDistanceMeters: number;
            serviceDurationSeconds: number;
            sequences: number[];
        }
    >();
    const normalizedStops = createRunInput.stops.map((stop) => {
        ensureCoordinates(stop.latitude, stop.longitude);
        const snapshot = snapshotsByRequestId.get(stop.deliveryRequestId);
        const estimatedArrivalAt = iso(stop.estimatedArrivalAt);
        const pickupItinerarySequence = snapshot
            ? pickupItinerarySequences.get(snapshot.slot.locationId)
            : undefined;
        if (
            !snapshot ||
            !Number.isInteger(stop.sequence) ||
            stop.sequence <= 0 ||
            !Number.isInteger(stop.itinerarySequence) ||
            stop.itinerarySequence <= 0 ||
            pickupItinerarySequence === undefined ||
            stop.itinerarySequence <= pickupItinerarySequence ||
            !isNonnegativeInteger(stop.estimatedTravelSeconds) ||
            !isNonnegativeInteger(stop.estimatedDistanceMeters) ||
            !isNonnegativeInteger(stop.serviceDurationSeconds) ||
            stopRequestIds.has(stop.deliveryRequestId) ||
            stopSequences.has(stop.sequence) ||
            stop.timeSlotId === undefined ||
            !timeSlotIds.has(stop.timeSlotId) ||
            stop.timeSlotId !== snapshot.slot.id ||
            stop.stopKey !== snapshot.stopKey ||
            stop.formattedAddress !== formatAddress(snapshot.address) ||
            stop.requestDispatchEventId !== snapshot.requestDispatchEventId ||
            stop.deliveryAddressId !== snapshot.address.id ||
            !stop.deliveryAddressUpdatedAt ||
            stop.deliveryAddressUpdatedAt.getTime() !==
                snapshot.address.updatedAt.getTime()
        ) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Delivery run stops do not match their request snapshots',
                { deliveryRequestId: stop.deliveryRequestId },
            );
        }
        const physicalStop = physicalStopsByStopKey.get(stop.stopKey);
        if (
            physicalStop &&
            (physicalStop.itinerarySequence !== stop.itinerarySequence ||
                physicalStop.latitude !== stop.latitude ||
                physicalStop.longitude !== stop.longitude ||
                physicalStop.formattedAddress !== stop.formattedAddress ||
                physicalStop.estimatedArrivalAt !== estimatedArrivalAt ||
                physicalStop.estimatedTravelSeconds !==
                    stop.estimatedTravelSeconds ||
                physicalStop.estimatedDistanceMeters !==
                    stop.estimatedDistanceMeters ||
                physicalStop.serviceDurationSeconds !==
                    stop.serviceDurationSeconds)
        ) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Bulk delivery rows must share one physical itinerary stop',
                { deliveryRequestId: stop.deliveryRequestId },
            );
        }
        if (physicalStop) {
            physicalStop.sequences.push(stop.sequence);
        } else {
            physicalStopsByStopKey.set(stop.stopKey, {
                itinerarySequence: stop.itinerarySequence,
                latitude: stop.latitude,
                longitude: stop.longitude,
                formattedAddress: stop.formattedAddress,
                estimatedArrivalAt,
                estimatedTravelSeconds: stop.estimatedTravelSeconds,
                estimatedDistanceMeters: stop.estimatedDistanceMeters,
                serviceDurationSeconds: stop.serviceDurationSeconds,
                sequences: [stop.sequence],
            });
        }
        stopRequestIds.add(stop.deliveryRequestId);
        stopSequences.add(stop.sequence);
        return {
            deliveryRequestId: stop.deliveryRequestId,
            sequence: stop.sequence,
            latitude: stop.latitude,
            longitude: stop.longitude,
            formattedAddress: stop.formattedAddress,
            estimatedArrivalAt,
            estimatedTravelSeconds: stop.estimatedTravelSeconds,
            estimatedDistanceMeters: stop.estimatedDistanceMeters,
            itinerarySequence: stop.itinerarySequence,
            serviceDurationSeconds: stop.serviceDurationSeconds,
            timeSlotId: stop.timeSlotId,
            stopKey: stop.stopKey,
            requestDispatchEventId: stop.requestDispatchEventId,
            deliveryAddressId: stop.deliveryAddressId,
            deliveryAddressUpdatedAt: iso(stop.deliveryAddressUpdatedAt),
        };
    });

    const orderedStopSequences = Array.from(stopSequences).sort(
        (first, second) => first - second,
    );
    if (
        orderedStopSequences.some((sequence, index) => sequence !== index + 1)
    ) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Delivery stop sequence must be contiguous',
        );
    }
    const physicalStops = Array.from(physicalStopsByStopKey.values());
    if (
        physicalStops.some((physicalStop) => {
            const sequences = [...physicalStop.sequences].sort(
                (first, second) => first - second,
            );
            const firstSequence = sequences[0];
            return (
                firstSequence === undefined ||
                sequences.some(
                    (sequence, index) => sequence !== firstSequence + index,
                )
            );
        })
    ) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Bulk delivery rows must be contiguous in stop order',
        );
    }
    const physicalStopsByRowOrder = physicalStops.sort(
        (first, second) =>
            Math.min(...first.sequences) - Math.min(...second.sequences),
    );
    if (
        physicalStopsByRowOrder.some(
            (physicalStop, index) =>
                index > 0 &&
                physicalStop.itinerarySequence <=
                    (physicalStopsByRowOrder[index - 1]?.itinerarySequence ??
                        0),
        )
    ) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Delivery stop sequence must follow physical itinerary order',
        );
    }

    const itineraryNodeKinds = new Map<number, 'customer' | 'pickup'>();
    for (const node of pickupNodes) {
        itineraryNodeKinds.set(node.itinerarySequence, 'pickup');
    }
    for (const physicalStop of physicalStopsByStopKey.values()) {
        if (itineraryNodeKinds.has(physicalStop.itinerarySequence)) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Physical itinerary nodes must have unique sequences',
            );
        }
        itineraryNodeKinds.set(physicalStop.itinerarySequence, 'customer');
    }
    const itinerarySequences = Array.from(itineraryNodeKinds.keys()).sort(
        (first, second) => first - second,
    );
    if (
        itineraryNodeKinds.get(1) !== 'pickup' ||
        itinerarySequences.some((sequence, index) => sequence !== index + 1)
    ) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Delivery itinerary must be contiguous and start at a pickup',
        );
    }

    const stopsByRequestId = new Map(
        normalizedStops.map((stop) => [stop.deliveryRequestId, stop]),
    );
    const manifestRequestIds = new Set<string>();
    const normalizedManifestItems = manifestItems.map((item) => {
        const stop = stopsByRequestId.get(item.deliveryRequestId);
        const hasTraceLinkId = item.harvestTraceLinkId !== undefined;
        const normalizedTraceToken = item.traceToken
            ? normalizeHarvestTraceToken(item.traceToken)
            : null;
        const hasTraceToken = normalizedTraceToken !== null;
        if (
            !stop ||
            manifestRequestIds.has(item.deliveryRequestId) ||
            item.timeSlotId !== stop.timeSlotId ||
            hasTraceLinkId !== hasTraceToken ||
            (hasTraceLinkId &&
                (!Number.isInteger(item.harvestTraceLinkId) ||
                    Number(item.harvestTraceLinkId) <= 0)) ||
            (item.traceToken !== undefined && !normalizedTraceToken)
        ) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Delivery pickup manifest items are invalid',
                { deliveryRequestId: item.deliveryRequestId },
            );
        }
        manifestRequestIds.add(item.deliveryRequestId);
        return {
            deliveryRequestId: item.deliveryRequestId,
            timeSlotId: item.timeSlotId,
            ...(item.harvestTraceLinkId !== undefined && normalizedTraceToken
                ? {
                      harvestTraceLinkId: item.harvestTraceLinkId,
                      traceToken: normalizedTraceToken,
                  }
                : {}),
        };
    });
    if (
        stopRequestIds.size !== manifestRequestIds.size ||
        Array.from(stopRequestIds).some(
            (requestId) => !manifestRequestIds.has(requestId),
        )
    ) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Delivery pickup manifest must contain every delivery exactly once',
        );
    }

    return {
        formatVersion: 3,
        dispatchRevision,
        selectionRequestIds: [...selectionRequestIds],
        createRunInput: {
            driverUserId: createRunInput.driverUserId,
            timeSlotId: createRunInput.timeSlotId,
            ...(createRunInput.encodedPolyline
                ? { encodedPolyline: createRunInput.encodedPolyline }
                : {}),
            totalDistanceMeters: createRunInput.totalDistanceMeters,
            totalDurationSeconds: createRunInput.totalDurationSeconds,
            routePlanVersion: createRunInput.routePlanVersion,
            estimateSource: createRunInput.estimateSource,
            pickupNodes: pickupNodes.map((node) => ({
                ...node,
                sourceUpdatedAt: iso(node.sourceUpdatedAt),
                estimatedArrivalAt: iso(node.estimatedArrivalAt),
            })),
            runSlots: normalizedSlots,
            stops: normalizedStops,
            manifestItems: normalizedManifestItems,
        },
        requestSnapshots: requestSnapshots.map((snapshot) => ({
            deliveryRequestId: snapshot.deliveryRequestId,
            requestDispatchEventId: snapshot.requestDispatchEventId,
            state: snapshot.state,
            stopKey: snapshot.stopKey,
            address: {
                ...snapshot.address,
                updatedAt: iso(snapshot.address.updatedAt),
            },
            slot: {
                ...snapshot.slot,
                updatedAt: iso(snapshot.slot.updatedAt),
                startAt: iso(snapshot.slot.startAt),
                endAt: iso(snapshot.slot.endAt),
            },
            pickupLocation: {
                ...snapshot.pickupLocation,
                updatedAt: iso(snapshot.pickupLocation.updatedAt),
            },
        })),
    };
}

function normalizePersistedV2Plan(plan: DeliveryRunPreparationPlanPayloadV2) {
    const normalized = normalizePreparationPlan({
        dispatchRevision: plan.dispatchRevision,
        selectionRequestIds: plan.selectionRequestIds,
        createRunInput: {
            ...plan.createRunInput,
            manifestItems: plan.createRunInput.stops.map((stop) => ({
                deliveryRequestId: stop.deliveryRequestId,
                timeSlotId: stop.timeSlotId,
            })),
            pickupNodes: plan.createRunInput.pickupNodes.map((node) => ({
                ...node,
                sourceUpdatedAt: new Date(node.sourceUpdatedAt),
                estimatedArrivalAt: new Date(node.estimatedArrivalAt),
            })),
            runSlots: plan.createRunInput.runSlots.map((slot) => ({
                ...slot,
                windowStartAt: new Date(slot.windowStartAt),
                windowEndAt: new Date(slot.windowEndAt),
                sourceUpdatedAt: new Date(slot.sourceUpdatedAt),
            })),
            stops: plan.createRunInput.stops.map((stop) => ({
                ...stop,
                estimatedArrivalAt: new Date(stop.estimatedArrivalAt),
                deliveryAddressUpdatedAt: new Date(
                    stop.deliveryAddressUpdatedAt,
                ),
            })),
        },
        requestSnapshots: plan.requestSnapshots.map((snapshot) => ({
            ...snapshot,
            address: {
                ...snapshot.address,
                updatedAt: new Date(snapshot.address.updatedAt),
            },
            slot: {
                ...snapshot.slot,
                updatedAt: new Date(snapshot.slot.updatedAt),
                startAt: new Date(snapshot.slot.startAt),
                endAt: new Date(snapshot.slot.endAt),
            },
            pickupLocation: {
                ...snapshot.pickupLocation,
                updatedAt: new Date(snapshot.pickupLocation.updatedAt),
            },
        })),
    });
    const { manifestItems: _manifestItems, ...createRunInput } =
        normalized.createRunInput;
    return {
        ...normalized,
        formatVersion: 2,
        createRunInput,
    } satisfies DeliveryRunPreparationPlanPayloadV2;
}

function normalizePersistedV3Plan(plan: DeliveryRunPreparationPlanPayloadV3) {
    return normalizePreparationPlan({
        dispatchRevision: plan.dispatchRevision,
        selectionRequestIds: plan.selectionRequestIds,
        createRunInput: {
            ...plan.createRunInput,
            pickupNodes: plan.createRunInput.pickupNodes.map((node) => ({
                ...node,
                sourceUpdatedAt: new Date(node.sourceUpdatedAt),
                estimatedArrivalAt: new Date(node.estimatedArrivalAt),
            })),
            runSlots: plan.createRunInput.runSlots.map((slot) => ({
                ...slot,
                windowStartAt: new Date(slot.windowStartAt),
                windowEndAt: new Date(slot.windowEndAt),
                sourceUpdatedAt: new Date(slot.sourceUpdatedAt),
            })),
            stops: plan.createRunInput.stops.map((stop) => ({
                ...stop,
                estimatedArrivalAt: new Date(stop.estimatedArrivalAt),
                deliveryAddressUpdatedAt: new Date(
                    stop.deliveryAddressUpdatedAt,
                ),
            })),
            manifestItems: plan.createRunInput.manifestItems.map((item) => ({
                ...item,
            })),
        },
        requestSnapshots: plan.requestSnapshots.map((snapshot) => ({
            ...snapshot,
            address: {
                ...snapshot.address,
                updatedAt: new Date(snapshot.address.updatedAt),
            },
            slot: {
                ...snapshot.slot,
                updatedAt: new Date(snapshot.slot.updatedAt),
                startAt: new Date(snapshot.slot.startAt),
                endAt: new Date(snapshot.slot.endAt),
            },
            pickupLocation: {
                ...snapshot.pickupLocation,
                updatedAt: new Date(snapshot.pickupLocation.updatedAt),
            },
        })),
    });
}

export type DeliveryRunStopEstimate = {
    deliveryRequestId: string;
    estimatedArrivalAt: Date;
    estimatedTravelSeconds: number;
    estimatedDistanceMeters: number;
};

function ensureCoordinates(latitude: number, longitude: number) {
    if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
    ) {
        throw new Error('Invalid delivery coordinates');
    }
}

function sourceTextEqual(
    current: string | null | undefined,
    expected: string | null | undefined,
) {
    return (current ?? null) === (expected ?? null);
}

type DeliveryRunTraceSource = {
    id: number;
    publicToken: string;
    harvestOperationId: number;
    raisedBedFieldId: number;
};

function resolveDeliveryRunTraceSource({
    operationId,
    raisedBedFieldId,
    links,
}: {
    operationId: number;
    raisedBedFieldId: number | null;
    links: readonly DeliveryRunTraceSource[];
}) {
    const operationLinks = links.filter(
        (link) => link.harvestOperationId === operationId,
    );
    if (raisedBedFieldId !== null) {
        const exact = operationLinks.find(
            (link) => link.raisedBedFieldId === raisedBedFieldId,
        );
        if (exact) return exact;
    }
    return operationLinks.length === 1 ? operationLinks[0] : null;
}

async function lockAndReadDeliveryRunTraceSources({
    requestIds,
    db,
}: {
    requestIds: readonly string[];
    db: TransactionClient;
}) {
    const initialRequestSources = await db
        .select({
            deliveryRequestId: deliveryRequests.id,
            operationId: deliveryRequests.operationId,
            raisedBedFieldId: operations.raisedBedFieldId,
        })
        .from(deliveryRequests)
        .innerJoin(operations, eq(deliveryRequests.operationId, operations.id))
        .where(inArray(deliveryRequests.id, [...requestIds]));
    const operationIds = Array.from(
        new Set(initialRequestSources.map((source) => source.operationId)),
    ).sort((first, second) => first - second);

    for (const operationId of operationIds) {
        await db.execute(
            sql`select ${operations.id} from ${operations} where ${operations.id} = ${operationId} for update`,
        );
    }

    const requestSources = await db
        .select({
            deliveryRequestId: deliveryRequests.id,
            operationId: deliveryRequests.operationId,
            raisedBedFieldId: operations.raisedBedFieldId,
        })
        .from(deliveryRequests)
        .innerJoin(operations, eq(deliveryRequests.operationId, operations.id))
        .where(inArray(deliveryRequests.id, [...requestIds]));
    for (const operationId of operationIds) {
        await db.execute(
            sql`select ${harvestTraceLinks.id} from ${harvestTraceLinks} where ${harvestTraceLinks.harvestOperationId} = ${operationId} for update`,
        );
    }

    const activeLinks =
        operationIds.length > 0
            ? await db.query.harvestTraceLinks.findMany({
                  columns: {
                      id: true,
                      publicToken: true,
                      harvestOperationId: true,
                      raisedBedFieldId: true,
                  },
                  where: and(
                      inArray(
                          harvestTraceLinks.harvestOperationId,
                          operationIds,
                      ),
                      eq(harvestTraceLinks.status, 'active'),
                  ),
              })
            : [];

    return { activeLinks, requestSources };
}

async function validateDeliveryRunTraceSources(
    plan: DeliveryRunPreparationPlanPayloadV3,
    db: TransactionClient,
) {
    const requestIds = plan.requestSnapshots.map(
        (snapshot) => snapshot.deliveryRequestId,
    );
    const { activeLinks, requestSources } =
        await lockAndReadDeliveryRunTraceSources({ requestIds, db });
    const sourcesByRequestId = new Map(
        requestSources.map((source) => [source.deliveryRequestId, source]),
    );
    const manifestItemsByRequestId = new Map(
        plan.createRunInput.manifestItems.map((item) => [
            item.deliveryRequestId,
            item,
        ]),
    );

    for (const snapshot of plan.requestSnapshots) {
        const source = sourcesByRequestId.get(snapshot.deliveryRequestId);
        const manifestItem = manifestItemsByRequestId.get(
            snapshot.deliveryRequestId,
        );
        const currentTrace = source
            ? resolveDeliveryRunTraceSource({
                  operationId: source.operationId,
                  raisedBedFieldId: source.raisedBedFieldId,
                  links: activeLinks,
              })
            : null;
        const expectedTrace =
            manifestItem?.harvestTraceLinkId !== undefined &&
            manifestItem.traceToken !== undefined
                ? {
                      id: manifestItem.harvestTraceLinkId,
                      publicToken: manifestItem.traceToken,
                  }
                : null;
        if (
            !source ||
            !manifestItem ||
            currentTrace?.id !== expectedTrace?.id ||
            currentTrace?.publicToken !== expectedTrace?.publicToken
        ) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.SOURCE_CHANGED,
                'Delivery harvest trace changed after route preparation',
                { deliveryRequestId: snapshot.deliveryRequestId },
            );
        }
    }
}

async function lockPreparationSources(
    plan: DeliveryRunPreparationPlanPayload,
    db: TransactionClient,
) {
    const addressIds = Array.from(
        new Set(plan.requestSnapshots.map((snapshot) => snapshot.address.id)),
    ).sort((first, second) => first - second);
    const slotIds = Array.from(
        new Set(plan.requestSnapshots.map((snapshot) => snapshot.slot.id)),
    ).sort((first, second) => first - second);
    const pickupLocationIds = Array.from(
        new Set(
            plan.requestSnapshots.map((snapshot) => snapshot.pickupLocation.id),
        ),
    ).sort((first, second) => first - second);

    for (const addressId of addressIds) {
        await db.execute(
            sql`select ${deliveryAddresses.id} from ${deliveryAddresses} where ${deliveryAddresses.id} = ${addressId} for update`,
        );
    }
    for (const slotId of slotIds) {
        await db.execute(
            sql`select ${timeSlots.id} from ${timeSlots} where ${timeSlots.id} = ${slotId} for update`,
        );
    }
    for (const pickupLocationId of pickupLocationIds) {
        await db.execute(
            sql`select ${pickupLocations.id} from ${pickupLocations} where ${pickupLocations.id} = ${pickupLocationId} for update`,
        );
    }
}

async function validatePreparationSnapshot(
    plan: DeliveryRunPreparationPlanPayload,
    db: TransactionClient,
) {
    await lockPreparationSources(plan, db);
    const requestIds = plan.requestSnapshots.map(
        (snapshot) => snapshot.deliveryRequestId,
    );
    const currentSnapshots = await getDeliveryRequestDispatchSnapshots(
        requestIds,
        db,
    );
    const currentByRequestId = new Map(
        currentSnapshots.map((snapshot) => [
            snapshot.deliveryRequestId,
            snapshot,
        ]),
    );

    for (const expected of plan.requestSnapshots) {
        const current = currentByRequestId.get(expected.deliveryRequestId);
        if (
            current?.mode !== 'delivery' ||
            current.state !== DeliveryRequestStates.READY ||
            current.state !== expected.state ||
            current.requestDispatchEventId !== expected.requestDispatchEventId
        ) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.REQUEST_CHANGED,
                'Delivery request changed after route preparation',
                { deliveryRequestId: expected.deliveryRequestId },
            );
        }

        const { address, slot, pickupLocation } = current;
        if (
            !address ||
            address.deletedAt !== null ||
            !slot ||
            !pickupLocation ||
            address.id !== expected.address.id ||
            !sameDate(address.updatedAt, expected.address.updatedAt) ||
            address.label !== expected.address.label ||
            address.contactName !== expected.address.contactName ||
            address.phone !== expected.address.phone ||
            address.street1 !== expected.address.street1 ||
            !sourceTextEqual(address.street2, expected.address.street2) ||
            address.city !== expected.address.city ||
            address.postalCode !== expected.address.postalCode ||
            address.countryCode !== expected.address.countryCode ||
            slot.id !== expected.slot.id ||
            !sameDate(slot.updatedAt, expected.slot.updatedAt) ||
            slot.locationId !== expected.slot.locationId ||
            !sameDate(slot.startAt, expected.slot.startAt) ||
            !sameDate(slot.endAt, expected.slot.endAt) ||
            pickupLocation.id !== expected.pickupLocation.id ||
            !sameDate(
                pickupLocation.updatedAt,
                expected.pickupLocation.updatedAt,
            ) ||
            pickupLocation.name !== expected.pickupLocation.name ||
            pickupLocation.street1 !== expected.pickupLocation.street1 ||
            !sourceTextEqual(
                pickupLocation.street2,
                expected.pickupLocation.street2,
            ) ||
            pickupLocation.city !== expected.pickupLocation.city ||
            pickupLocation.postalCode !== expected.pickupLocation.postalCode ||
            pickupLocation.countryCode !==
                expected.pickupLocation.countryCode ||
            stopKey(slot.id, address) !== expected.stopKey
        ) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.SOURCE_CHANGED,
                'Delivery source data changed after route preparation',
                { deliveryRequestId: expected.deliveryRequestId },
            );
        }
    }
    if (plan.formatVersion === 3) {
        await validateDeliveryRunTraceSources(plan, db);
    }
}

function sameIds(first: string[], second: string[]) {
    if (first.length !== second.length) return false;
    const secondIds = new Set(second);
    return first.every((id) => secondIds.has(id));
}

async function validatePreparedBulkMembership(
    plan: DeliveryRunPreparationPlanPayload,
    db: TransactionClient,
) {
    const selectedSlotIds = Array.from(
        new Set(
            plan.requestSnapshots.map((snapshot) =>
                snapshot.slot.id.toString(),
            ),
        ),
    );
    const requestRows = await db
        .selectDistinct({ id: events.aggregateId })
        .from(events)
        .where(
            and(
                inArray(events.type, [...deliveryDispatchEventTypes]),
                or(
                    inArray(
                        sql<string>`${events.data}->>'slotId'`,
                        selectedSlotIds,
                    ),
                    inArray(
                        sql<string>`${events.data}->>'newSlotId'`,
                        selectedSlotIds,
                    ),
                ),
            ),
        );
    const activeAssignments = await db
        .select({ deliveryRequestId: deliveryRunStops.deliveryRequestId })
        .from(deliveryRunStops)
        .innerJoin(deliveryRuns, eq(deliveryRunStops.runId, deliveryRuns.id))
        .where(
            and(
                inArray(
                    deliveryRunStops.deliveryRequestId,
                    requestRows.map((request) => request.id),
                ),
                isNull(deliveryRunStops.releasedAt),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
            ),
        );
    const activelyAssignedRequestIds = new Set(
        activeAssignments.map((assignment) => assignment.deliveryRequestId),
    );
    const currentSnapshots = await getDeliveryRequestDispatchSnapshots(
        requestRows.map((request) => request.id),
        db,
    );
    const preparedStopKeys = new Set(
        plan.requestSnapshots.map((snapshot) => snapshot.stopKey),
    );
    const currentBulkRequestIds = currentSnapshots.flatMap((snapshot) => {
        if (
            snapshot.mode !== 'delivery' ||
            snapshot.state !== DeliveryRequestStates.READY ||
            !snapshot.address ||
            snapshot.address.deletedAt !== null ||
            !snapshot.slot ||
            activelyAssignedRequestIds.has(snapshot.deliveryRequestId) ||
            !preparedStopKeys.has(stopKey(snapshot.slot.id, snapshot.address))
        ) {
            return [];
        }
        return [snapshot.deliveryRequestId];
    });
    const preparedRequestIds = plan.requestSnapshots.map(
        (snapshot) => snapshot.deliveryRequestId,
    );
    if (!sameIds(currentBulkRequestIds, preparedRequestIds)) {
        const changedRequestId =
            currentBulkRequestIds.find(
                (requestId) => !preparedRequestIds.includes(requestId),
            ) ??
            preparedRequestIds.find(
                (requestId) => !currentBulkRequestIds.includes(requestId),
            );
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.REQUEST_CHANGED,
            'Ready deliveries at a prepared bulk stop changed',
            changedRequestId
                ? { deliveryRequestId: changedRequestId }
                : undefined,
        );
    }
}

async function ensurePreparationCanCreateRun(
    plan: DeliveryRunPreparationPlanPayload,
    db: TransactionClient,
) {
    const activeRun = await db.query.deliveryRuns.findFirst({
        columns: { id: true },
        where: and(
            eq(deliveryRuns.driverUserId, plan.createRunInput.driverUserId),
            eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
        ),
    });
    if (activeRun) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.ACTIVE_RUN_EXISTS,
            'Driver already has an active delivery run',
            { activeRunId: activeRun.id },
        );
    }

    const requestIds = plan.requestSnapshots.map(
        (snapshot) => snapshot.deliveryRequestId,
    );
    const assigned = await db.query.deliveryRunStops.findFirst({
        columns: { deliveryRequestId: true },
        where: and(
            inArray(deliveryRunStops.deliveryRequestId, requestIds),
            isNull(deliveryRunStops.releasedAt),
        ),
    });
    if (assigned) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.ALREADY_ASSIGNED,
            'Delivery request is already assigned to another run',
            { deliveryRequestId: assigned.deliveryRequestId },
        );
    }
}

export async function saveDeliveryRunPreparation(
    input: SaveDeliveryRunPreparationInput,
) {
    const plan = normalizePreparationPlan(input);
    const preparationId = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const preparationToken = `${preparationId}.${secret}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + deliveryRunPreparationTtlMs);

    await storage().transaction(async (tx) => {
        await acquireDeliveryDispatchLock(tx);
        await pruneDeliveryRunPreparations(tx, now);
        await ensurePreparationCanCreateRun(plan, tx);
        await validatePreparationSnapshot(plan, tx);
        await validatePreparedBulkMembership(plan, tx);
        await tx.insert(deliveryRunPreparations).values({
            id: preparationId,
            secretHash: hashValue(secret),
            driverUserId: plan.createRunInput.driverUserId,
            selectionHash: selectionHash(plan.selectionRequestIds),
            plan,
            expiresAt,
        });
    });

    return { preparationId, preparationToken, expiresAt };
}

function parsePreparationToken(preparationToken: string) {
    const match = preparationTokenPattern.exec(preparationToken);
    if (!match?.[1] || !match[2]) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.PREPARATION_TOKEN_INVALID,
            'Delivery run preparation token is invalid',
        );
    }
    return { preparationId: match[1], secret: match[2] };
}

async function insertPreparedDeliveryRun(
    plan: DeliveryRunPreparationPlanPayload,
    preparationId: string,
    db: TransactionClient,
) {
    const runId = randomUUID();
    await db.insert(deliveryRuns).values({
        id: runId,
        driverUserId: plan.createRunInput.driverUserId,
        timeSlotId: plan.createRunInput.timeSlotId,
        encodedPolyline: plan.createRunInput.encodedPolyline,
        totalDistanceMeters: plan.createRunInput.totalDistanceMeters,
        totalDurationSeconds: plan.createRunInput.totalDurationSeconds,
        routePlanVersion:
            plan.formatVersion === 1 ? 1 : plan.createRunInput.routePlanVersion,
        estimateSource:
            plan.formatVersion === 1
                ? DeliveryRunEstimateSources.LEGACY
                : plan.createRunInput.estimateSource,
        estimatesUpdatedAt: new Date(),
    });

    const pickupNodeIdsByLocationId = new Map<number, string>();
    const createPickupNodeRow = (
        node: DeliveryRunPreparationPlanPayloadV1['createRunInput']['pickupNodes'][number],
    ) => {
        const id = randomUUID();
        pickupNodeIdsByLocationId.set(node.pickupLocationId, id);
        return {
            id,
            runId,
            pickupLocationId: node.pickupLocationId,
            sequence: node.sequence,
            name: node.name,
            street1: node.street1,
            street2: node.street2,
            city: node.city,
            postalCode: node.postalCode,
            countryCode: node.countryCode,
            formattedAddress: formatAddress(node),
            sourceUpdatedAt: new Date(node.sourceUpdatedAt),
            latitude: node.latitude,
            longitude: node.longitude,
        };
    };
    const pickupNodeRows =
        plan.formatVersion !== 1
            ? plan.createRunInput.pickupNodes.map((node) => ({
                  ...createPickupNodeRow(node),
                  itinerarySequence: node.itinerarySequence,
                  estimatedArrivalAt: new Date(node.estimatedArrivalAt),
                  incomingTravelSeconds: node.incomingTravelSeconds,
                  incomingDistanceMeters: node.incomingDistanceMeters,
                  serviceDurationSeconds: node.serviceDurationSeconds,
              }))
            : plan.createRunInput.pickupNodes.map(createPickupNodeRow);
    await db.insert(deliveryRunPickupNodes).values(pickupNodeRows);

    const runSlotIdsByTimeSlotId = new Map<number, string>();
    const runSlotRows = plan.createRunInput.runSlots.map((slot) => {
        const id = randomUUID();
        const pickupNodeId = pickupNodeIdsByLocationId.get(
            slot.pickupLocationId,
        );
        if (!pickupNodeId) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Delivery run slot has no pickup node',
            );
        }
        runSlotIdsByTimeSlotId.set(slot.timeSlotId, id);
        return {
            id,
            runId,
            pickupNodeId,
            timeSlotId: slot.timeSlotId,
            sequence: slot.sequence,
            manifestId: slot.manifestId,
            manifestState:
                plan.formatVersion === 3
                    ? DeliveryRunManifestStates.PENDING
                    : DeliveryRunManifestStates.CONFIRMED,
            windowStartAt: new Date(slot.windowStartAt),
            windowEndAt: new Date(slot.windowEndAt),
            sourceUpdatedAt: new Date(slot.sourceUpdatedAt),
        };
    });
    await db.insert(deliveryRunSlots).values(runSlotRows);

    const snapshotsByRequestId = new Map(
        plan.requestSnapshots.map((snapshot) => [
            snapshot.deliveryRequestId,
            snapshot,
        ]),
    );
    const manifestItemsByRequestId = new Map(
        plan.formatVersion === 3
            ? plan.createRunInput.manifestItems.map((item) => [
                  item.deliveryRequestId,
                  item,
              ])
            : [],
    );
    const createStopRow = (
        stop: DeliveryRunPreparationPlanPayloadV1['createRunInput']['stops'][number],
    ) => {
        const runSlotId = runSlotIdsByTimeSlotId.get(stop.timeSlotId);
        const snapshot = snapshotsByRequestId.get(stop.deliveryRequestId);
        if (!runSlotId || !snapshot) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Delivery stop has no persisted slot or request snapshot',
                { deliveryRequestId: stop.deliveryRequestId },
            );
        }
        const manifestItem = manifestItemsByRequestId.get(
            stop.deliveryRequestId,
        );
        if (plan.formatVersion === 3 && !manifestItem) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Delivery stop has no persisted pickup manifest item',
                { deliveryRequestId: stop.deliveryRequestId },
            );
        }
        return {
            runId,
            runSlotId,
            deliveryRequestId: stop.deliveryRequestId,
            sequence: stop.sequence,
            stopKey: stop.stopKey,
            requestDispatchEventId: stop.requestDispatchEventId,
            deliveryAddressId: snapshot.address.id,
            deliveryAddressUpdatedAt: new Date(snapshot.address.updatedAt),
            deliveryAddressLabel: snapshot.address.label,
            deliveryContactName: snapshot.address.contactName,
            deliveryPhone: snapshot.address.phone,
            deliveryStreet1: snapshot.address.street1,
            deliveryStreet2: snapshot.address.street2,
            deliveryCity: snapshot.address.city,
            deliveryPostalCode: snapshot.address.postalCode,
            deliveryCountryCode: snapshot.address.countryCode,
            ...(manifestItem
                ? {
                      pickupItemState: DeliveryRunManifestItemStates.READY,
                      pickupTraceLinkId: manifestItem.harvestTraceLinkId,
                      pickupTraceToken: manifestItem.traceToken,
                  }
                : {}),
            handoffVerificationState: DeliveryRunHandoffItemStates.UNVERIFIED,
            latitude: stop.latitude,
            longitude: stop.longitude,
            formattedAddress: stop.formattedAddress,
            estimatedArrivalAt: stop.estimatedArrivalAt
                ? new Date(stop.estimatedArrivalAt)
                : undefined,
            estimatedTravelSeconds: stop.estimatedTravelSeconds,
            estimatedDistanceMeters: stop.estimatedDistanceMeters,
        };
    };
    const stopRows =
        plan.formatVersion !== 1
            ? plan.createRunInput.stops.map((stop) => ({
                  ...createStopRow(stop),
                  itinerarySequence: stop.itinerarySequence,
                  serviceDurationSeconds: stop.serviceDurationSeconds,
              }))
            : plan.createRunInput.stops.map(createStopRow);
    await db.insert(deliveryRunStops).values(stopRows);
    await db
        .update(deliveryRunPreparations)
        .set({
            consumedAt: new Date(),
            deliveryRunId: runId,
        })
        .where(eq(deliveryRunPreparations.id, preparationId));
    return runId;
}

export async function consumeDeliveryRunPreparation({
    preparationToken,
    driverUserId,
    deliveryRequestIds,
}: ConsumeDeliveryRunPreparationInput) {
    const { preparationId, secret } = parsePreparationToken(preparationToken);
    const requestedSelectionHash = selectionHash(deliveryRequestIds);
    if (new Set(deliveryRequestIds).size !== deliveryRequestIds.length) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.PREPARATION_SELECTION_MISMATCH,
            'Delivery run selection does not match its preparation',
        );
    }

    const runId = await storage().transaction(async (tx) => {
        await acquireDeliveryDispatchLock(tx);
        await tx.execute(
            sql`select ${deliveryRunPreparations.id} from ${deliveryRunPreparations} where ${deliveryRunPreparations.id} = ${preparationId} for update`,
        );
        const preparation = await tx.query.deliveryRunPreparations.findFirst({
            where: eq(deliveryRunPreparations.id, preparationId),
        });
        if (!preparation) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.PREPARATION_NOT_FOUND,
                'Delivery run preparation was not found',
            );
        }
        if (!tokenMatches(secret, preparation.secretHash)) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.PREPARATION_TOKEN_INVALID,
                'Delivery run preparation token is invalid',
            );
        }
        if (preparation.driverUserId !== driverUserId) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.PREPARATION_OWNER_MISMATCH,
                'Delivery run preparation belongs to another driver',
            );
        }
        if (preparation.selectionHash !== requestedSelectionHash) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.PREPARATION_SELECTION_MISMATCH,
                'Delivery run selection does not match its preparation',
            );
        }
        if (preparation.deliveryRunId) {
            return preparation.deliveryRunId;
        }
        if (preparation.consumedAt) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Delivery run preparation was consumed without a linked run',
            );
        }
        if (preparation.expiresAt <= new Date()) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.PREPARATION_EXPIRED,
                'Delivery run preparation has expired',
            );
        }
        if (
            (preparation.plan.formatVersion !== 1 &&
                preparation.plan.formatVersion !== 2 &&
                preparation.plan.formatVersion !== 3) ||
            preparation.plan.createRunInput.driverUserId !== driverUserId
        ) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Delivery run preparation payload is invalid',
            );
        }

        const plan =
            preparation.plan.formatVersion === 3
                ? normalizePersistedV3Plan(preparation.plan)
                : preparation.plan.formatVersion === 2
                  ? normalizePersistedV2Plan(preparation.plan)
                  : preparation.plan;

        await ensurePreparationCanCreateRun(plan, tx);
        await validatePreparationSnapshot(plan, tx);
        await validatePreparedBulkMembership(plan, tx);
        return await insertPreparedDeliveryRun(plan, preparationId, tx);
    });

    const run = await getDeliveryRun(runId);
    if (!run) {
        throw new Error('Failed to read persisted delivery run');
    }
    return run;
}

export async function createDeliveryRun({
    driverUserId,
    timeSlotId,
    encodedPolyline,
    totalDistanceMeters,
    totalDurationSeconds,
    stops,
}: CreateDeliveryRunInput) {
    if (stops.length === 0) {
        throw new Error('A delivery run requires at least one stop');
    }

    for (const stop of stops) {
        ensureCoordinates(stop.latitude, stop.longitude);
    }

    const existingRun = await getActiveDeliveryRunForDriver(driverUserId);
    if (existingRun) {
        return existingRun;
    }

    const id = randomUUID();
    await storage().transaction(async (tx) => {
        await tx.insert(deliveryRuns).values({
            id,
            driverUserId,
            timeSlotId,
            encodedPolyline,
            totalDistanceMeters,
            totalDurationSeconds,
            estimatesUpdatedAt: new Date(),
        });

        await tx.insert(deliveryRunStops).values(
            stops.map((stop) => ({
                runId: id,
                deliveryRequestId: stop.deliveryRequestId,
                sequence: stop.sequence,
                latitude: stop.latitude,
                longitude: stop.longitude,
                formattedAddress: stop.formattedAddress,
                estimatedArrivalAt: stop.estimatedArrivalAt,
                estimatedTravelSeconds: stop.estimatedTravelSeconds,
                estimatedDistanceMeters: stop.estimatedDistanceMeters,
                handoffVerificationState:
                    DeliveryRunHandoffItemStates.UNVERIFIED,
            })),
        );
    });

    const run = await getDeliveryRun(id);
    if (!run) {
        throw new Error('Failed to create delivery run');
    }
    return run;
}

export function getDeliveryRun(runId: string) {
    return storage().query.deliveryRuns.findFirst({
        where: eq(deliveryRuns.id, runId),
        with: {
            driver: true,
            timeSlot: true,
            pickupNodes: {
                orderBy: [asc(deliveryRunPickupNodes.sequence)],
            },
            runSlots: {
                orderBy: [asc(deliveryRunSlots.sequence)],
            },
            stops: {
                orderBy: [asc(deliveryRunStops.sequence)],
                with: { runSlot: true },
            },
        },
    });
}

export function getActiveDeliveryRunForDriver(driverUserId: string) {
    return storage().query.deliveryRuns.findFirst({
        where: and(
            eq(deliveryRuns.driverUserId, driverUserId),
            eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
        ),
        orderBy: [asc(deliveryRuns.startedAt)],
        with: {
            driver: true,
            timeSlot: true,
            pickupNodes: {
                orderBy: [asc(deliveryRunPickupNodes.sequence)],
            },
            runSlots: {
                orderBy: [asc(deliveryRunSlots.sequence)],
            },
            stops: {
                orderBy: [asc(deliveryRunStops.sequence)],
                with: { runSlot: true },
            },
        },
    });
}

async function getDeliveryRunExecutionSource(
    runId: string,
    db: DatabaseClient,
) {
    return await db.query.deliveryRuns.findFirst({
        where: eq(deliveryRuns.id, runId),
        with: {
            pickupNodes: {
                orderBy: [asc(deliveryRunPickupNodes.sequence)],
            },
            runSlots: {
                orderBy: [asc(deliveryRunSlots.sequence)],
            },
            stops: {
                orderBy: [asc(deliveryRunStops.sequence)],
            },
        },
    });
}

async function getDeliveryRunExecutionProgressFromDb(
    runId: string,
    db: DatabaseClient,
): Promise<DeliveryRunExecutionStep[]> {
    const run = await getDeliveryRunExecutionSource(runId, db);
    if (!run) return [];
    const legacyPhysicalStopKey = (formattedAddress: string) =>
        `${run.timeSlotId}:${formattedAddress
            .normalize('NFKC')
            .toLocaleLowerCase('hr-HR')
            .replace(/\s*,\s*/g, ',')
            .replace(/\s+/g, ' ')
            .trim()}`;

    type PendingExecutionStep =
        | (Omit<
              Extract<DeliveryRunExecutionStep, { kind: 'pickup' }>,
              'state'
          > & { completed: boolean; sortLane: number; sortSequence: number })
        | (Omit<
              Extract<DeliveryRunExecutionStep, { kind: 'delivery' }>,
              'state'
          > & { completed: boolean; sortLane: number; sortSequence: number });
    const pendingSteps: PendingExecutionStep[] = [];
    const baseItineraryMaximum = Math.max(
        0,
        ...run.pickupNodes.map((node) => node.itinerarySequence ?? 0),
        ...run.stops
            .filter((stop) => stop.retryLaneRank === null)
            .map(
                (stop) =>
                    stop.itinerarySequence ??
                    (run.routePlanVersion < 2 ? stop.sequence : 0),
            ),
    );
    if (run.routePlanVersion < 2) {
        const stopsByPhysicalKey = new Map<string, typeof run.stops>();
        for (const stop of run.stops.filter(
            (candidate) => candidate.retryLaneRank === null,
        )) {
            const key =
                stop.stopKey ?? legacyPhysicalStopKey(stop.formattedAddress);
            const stops = stopsByPhysicalKey.get(key) ?? [];
            stops.push(stop);
            stopsByPhysicalKey.set(key, stops);
        }
        for (const stops of stopsByPhysicalKey.values()) {
            const firstStop = stops[0];
            if (!firstStop) continue;
            pendingSteps.push({
                kind: 'delivery',
                itinerarySequence: Math.min(
                    ...stops.map((stop) => stop.sequence),
                ),
                stopKey:
                    firstStop.stopKey ??
                    legacyPhysicalStopKey(firstStop.formattedAddress),
                stopIds: stops.map((stop) => stop.id),
                actionableStopIds: stops.flatMap((stop) =>
                    isDeliveryRunStopActionable(stop.state) ? [stop.id] : [],
                ),
                pickupConfirmed: true,
                completed: stops.every((stop) =>
                    isDeliveryRunStopTerminal(stop.state),
                ),
                sortLane: 0,
                sortSequence: Math.min(...stops.map((stop) => stop.sequence)),
            });
        }
    } else {
        const slotsByPickupNodeId = new Map<string, typeof run.runSlots>();
        const slotsById = new Map(run.runSlots.map((slot) => [slot.id, slot]));
        for (const slot of run.runSlots) {
            const slots = slotsByPickupNodeId.get(slot.pickupNodeId) ?? [];
            slots.push(slot);
            slotsByPickupNodeId.set(slot.pickupNodeId, slots);
        }
        for (const pickupNode of run.pickupNodes) {
            if (pickupNode.itinerarySequence === null) continue;
            const slots = slotsByPickupNodeId.get(pickupNode.id) ?? [];
            pendingSteps.push({
                kind: 'pickup',
                pickupNodeId: pickupNode.id,
                itinerarySequence: pickupNode.itinerarySequence,
                manifestIds: slots.map((slot) => slot.manifestId),
                completed:
                    slots.length > 0 &&
                    slots.every(
                        (slot) =>
                            slot.manifestState ===
                            DeliveryRunManifestStates.CONFIRMED,
                    ),
                sortLane: 0,
                sortSequence: pickupNode.itinerarySequence,
            });
        }

        const stopsByExecutionKey = new Map<
            string,
            { itinerarySequence: number; stops: typeof run.stops }
        >();
        for (const stop of run.stops) {
            if (
                stop.itinerarySequence === null ||
                stop.retryLaneRank !== null
            ) {
                continue;
            }
            const executionKey = `${stop.itinerarySequence}\u0000${stop.stopKey ?? `stop:${stop.id}`}`;
            const checkpoint = stopsByExecutionKey.get(executionKey) ?? {
                itinerarySequence: stop.itinerarySequence,
                stops: [],
            };
            checkpoint.stops.push(stop);
            stopsByExecutionKey.set(executionKey, checkpoint);
        }
        for (const {
            itinerarySequence,
            stops,
        } of stopsByExecutionKey.values()) {
            pendingSteps.push({
                kind: 'delivery',
                itinerarySequence,
                stopKey: stops[0]?.stopKey ?? null,
                stopIds: stops.map((stop) => stop.id),
                actionableStopIds: stops.flatMap((stop) =>
                    isDeliveryRunStopActionable(stop.state) ? [stop.id] : [],
                ),
                pickupConfirmed: stops.every((stop) => {
                    const slot = stop.runSlotId
                        ? slotsById.get(stop.runSlotId)
                        : undefined;
                    return (
                        slot?.manifestState ===
                        DeliveryRunManifestStates.CONFIRMED
                    );
                }),
                completed: stops.every((stop) =>
                    isDeliveryRunStopTerminal(stop.state),
                ),
                sortLane: 0,
                sortSequence: itinerarySequence,
            });
        }
    }

    const retryCheckpoints = new Map<
        string,
        {
            retryLaneRank: number;
            itinerarySequence: number;
            stopKey: string | null;
            stops: typeof run.stops;
        }
    >();
    for (const stop of run.stops) {
        if (stop.retryLaneRank === null) continue;
        const physicalStopKey =
            stop.stopKey ?? legacyPhysicalStopKey(stop.formattedAddress);
        const key = `${stop.retryLaneRank}\u0000${physicalStopKey}`;
        const checkpoint = retryCheckpoints.get(key) ?? {
            retryLaneRank: stop.retryLaneRank,
            itinerarySequence:
                stop.itinerarySequence ??
                baseItineraryMaximum + stop.retryLaneRank,
            stopKey: physicalStopKey,
            stops: [],
        };
        checkpoint.stops.push(stop);
        retryCheckpoints.set(key, checkpoint);
    }
    for (const checkpoint of retryCheckpoints.values()) {
        pendingSteps.push({
            kind: 'delivery',
            itinerarySequence: checkpoint.itinerarySequence,
            stopKey: checkpoint.stopKey,
            stopIds: checkpoint.stops.map((stop) => stop.id),
            actionableStopIds: checkpoint.stops.flatMap((stop) =>
                isDeliveryRunStopActionable(stop.state) ? [stop.id] : [],
            ),
            pickupConfirmed: true,
            retryLaneRank: checkpoint.retryLaneRank,
            retryAttempt: Math.max(
                ...checkpoint.stops.map((stop) => stop.retryAttempt),
            ),
            completed: checkpoint.stops.every((stop) =>
                isDeliveryRunStopTerminal(stop.state),
            ),
            sortLane: 1,
            sortSequence: checkpoint.retryLaneRank,
        });
    }

    pendingSteps.sort(
        (first, second) =>
            first.sortLane - second.sortLane ||
            first.sortSequence - second.sortSequence ||
            first.itinerarySequence - second.itinerarySequence,
    );
    const currentIndex = pendingSteps.findIndex((step) => !step.completed);
    return pendingSteps.map(
        (
            {
                completed,
                sortLane: _sortLane,
                sortSequence: _sortSequence,
                ...step
            },
            index,
        ) => ({
            ...step,
            state: completed
                ? 'completed'
                : index === currentIndex
                  ? 'current'
                  : 'upcoming',
        }),
    );
}

export function getDeliveryRunExecutionProgress(runId: string) {
    return getDeliveryRunExecutionProgressFromDb(runId, storage());
}

function normalizeDeliveryPickupTrace(value: string) {
    const trimmed = value.trim();
    const pathMatch = /^\/trag\/([^/?#]+)\/?$/.exec(trimmed);
    return normalizeHarvestTraceToken(pathMatch?.[1] ?? trimmed);
}

function pickupMutationPayloadHash(
    pickupNodeId: string,
    mutation: DeliveryRunPickupMutation,
) {
    if (mutation.kind === DeliveryRunPickupOperationKinds.SCAN) {
        const traceToken = normalizeDeliveryPickupTrace(mutation.traceToken);
        if (!traceToken) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.PICKUP_TRACE_INVALID,
                'Pickup trace is invalid',
            );
        }
        return {
            payloadHash: hashValue(
                [
                    pickupNodeId,
                    mutation.kind,
                    mutation.clientOperationId,
                    mutation.occurredAt.toISOString(),
                    traceToken,
                ].join('\n'),
            ),
            mutation: { ...mutation, traceToken },
        };
    }
    if (mutation.kind === DeliveryRunPickupOperationKinds.MARK_ITEM) {
        return {
            payloadHash: hashValue(
                [
                    pickupNodeId,
                    mutation.kind,
                    mutation.clientOperationId,
                    mutation.occurredAt.toISOString(),
                    mutation.stopId,
                    mutation.outcome,
                ].join('\n'),
            ),
            mutation,
        };
    }
    return {
        payloadHash: hashValue(
            [
                pickupNodeId,
                mutation.kind,
                mutation.clientOperationId,
                mutation.occurredAt.toISOString(),
                mutation.manifestId,
            ].join('\n'),
        ),
        mutation,
    };
}

function ensurePickupMutationShape(mutation: DeliveryRunPickupMutation) {
    if (
        !mutation.clientOperationId.trim() ||
        mutation.clientOperationId.length > 128 ||
        !(mutation.occurredAt instanceof Date) ||
        !Number.isFinite(mutation.occurredAt.getTime())
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.PICKUP_ITEM_STATE_INVALID,
            'Pickup operation is invalid',
        );
    }
    if (
        mutation.kind === DeliveryRunPickupOperationKinds.MARK_ITEM &&
        (mutation.stopId <= 0 ||
            !Number.isInteger(mutation.stopId) ||
            ![
                DeliveryRunManifestItemStates.READY,
                DeliveryRunManifestItemStates.MISSING_LABEL,
                DeliveryRunManifestItemStates.NOT_READY,
            ].includes(mutation.outcome))
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.PICKUP_ITEM_STATE_INVALID,
            'Pickup item outcome is invalid',
        );
    }
}

async function ensureCurrentPickupNode({
    runId,
    pickupNodeId,
    db,
}: {
    runId: string;
    pickupNodeId: string;
    db: DatabaseClient;
}) {
    const progress = await getDeliveryRunExecutionProgressFromDb(runId, db);
    const current = progress.find((step) => step.state === 'current');
    if (current?.kind !== 'pickup' || current.pickupNodeId !== pickupNodeId) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.PICKUP_NOT_CURRENT,
            'Pickup checkpoint is not current',
        );
    }
}

async function applyPickupScan({
    runId,
    pickupNodeId,
    driverUserId,
    traceToken,
    db,
}: {
    runId: string;
    pickupNodeId: string;
    driverUserId: string;
    traceToken: string;
    db: TransactionClient;
}): Promise<DeliveryRunPickupOperationStoredResult> {
    const rows = await db
        .select({ stop: deliveryRunStops })
        .from(deliveryRunStops)
        .innerJoin(
            deliveryRunSlots,
            and(
                eq(deliveryRunStops.runId, deliveryRunSlots.runId),
                eq(deliveryRunStops.runSlotId, deliveryRunSlots.id),
            ),
        )
        .where(
            and(
                eq(deliveryRunStops.runId, runId),
                eq(deliveryRunSlots.pickupNodeId, pickupNodeId),
                eq(deliveryRunStops.pickupTraceToken, traceToken),
            ),
        )
        .orderBy(asc(deliveryRunStops.sequence));
    if (rows.length === 0) {
        return {
            kind: DeliveryRunPickupOperationKinds.SCAN,
            outcome: 'not-found',
            affectedStopIds: [],
        };
    }
    const { activeLinks, requestSources } =
        await lockAndReadDeliveryRunTraceSources({
            requestIds: rows.map(({ stop }) => stop.deliveryRequestId),
            db,
        });
    const sourcesByRequestId = new Map(
        requestSources.map((source) => [source.deliveryRequestId, source]),
    );
    const hasInvalidProvenance = rows.some(({ stop }) => {
        const source = sourcesByRequestId.get(stop.deliveryRequestId);
        const currentTrace = source
            ? resolveDeliveryRunTraceSource({
                  operationId: source.operationId,
                  raisedBedFieldId: source.raisedBedFieldId,
                  links: activeLinks,
              })
            : null;
        return (
            currentTrace?.id !== stop.pickupTraceLinkId ||
            currentTrace?.publicToken !== stop.pickupTraceToken
        );
    });
    if (hasInvalidProvenance) {
        return {
            kind: DeliveryRunPickupOperationKinds.SCAN,
            outcome: 'not-found',
            affectedStopIds: [],
        };
    }
    const stopKeys = new Set(rows.map(({ stop }) => stop.stopKey));
    if (stopKeys.size > 1) {
        return {
            kind: DeliveryRunPickupOperationKinds.SCAN,
            outcome: 'ambiguous',
            affectedStopIds: [],
        };
    }

    const affectedStopIds = rows.map(({ stop }) => stop.id);
    const toScan = rows.filter(
        ({ stop }) =>
            stop.pickupItemState !== DeliveryRunManifestItemStates.SCANNED,
    );
    if (toScan.length > 0) {
        await db
            .update(deliveryRunStops)
            .set({
                pickupItemState: DeliveryRunManifestItemStates.SCANNED,
                pickupResolvedAt: new Date(),
                pickupResolvedByUserId: driverUserId,
            })
            .where(
                inArray(
                    deliveryRunStops.id,
                    toScan.map(({ stop }) => stop.id),
                ),
            );
    }
    return {
        kind: DeliveryRunPickupOperationKinds.SCAN,
        outcome: toScan.length > 0 ? 'applied' : 'already-applied',
        affectedStopIds,
        itemState: DeliveryRunManifestItemStates.SCANNED,
    };
}

async function applyPickupItemOutcome({
    runId,
    pickupNodeId,
    driverUserId,
    stopId,
    outcome,
    db,
}: {
    runId: string;
    pickupNodeId: string;
    driverUserId: string;
    stopId: number;
    outcome: Exclude<DeliveryRunManifestItemState, 'scanned'>;
    db: TransactionClient;
}): Promise<DeliveryRunPickupOperationStoredResult> {
    const rows = await db
        .select({ stop: deliveryRunStops })
        .from(deliveryRunStops)
        .innerJoin(
            deliveryRunSlots,
            and(
                eq(deliveryRunStops.runId, deliveryRunSlots.runId),
                eq(deliveryRunStops.runSlotId, deliveryRunSlots.id),
            ),
        )
        .where(
            and(
                eq(deliveryRunStops.runId, runId),
                eq(deliveryRunStops.id, stopId),
                eq(deliveryRunSlots.pickupNodeId, pickupNodeId),
            ),
        );
    const stop = rows[0]?.stop;
    if (!stop || stop.pickupItemState === null) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.PICKUP_ITEM_NOT_FOUND,
            'Pickup manifest item was not found',
        );
    }
    if (
        (stop.pickupItemState === DeliveryRunManifestItemStates.SCANNED ||
            stop.pickupItemState ===
                DeliveryRunManifestItemStates.MISSING_LABEL) &&
        stop.pickupItemState !== outcome
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.PICKUP_ITEM_STATE_INVALID,
            'Collected pickup item cannot be changed',
        );
    }
    if (stop.pickupItemState === outcome) {
        return {
            kind: DeliveryRunPickupOperationKinds.MARK_ITEM,
            outcome: 'already-applied',
            affectedStopIds: [stop.id],
            itemState: outcome,
        };
    }

    await db
        .update(deliveryRunStops)
        .set(
            outcome === DeliveryRunManifestItemStates.READY
                ? {
                      pickupItemState: outcome,
                      pickupResolvedAt: null,
                      pickupResolvedByUserId: null,
                  }
                : {
                      pickupItemState: outcome,
                      pickupResolvedAt: new Date(),
                      pickupResolvedByUserId: driverUserId,
                  },
        )
        .where(eq(deliveryRunStops.id, stop.id));
    return {
        kind: DeliveryRunPickupOperationKinds.MARK_ITEM,
        outcome: 'applied',
        affectedStopIds: [stop.id],
        itemState: outcome,
    };
}

async function applyPickupManifestConfirmation({
    runId,
    pickupNodeId,
    driverUserId,
    manifestId,
    db,
}: {
    runId: string;
    pickupNodeId: string;
    driverUserId: string;
    manifestId: string;
    db: TransactionClient;
}): Promise<DeliveryRunPickupOperationStoredResult> {
    const slot = await db.query.deliveryRunSlots.findFirst({
        where: and(
            eq(deliveryRunSlots.runId, runId),
            eq(deliveryRunSlots.pickupNodeId, pickupNodeId),
            eq(deliveryRunSlots.manifestId, manifestId),
        ),
    });
    if (!slot) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.PICKUP_MANIFEST_NOT_FOUND,
            'Pickup manifest was not found',
        );
    }
    if (slot.manifestState === DeliveryRunManifestStates.CONFIRMED) {
        return {
            kind: DeliveryRunPickupOperationKinds.CONFIRM_MANIFEST,
            outcome: 'already-applied',
            affectedStopIds: [],
            manifestId,
            manifestState: DeliveryRunManifestStates.CONFIRMED,
        };
    }

    const items = await db.query.deliveryRunStops.findMany({
        columns: { id: true, pickupItemState: true },
        where: and(
            eq(deliveryRunStops.runId, runId),
            eq(deliveryRunStops.runSlotId, slot.id),
        ),
    });
    const isCollected = (state: DeliveryRunManifestItemState | null) =>
        state === DeliveryRunManifestItemStates.SCANNED ||
        state === DeliveryRunManifestItemStates.MISSING_LABEL;
    if (
        items.length === 0 ||
        items.some((item) => !isCollected(item.pickupItemState))
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.PICKUP_MANIFEST_INCOMPLETE,
            'Pickup manifest is incomplete',
        );
    }
    await db
        .update(deliveryRunSlots)
        .set({
            manifestState: DeliveryRunManifestStates.CONFIRMED,
            confirmedAt: new Date(),
            confirmedByUserId: driverUserId,
        })
        .where(eq(deliveryRunSlots.id, slot.id));
    return {
        kind: DeliveryRunPickupOperationKinds.CONFIRM_MANIFEST,
        outcome: 'applied',
        affectedStopIds: items.map((item) => item.id),
        manifestId,
        manifestState: DeliveryRunManifestStates.CONFIRMED,
    };
}

async function pickupManifestIsAlreadyConfirmed({
    runId,
    pickupNodeId,
    manifestId,
    db,
}: {
    runId: string;
    pickupNodeId: string;
    manifestId: string;
    db: DatabaseClient;
}) {
    const slot = await db.query.deliveryRunSlots.findFirst({
        columns: { manifestState: true },
        where: and(
            eq(deliveryRunSlots.runId, runId),
            eq(deliveryRunSlots.pickupNodeId, pickupNodeId),
            eq(deliveryRunSlots.manifestId, manifestId),
        ),
    });
    return slot?.manifestState === DeliveryRunManifestStates.CONFIRMED;
}

export async function applyDeliveryRunPickupMutations({
    driverUserId,
    runId,
    pickupNodeId,
    mutations,
}: {
    driverUserId: string;
    runId: string;
    pickupNodeId: string;
    mutations: DeliveryRunPickupMutation[];
}): Promise<DeliveryRunPickupMutationResult[]> {
    if (mutations.length === 0) return [];

    return await storage().transaction(async (tx) => {
        await tx.execute(
            sql`select ${deliveryRuns.id} from ${deliveryRuns} where ${deliveryRuns.id} = ${runId} for update`,
        );
        const run = await tx.query.deliveryRuns.findFirst({
            where: and(
                eq(deliveryRuns.id, runId),
                eq(deliveryRuns.driverUserId, driverUserId),
            ),
        });
        if (!run) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
                'Active delivery run was not found',
            );
        }

        const results: DeliveryRunPickupMutationResult[] = [];
        for (const inputMutation of mutations) {
            ensurePickupMutationShape(inputMutation);
            const { payloadHash, mutation } = pickupMutationPayloadHash(
                pickupNodeId,
                inputMutation,
            );
            const receipt =
                await tx.query.deliveryRunPickupOperations.findFirst({
                    where: and(
                        eq(deliveryRunPickupOperations.runId, runId),
                        eq(
                            deliveryRunPickupOperations.clientOperationId,
                            mutation.clientOperationId,
                        ),
                    ),
                });
            if (receipt) {
                if (receipt.payloadHash !== payloadHash) {
                    throw new DeliveryRunExecutionError(
                        DeliveryRunExecutionErrorCodes.PICKUP_OPERATION_CONFLICT,
                        'Pickup operation ID was reused with different content',
                    );
                }
                results.push({
                    clientOperationId: mutation.clientOperationId,
                    replayed: true,
                    result: receipt.result,
                });
                continue;
            }
            if (run.state !== DeliveryRunStates.ACTIVE) {
                throw new DeliveryRunExecutionError(
                    DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
                    'Active delivery run was not found',
                );
            }
            const alreadyConfirmed =
                mutation.kind ===
                    DeliveryRunPickupOperationKinds.CONFIRM_MANIFEST &&
                (await pickupManifestIsAlreadyConfirmed({
                    runId,
                    pickupNodeId,
                    manifestId: mutation.manifestId,
                    db: tx,
                }));
            if (!alreadyConfirmed) {
                await ensureCurrentPickupNode({ runId, pickupNodeId, db: tx });
            }

            const result =
                mutation.kind === DeliveryRunPickupOperationKinds.SCAN
                    ? await applyPickupScan({
                          runId,
                          pickupNodeId,
                          driverUserId,
                          traceToken: mutation.traceToken,
                          db: tx,
                      })
                    : mutation.kind ===
                        DeliveryRunPickupOperationKinds.MARK_ITEM
                      ? await applyPickupItemOutcome({
                            runId,
                            pickupNodeId,
                            driverUserId,
                            stopId: mutation.stopId,
                            outcome: mutation.outcome,
                            db: tx,
                        })
                      : await applyPickupManifestConfirmation({
                            runId,
                            pickupNodeId,
                            driverUserId,
                            manifestId: mutation.manifestId,
                            db: tx,
                        });
            await tx.insert(deliveryRunPickupOperations).values({
                runId,
                pickupNodeId,
                driverUserId,
                clientOperationId: mutation.clientOperationId,
                kind: mutation.kind,
                payloadHash,
                result,
                occurredAt: mutation.occurredAt,
            });
            results.push({
                clientOperationId: mutation.clientOperationId,
                replayed: false,
                result,
            });
        }
        return results;
    });
}

type DeliveryRunHandoffSnapshotStop = Pick<
    typeof deliveryRunStops.$inferSelect,
    | 'id'
    | 'deliveryRequestId'
    | 'retryAttempt'
    | 'pickupItemState'
    | 'pickupTraceLinkId'
    | 'pickupTraceToken'
    | 'handoffVerificationState'
    | 'handoffVerificationReason'
    | 'handoffVerifiedAt'
>;

function deliveryRunHandoffItemSnapshot(
    stop: DeliveryRunHandoffSnapshotStop,
): DeliveryRunHandoffItemSnapshot {
    const qrAvailable = Boolean(
        stop.pickupTraceLinkId &&
            stop.pickupTraceToken &&
            stop.pickupItemState !==
                DeliveryRunManifestItemStates.MISSING_LABEL,
    );
    const recordedState =
        stop.handoffVerificationState ??
        DeliveryRunHandoffItemStates.UNVERIFIED;
    const state =
        recordedState === DeliveryRunHandoffItemStates.UNVERIFIED &&
        !qrAvailable
            ? DeliveryRunHandoffItemStates.NO_LABEL
            : recordedState;
    return {
        stopId: stop.id,
        deliveryRequestId: stop.deliveryRequestId,
        retryAttempt: stop.retryAttempt,
        traceLinkId: stop.pickupTraceLinkId,
        qrAvailable,
        state,
        reason:
            state === DeliveryRunHandoffItemStates.SKIPPED
                ? stop.handoffVerificationReason
                : null,
        verifiedAt: stop.handoffVerifiedAt?.toISOString() ?? null,
    };
}

function deliveryRunHandoffSnapshot(
    stops: DeliveryRunHandoffSnapshotStop[],
): DeliveryRunHandoffSnapshot {
    const items = stops.map(deliveryRunHandoffItemSnapshot);
    const count = (state: DeliveryRunHandoffItemState) =>
        items.filter((item) => item.state === state).length;
    return {
        version: 1,
        retryAttempt: Math.max(0, ...items.map((item) => item.retryAttempt)),
        items,
        expectedCount: items.length,
        scannedCount: count(DeliveryRunHandoffItemStates.SCANNED),
        unverifiedCount: count(DeliveryRunHandoffItemStates.UNVERIFIED),
        noLabelCount: count(DeliveryRunHandoffItemStates.NO_LABEL),
        missingCount: count(DeliveryRunHandoffItemStates.MISSING),
        skippedCount: count(DeliveryRunHandoffItemStates.SKIPPED),
    };
}

async function deliveryRunHandoffStopGroup({
    runId,
    targetStopId,
    db,
}: {
    runId: string;
    targetStopId: number;
    db: DatabaseClient;
}) {
    const progress = await getDeliveryRunExecutionProgressFromDb(runId, db);
    const checkpoint = progress.find(
        (step) =>
            step.kind === 'delivery' && step.stopIds.includes(targetStopId),
    );
    if (checkpoint?.kind !== 'delivery') {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
            'Delivery handoff must target a delivery checkpoint',
        );
    }
    return await db.query.deliveryRunStops.findMany({
        where: and(
            eq(deliveryRunStops.runId, runId),
            inArray(deliveryRunStops.id, checkpoint.stopIds),
        ),
        orderBy: [asc(deliveryRunStops.sequence)],
    });
}

export async function getDeliveryRunHandoffManifest({
    readerUserId,
    runId,
    targetStopId,
    allowAnyRun = false,
}: {
    readerUserId: string;
    runId: string;
    targetStopId: number;
    allowAnyRun?: boolean;
}): Promise<DeliveryRunHandoffManifest> {
    if (
        !runId ||
        runId.length > 256 ||
        !Number.isSafeInteger(targetStopId) ||
        targetStopId <= 0 ||
        targetStopId > 2_147_483_647
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.HANDOFF_OPERATION_INVALID,
            'Delivery handoff manifest selection is invalid',
        );
    }
    const db = storage();
    const run = await db.query.deliveryRuns.findFirst({
        columns: { driverUserId: true },
        where: eq(deliveryRuns.id, runId),
    });
    if (!run || (!allowAnyRun && run.driverUserId !== readerUserId)) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
            'Delivery run handoff manifest was not found',
        );
    }
    const stops = await deliveryRunHandoffStopGroup({
        runId,
        targetStopId,
        db,
    });
    return {
        runId,
        targetStopId,
        ...deliveryRunHandoffSnapshot(stops),
    };
}

function normalizeDeliveryHandoffTrace(value: string) {
    const trimmed = value.trim();
    const directToken = normalizeHarvestTraceToken(trimmed);
    if (directToken) return directToken;

    let url: URL;
    try {
        url = new URL(trimmed, 'https://www.gredice.com');
    } catch {
        return null;
    }
    const isAbsolute =
        /^[A-Za-z][A-Za-z\d+.-]*:/.test(trimmed) || trimmed.startsWith('//');
    const trustedHost =
        url.hostname === 'gredice.com' || url.hostname.endsWith('.gredice.com');
    if (
        isAbsolute &&
        (url.protocol !== 'https:' ||
            !trustedHost ||
            Boolean(url.username) ||
            Boolean(url.password))
    ) {
        return null;
    }
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.length === 2 && segments[0] === 'trag'
        ? normalizeHarvestTraceToken(segments[1])
        : null;
}

const handoffOperationIdPattern = /^[A-Za-z0-9_-]{8,128}$/;
const handoffSkipReasons = new Set<string>(
    Object.values(DeliveryRunHandoffSkipReasons),
);

function normalizeDeliveryRunHandoffMutation(
    mutation: DeliveryRunHandoffMutation,
) {
    if (
        !handoffOperationIdPattern.test(mutation.clientOperationId) ||
        !(mutation.occurredAt instanceof Date) ||
        !Number.isFinite(mutation.occurredAt.getTime())
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.HANDOFF_OPERATION_INVALID,
            'Delivery handoff operation is invalid',
        );
    }
    if (mutation.kind === DeliveryRunHandoffOperationKinds.SCAN) {
        if (mutation.tracePath.length > 2_048) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.HANDOFF_OPERATION_INVALID,
                'Delivery handoff scan value is invalid',
            );
        }
        const tracePath = mutation.tracePath.trim();
        if (tracePath.length === 0 || tracePath.length > 2_048) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.HANDOFF_OPERATION_INVALID,
                'Delivery handoff scan value is invalid',
            );
        }
        return { ...mutation, tracePath };
    }
    if (
        mutation.kind !== DeliveryRunHandoffOperationKinds.MARK_ITEM ||
        !Number.isSafeInteger(mutation.stopId) ||
        mutation.stopId <= 0 ||
        mutation.stopId > 2_147_483_647 ||
        !['no-label', 'missing', 'skipped'].includes(mutation.outcome) ||
        (mutation.outcome === 'skipped'
            ? !mutation.reason || !handoffSkipReasons.has(mutation.reason)
            : mutation.reason !== undefined)
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.HANDOFF_OPERATION_INVALID,
            'Delivery handoff item result is invalid',
        );
    }
    return mutation;
}

function deliveryRunHandoffMutationPayloadHash(
    targetStopId: number,
    expectedRetryAttempt: number,
    mutation: DeliveryRunHandoffMutation,
) {
    const traceToken =
        mutation.kind === DeliveryRunHandoffOperationKinds.SCAN
            ? normalizeDeliveryHandoffTrace(mutation.tracePath)
            : null;
    const traceFingerprint =
        mutation.kind === DeliveryRunHandoffOperationKinds.SCAN
            ? traceToken
                ? `trace:${traceToken}`
                : `invalid:${hashValue(mutation.tracePath)}`
            : null;
    return {
        payloadHash: hashValue(
            JSON.stringify({
                targetStopId,
                expectedRetryAttempt,
                clientOperationId: mutation.clientOperationId,
                occurredAt: mutation.occurredAt.toISOString(),
                kind: mutation.kind,
                traceFingerprint,
                stopId:
                    mutation.kind === DeliveryRunHandoffOperationKinds.MARK_ITEM
                        ? mutation.stopId
                        : null,
                outcome:
                    mutation.kind === DeliveryRunHandoffOperationKinds.MARK_ITEM
                        ? mutation.outcome
                        : null,
                reason:
                    mutation.kind === DeliveryRunHandoffOperationKinds.MARK_ITEM
                        ? (mutation.reason ?? null)
                        : null,
            }),
        ),
        traceToken,
    };
}

async function ensureCurrentDeliveryRunHandoffStopIds({
    driverUserId,
    runId,
    targetStopId,
    expectedRetryAttempt,
    db,
}: {
    driverUserId: string;
    runId: string;
    targetStopId: number;
    expectedRetryAttempt: number;
    db: TransactionClient;
}) {
    const run = await db.query.deliveryRuns.findFirst({
        where: and(
            eq(deliveryRuns.id, runId),
            eq(deliveryRuns.driverUserId, driverUserId),
            eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
        ),
    });
    if (!run) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
            'Active delivery run was not found',
        );
    }
    const progress = await getDeliveryRunExecutionProgressFromDb(runId, db);
    const current = progress.find((step) => step.state === 'current');
    if (current?.kind === 'pickup') {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.PICKUP_DEPENDENCY_PENDING,
            'Delivery pickup dependency is pending',
        );
    }
    if (
        current?.kind !== 'delivery' ||
        !current.stopIds.includes(targetStopId)
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
            'Delivery handoff must target the current delivery checkpoint',
        );
    }
    if (!current.pickupConfirmed) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.PICKUP_DEPENDENCY_PENDING,
            'Delivery pickup dependency is pending',
        );
    }
    const currentRetryAttempt = current.retryAttempt ?? 0;
    const currentStops = await db.query.deliveryRunStops.findMany({
        columns: { id: true, retryAttempt: true },
        where: and(
            eq(deliveryRunStops.runId, runId),
            inArray(deliveryRunStops.id, current.stopIds),
        ),
    });
    if (
        currentRetryAttempt !== expectedRetryAttempt ||
        currentStops.length !== current.stopIds.length ||
        currentStops.some((stop) => stop.retryAttempt !== expectedRetryAttempt)
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
            'Delivery handoff retry attempt changed. Refresh the active run and retry.',
        );
    }
    return current.stopIds;
}

async function applyDeliveryRunHandoffScan({
    runId,
    currentStopIds,
    driverUserId,
    traceToken,
    occurredAt,
    db,
}: {
    runId: string;
    currentStopIds: number[];
    driverUserId: string;
    traceToken: string | null;
    occurredAt: Date;
    db: TransactionClient;
}): Promise<DeliveryRunHandoffOperationStoredResult> {
    if (!traceToken) {
        return {
            kind: DeliveryRunHandoffOperationKinds.SCAN,
            outcome: 'invalid',
            affectedStopIds: [],
        };
    }
    const rows = await db.query.deliveryRunStops.findMany({
        where: and(
            eq(deliveryRunStops.runId, runId),
            eq(deliveryRunStops.pickupTraceToken, traceToken),
        ),
        orderBy: [asc(deliveryRunStops.sequence)],
    });
    if (rows.length === 0) {
        return {
            kind: DeliveryRunHandoffOperationKinds.SCAN,
            outcome: 'invalid',
            affectedStopIds: [],
        };
    }
    const currentIds = new Set(currentStopIds);
    const matchingStops = rows.filter((stop) => currentIds.has(stop.id));
    if (matchingStops.length === 0) {
        return {
            kind: DeliveryRunHandoffOperationKinds.SCAN,
            outcome: 'wrong-stop',
            affectedStopIds: [],
        };
    }
    const alreadyScanned = matchingStops.filter(
        (stop) =>
            stop.handoffVerificationState ===
            DeliveryRunHandoffItemStates.SCANNED,
    );
    const stale = matchingStops.filter(
        (stop) =>
            stop.handoffVerificationState !==
                DeliveryRunHandoffItemStates.SCANNED &&
            Boolean(
                stop.handoffVerifiedAt && stop.handoffVerifiedAt >= occurredAt,
            ),
    );
    const staleIds = new Set(stale.map((stop) => stop.id));
    const alreadyScannedIds = new Set(alreadyScanned.map((stop) => stop.id));
    const toUpdate = matchingStops.filter(
        (stop) => !staleIds.has(stop.id) && !alreadyScannedIds.has(stop.id),
    );
    if (toUpdate.length > 0) {
        await db
            .update(deliveryRunStops)
            .set({
                handoffVerificationState: DeliveryRunHandoffItemStates.SCANNED,
                handoffVerificationReason: null,
                handoffVerifiedAt: occurredAt,
                handoffVerifiedByUserId: driverUserId,
            })
            .where(
                and(
                    eq(deliveryRunStops.runId, runId),
                    inArray(
                        deliveryRunStops.id,
                        toUpdate.map((stop) => stop.id),
                    ),
                ),
            );
    }
    return {
        kind: DeliveryRunHandoffOperationKinds.SCAN,
        outcome:
            toUpdate.length > 0
                ? 'applied'
                : stale.length > 0
                  ? 'stale'
                  : 'already-applied',
        affectedStopIds:
            toUpdate.length > 0
                ? toUpdate.map((stop) => stop.id)
                : matchingStops.map((stop) => stop.id),
        itemState: DeliveryRunHandoffItemStates.SCANNED,
    };
}

async function applyDeliveryRunHandoffItemResult({
    runId,
    currentStopIds,
    driverUserId,
    mutation,
    db,
}: {
    runId: string;
    currentStopIds: number[];
    driverUserId: string;
    mutation: Extract<DeliveryRunHandoffMutation, { kind: 'mark-item' }>;
    db: TransactionClient;
}): Promise<DeliveryRunHandoffOperationStoredResult> {
    const stop = await db.query.deliveryRunStops.findFirst({
        where: and(
            eq(deliveryRunStops.runId, runId),
            eq(deliveryRunStops.id, mutation.stopId),
        ),
    });
    if (!stop) {
        return {
            kind: DeliveryRunHandoffOperationKinds.MARK_ITEM,
            outcome: 'item-not-found',
            affectedStopIds: [],
        };
    }
    if (!currentStopIds.includes(stop.id)) {
        return {
            kind: DeliveryRunHandoffOperationKinds.MARK_ITEM,
            outcome: 'wrong-stop',
            affectedStopIds: [],
        };
    }
    const state = mutation.outcome;
    const reason =
        state === DeliveryRunHandoffItemStates.SKIPPED
            ? mutation.reason
            : undefined;
    const alreadyApplied =
        stop.handoffVerificationState === state &&
        (stop.handoffVerificationReason ?? undefined) === reason;
    const stale = Boolean(
        !alreadyApplied &&
            stop.handoffVerifiedAt &&
            stop.handoffVerifiedAt >= mutation.occurredAt,
    );
    if (!alreadyApplied && !stale) {
        await db
            .update(deliveryRunStops)
            .set({
                handoffVerificationState: state,
                handoffVerificationReason: reason ?? null,
                handoffVerifiedAt: mutation.occurredAt,
                handoffVerifiedByUserId: driverUserId,
            })
            .where(
                and(
                    eq(deliveryRunStops.runId, runId),
                    eq(deliveryRunStops.id, stop.id),
                ),
            );
    }
    return {
        kind: DeliveryRunHandoffOperationKinds.MARK_ITEM,
        outcome: alreadyApplied
            ? 'already-applied'
            : stale
              ? 'stale'
              : 'applied',
        affectedStopIds: [stop.id],
        itemState: state,
        ...(reason ? { reason } : {}),
    };
}

export async function applyDeliveryRunHandoffMutations({
    driverUserId,
    runId,
    targetStopId,
    expectedRetryAttempt,
    mutations,
}: {
    driverUserId: string;
    runId: string;
    targetStopId: number;
    expectedRetryAttempt: number;
    mutations: DeliveryRunHandoffMutation[];
}): Promise<DeliveryRunHandoffMutationResult[]> {
    if (
        !runId ||
        runId.length > 256 ||
        !Number.isSafeInteger(targetStopId) ||
        targetStopId <= 0 ||
        targetStopId > 2_147_483_647 ||
        !Number.isSafeInteger(expectedRetryAttempt) ||
        expectedRetryAttempt < 0 ||
        mutations.length === 0 ||
        mutations.length > 100
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.HANDOFF_OPERATION_INVALID,
            'Delivery handoff mutation batch is invalid',
        );
    }
    return await storage().transaction(async (tx) => {
        await lockDeliveryRun(runId, tx);
        let currentStopIds: number[] | undefined;
        const results: DeliveryRunHandoffMutationResult[] = [];
        for (const inputMutation of mutations) {
            const mutation = normalizeDeliveryRunHandoffMutation(inputMutation);
            const { payloadHash, traceToken } =
                deliveryRunHandoffMutationPayloadHash(
                    targetStopId,
                    expectedRetryAttempt,
                    mutation,
                );
            const receipt =
                await tx.query.deliveryRunHandoffOperations.findFirst({
                    where: and(
                        eq(deliveryRunHandoffOperations.runId, runId),
                        eq(
                            deliveryRunHandoffOperations.clientOperationId,
                            mutation.clientOperationId,
                        ),
                    ),
                });
            if (receipt) {
                if (
                    receipt.driverUserId !== driverUserId ||
                    receipt.payloadHash !== payloadHash
                ) {
                    throw new DeliveryRunExecutionError(
                        DeliveryRunExecutionErrorCodes.HANDOFF_OPERATION_CONFLICT,
                        'Delivery handoff operation ID was reused with different content',
                    );
                }
                results.push({
                    clientOperationId: mutation.clientOperationId,
                    retryAttempt: receipt.retryAttempt,
                    replayed: true,
                    result: receipt.result,
                });
                continue;
            }
            if (
                !deliveryRunStopOperationOccurredAtIsAcceptable(
                    mutation.occurredAt,
                )
            ) {
                throw new DeliveryRunExecutionError(
                    DeliveryRunExecutionErrorCodes.HANDOFF_OPERATION_INVALID,
                    'Delivery handoff occurrence time is outside the accepted range',
                );
            }
            currentStopIds ??= await ensureCurrentDeliveryRunHandoffStopIds({
                driverUserId,
                runId,
                targetStopId,
                expectedRetryAttempt,
                db: tx,
            });
            const result =
                mutation.kind === DeliveryRunHandoffOperationKinds.SCAN
                    ? await applyDeliveryRunHandoffScan({
                          runId,
                          currentStopIds,
                          driverUserId,
                          traceToken,
                          occurredAt: mutation.occurredAt,
                          db: tx,
                      })
                    : await applyDeliveryRunHandoffItemResult({
                          runId,
                          currentStopIds,
                          driverUserId,
                          mutation,
                          db: tx,
                      });
            const appliedAt = new Date();
            await tx.insert(deliveryRunHandoffOperations).values({
                runId,
                targetStopId,
                retryAttempt: expectedRetryAttempt,
                driverUserId,
                clientOperationId: mutation.clientOperationId,
                kind: mutation.kind,
                payloadHash,
                result,
                occurredAt: mutation.occurredAt,
                appliedAt,
            });
            results.push({
                clientOperationId: mutation.clientOperationId,
                retryAttempt: expectedRetryAttempt,
                replayed: false,
                result,
            });
        }
        return results;
    });
}

export const deliveryRunHandoffOperationRetentionMs = 90 * 24 * 60 * 60 * 1000;

export async function pruneExpiredDeliveryRunHandoffOperations(
    now = new Date(),
    limit = 250,
) {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 1_000);
    const cutoff = new Date(
        now.getTime() - deliveryRunHandoffOperationRetentionMs,
    );
    const db = storage();
    const candidates = await db
        .select({ id: deliveryRunHandoffOperations.id })
        .from(deliveryRunHandoffOperations)
        .innerJoin(
            deliveryRuns,
            eq(deliveryRunHandoffOperations.runId, deliveryRuns.id),
        )
        .where(
            and(
                isNotNull(deliveryRuns.completedAt),
                lte(deliveryRuns.completedAt, cutoff),
            ),
        )
        .orderBy(asc(deliveryRunHandoffOperations.appliedAt))
        .limit(boundedLimit);
    if (candidates.length === 0) return 0;
    const deleted = await db
        .delete(deliveryRunHandoffOperations)
        .where(
            inArray(
                deliveryRunHandoffOperations.id,
                candidates.map(({ id }) => id),
            ),
        )
        .returning({ id: deliveryRunHandoffOperations.id });
    return deleted.length;
}

const deliveryRunExceptionOutcomes = new Set<string>(
    Object.values(DeliveryRunExceptionOutcomes),
);
const deliveryRunExceptionReasons = new Set<string>(
    Object.values(DeliveryRunExceptionReasons),
);
const deliveryRunTerminalStopStates: DeliveryRunStopState[] = [
    DeliveryRunStopStates.DELIVERED,
    DeliveryRunStopStates.FAILED,
    DeliveryRunStopStates.CANCELLED,
];

export function deliveryRunStopsAllowCompletion(states: readonly string[]) {
    return (
        states.length > 0 &&
        states.every((state) => isDeliveryRunStopTerminal(state))
    );
}

async function completeDeliveryRunIfEligible({
    runId,
    completedAt,
    db,
}: {
    runId: string;
    completedAt: Date;
    db: TransactionClient;
}) {
    const remaining = await db.query.deliveryRunStops.findFirst({
        columns: { id: true },
        where: and(
            eq(deliveryRunStops.runId, runId),
            notInArray(deliveryRunStops.state, deliveryRunTerminalStopStates),
        ),
    });
    if (remaining) return false;

    await db
        .update(deliveryRunStops)
        .set({ releasedAt: completedAt })
        .where(
            and(
                eq(deliveryRunStops.runId, runId),
                isNull(deliveryRunStops.releasedAt),
                inArray(deliveryRunStops.state, deliveryRunTerminalStopStates),
            ),
        );

    const [completedRun] = await db
        .update(deliveryRuns)
        .set({
            state: DeliveryRunStates.COMPLETED,
            completedAt,
            rerouteRequiredAt: null,
            rerouteAttemptedAt: null,
            currentLatitude: null,
            currentLongitude: null,
            currentLocationAccuracy: null,
            currentLocationHeading: null,
            currentLocationSpeed: null,
            currentLocationRecordedAt: null,
            currentLocationReceivedAt: null,
        })
        .where(
            and(
                eq(deliveryRuns.id, runId),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
            ),
        )
        .returning({ id: deliveryRuns.id });
    return Boolean(completedRun);
}

type NormalizedDeliveryRunStopException = Omit<
    DeliveryRunStopExceptionInput,
    'note'
> & {
    note?: string;
};

type NormalizedRecordDeliveryRunStopExceptionsInput = Omit<
    RecordDeliveryRunStopExceptionsInput,
    'clientOperationId' | 'exceptions'
> & {
    clientOperationId: string;
    exceptions: NormalizedDeliveryRunStopException[];
};

function invalidDeliveryRunException(message: string): never {
    throw new DeliveryRunExecutionError(
        DeliveryRunExecutionErrorCodes.EXCEPTION_INVALID,
        message,
    );
}

function normalizeDeliveryRunStopExceptionInput(
    input: RecordDeliveryRunStopExceptionsInput,
): NormalizedRecordDeliveryRunStopExceptionsInput {
    const clientOperationId = input.clientOperationId.trim();
    if (clientOperationId.length === 0 || clientOperationId.length > 128) {
        invalidDeliveryRunException(
            'Delivery exception operation ID must contain 1 to 128 characters',
        );
    }
    if (
        !(input.occurredAt instanceof Date) ||
        !Number.isFinite(input.occurredAt.getTime())
    ) {
        invalidDeliveryRunException(
            'Delivery exception occurrence time is invalid',
        );
    }
    if (
        input.expectedRouteRevision !== undefined &&
        (!Number.isInteger(input.expectedRouteRevision) ||
            input.expectedRouteRevision < 0)
    ) {
        invalidDeliveryRunException('Delivery route revision is invalid');
    }
    if (!Array.isArray(input.exceptions) || input.exceptions.length === 0) {
        invalidDeliveryRunException(
            'Delivery exception command must contain at least one item',
        );
    }

    const stopIds = new Set<number>();
    const exceptions = input.exceptions.map((exception) => {
        if (!Number.isInteger(exception.stopId) || exception.stopId <= 0) {
            invalidDeliveryRunException(
                'Delivery exception stop ID is invalid',
            );
        }
        if (stopIds.has(exception.stopId)) {
            invalidDeliveryRunException(
                'Delivery exception command contains a duplicate stop',
            );
        }
        stopIds.add(exception.stopId);
        if (!deliveryRunExceptionOutcomes.has(exception.outcome)) {
            invalidDeliveryRunException(
                'Delivery exception outcome is invalid',
            );
        }
        if (!deliveryRunExceptionReasons.has(exception.reason)) {
            invalidDeliveryRunException('Delivery exception reason is invalid');
        }
        if (
            (exception.outcome === DeliveryRunExceptionOutcomes.CANCELLED) !==
            (exception.reason === DeliveryRunExceptionReasons.CANCELLATION)
        ) {
            invalidDeliveryRunException(
                'Cancellation outcomes and reasons must be recorded together',
            );
        }
        const note = exception.note?.trim();
        if (note && note.length > 1000) {
            invalidDeliveryRunException(
                'Delivery exception note must not exceed 1000 characters',
            );
        }
        return {
            stopId: exception.stopId,
            outcome: exception.outcome,
            reason: exception.reason,
            ...(note ? { note } : {}),
        };
    });
    exceptions.sort((first, second) => first.stopId - second.stopId);

    return {
        ...input,
        clientOperationId,
        exceptions,
    };
}

function deliveryRunStopExceptionPayloadHash(
    input: NormalizedRecordDeliveryRunStopExceptionsInput,
) {
    return hashValue(
        JSON.stringify({
            clientOperationId: input.clientOperationId,
            expectedRouteRevision: input.expectedRouteRevision,
            occurredAt: input.occurredAt.toISOString(),
            exceptions: input.exceptions,
        }),
    );
}

function deliveryRunExceptionTransitionIsAllowed(
    state: string,
    outcome: DeliveryRunExceptionOutcome,
) {
    if (
        state === DeliveryRunStopStates.PENDING ||
        state === DeliveryRunStopStates.ARRIVED
    ) {
        return true;
    }
    return (
        state === DeliveryRunStopStates.DEFERRED &&
        (outcome === DeliveryRunExceptionOutcomes.FAILED ||
            outcome === DeliveryRunExceptionOutcomes.CANCELLED)
    );
}

function exceptionReceiptResult({
    receipt,
    driverUserId,
    payloadHash,
}: {
    receipt: typeof deliveryRunExceptionOperations.$inferSelect;
    driverUserId: string;
    payloadHash: string;
}): RecordDeliveryRunStopExceptionsResult {
    if (
        receipt.driverUserId !== driverUserId ||
        receipt.payloadHash !== payloadHash
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.EXCEPTION_OPERATION_CONFLICT,
            'Delivery exception operation ID was reused with different content',
        );
    }
    return {
        clientOperationId: receipt.clientOperationId,
        replayed: true,
        result: receipt.result,
    };
}

async function recordDeliveryRunStopExceptionsInDatabase(
    input: NormalizedRecordDeliveryRunStopExceptionsInput,
    db: TransactionClient,
): Promise<RecordDeliveryRunStopExceptionsResult> {
    const payloadHash = deliveryRunStopExceptionPayloadHash(input);
    const existingReceipt =
        await db.query.deliveryRunExceptionOperations.findFirst({
            where: and(
                eq(deliveryRunExceptionOperations.runId, input.runId),
                eq(
                    deliveryRunExceptionOperations.clientOperationId,
                    input.clientOperationId,
                ),
            ),
        });
    if (existingReceipt) {
        return exceptionReceiptResult({
            receipt: existingReceipt,
            driverUserId: input.driverUserId,
            payloadHash,
        });
    }

    await db.execute(
        sql`select ${deliveryRuns.id} from ${deliveryRuns} where ${deliveryRuns.id} = ${input.runId} for update`,
    );
    const receiptAfterLock =
        await db.query.deliveryRunExceptionOperations.findFirst({
            where: and(
                eq(deliveryRunExceptionOperations.runId, input.runId),
                eq(
                    deliveryRunExceptionOperations.clientOperationId,
                    input.clientOperationId,
                ),
            ),
        });
    if (receiptAfterLock) {
        return exceptionReceiptResult({
            receipt: receiptAfterLock,
            driverUserId: input.driverUserId,
            payloadHash,
        });
    }

    const run = await db.query.deliveryRuns.findFirst({
        where: eq(deliveryRuns.id, input.runId),
    });
    if (
        !run ||
        run.driverUserId !== input.driverUserId ||
        run.state !== DeliveryRunStates.ACTIVE
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
            'Active delivery run was not found',
        );
    }
    if (
        input.expectedRouteRevision !== undefined &&
        run.routeRevision !== input.expectedRouteRevision
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
            'Delivery route changed. Refresh the active run and retry.',
        );
    }

    const progress = await getDeliveryRunExecutionProgressFromDb(
        input.runId,
        db,
    );
    const current = progress.find((step) => step.state === 'current');
    if (current?.kind === 'pickup' || !current?.pickupConfirmed) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.PICKUP_DEPENDENCY_PENDING,
            'Delivery pickup dependency is pending',
        );
    }
    if (current.kind !== 'delivery') {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
            'Delivery exceptions must target the current delivery checkpoint',
        );
    }
    const currentStopIds = new Set(current.stopIds);
    if (
        input.exceptions.some(
            (exception) => !currentStopIds.has(exception.stopId),
        )
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
            'Delivery exceptions must target items in the current execution checkpoint',
        );
    }

    const stops = await db.query.deliveryRunStops.findMany({
        where: and(
            eq(deliveryRunStops.runId, input.runId),
            inArray(
                deliveryRunStops.id,
                input.exceptions.map((exception) => exception.stopId),
            ),
        ),
        orderBy: [asc(deliveryRunStops.sequence)],
    });
    if (stops.length !== input.exceptions.length) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
            'Delivery exception item was not found in the current checkpoint',
        );
    }
    const requestSnapshots = await getDeliveryRequestDispatchSnapshots(
        stops.map((stop) => stop.deliveryRequestId),
        db,
    );
    if (
        requestSnapshots.length !== stops.length ||
        requestSnapshots.some(
            (snapshot) =>
                snapshot.state === DeliveryRequestStates.FULFILLED ||
                snapshot.state === DeliveryRequestStates.CANCELLED,
        )
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.EXCEPTION_TRANSITION_INVALID,
            'Fulfilled or cancelled delivery requests cannot receive exception outcomes',
        );
    }
    const exceptionsByStopId = new Map(
        input.exceptions.map((exception) => [exception.stopId, exception]),
    );
    for (const stop of stops) {
        const exception = exceptionsByStopId.get(stop.id);
        if (
            !exception ||
            !deliveryRunExceptionTransitionIsAllowed(
                stop.state,
                exception.outcome,
            )
        ) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.EXCEPTION_TRANSITION_INVALID,
                `Delivery stop ${stop.id} cannot transition from ${stop.state} to an exception outcome`,
            );
        }
    }

    const defersCheckpoint = input.exceptions.some(
        (exception) =>
            exception.outcome === DeliveryRunExceptionOutcomes.DEFERRED,
    );
    const sourceStop = stops[0];
    const retryLaneRank =
        defersCheckpoint && sourceStop
            ? await retryLaneRankForStop(sourceStop, db)
            : 0;

    for (const stop of stops) {
        const exception = exceptionsByStopId.get(stop.id);
        if (!exception) continue;
        const [updatedStop] = await db
            .update(deliveryRunStops)
            .set({
                state: exception.outcome,
                exceptionReason: exception.reason,
                exceptionNote: exception.note ?? null,
                exceptionOccurredAt: input.occurredAt,
                exceptionRecordedByUserId: input.driverUserId,
                ...(exception.outcome === DeliveryRunExceptionOutcomes.DEFERRED
                    ? {
                          retryLaneRank,
                          retryAttempt: stop.retryAttempt + 1,
                          handoffVerificationState:
                              DeliveryRunHandoffItemStates.UNVERIFIED,
                          handoffVerificationReason: null,
                          handoffVerifiedAt: null,
                          handoffVerifiedByUserId: null,
                      }
                    : exception.outcome ===
                        DeliveryRunExceptionOutcomes.CANCELLED
                      ? { releasedAt: input.occurredAt }
                      : {}),
            })
            .where(
                and(
                    eq(deliveryRunStops.id, stop.id),
                    eq(deliveryRunStops.state, stop.state),
                ),
            )
            .returning({ id: deliveryRunStops.id });
        if (!updatedStop) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.EXCEPTION_TRANSITION_INVALID,
                `Delivery stop ${stop.id} changed before the exception could be recorded`,
            );
        }
    }

    const appliedAt = new Date();
    const [updatedRun] = await db
        .update(deliveryRuns)
        .set({
            routeRevision: sql`${deliveryRuns.routeRevision} + 1`,
            rerouteRequiredAt: appliedAt,
            rerouteAttemptedAt: null,
        })
        .where(
            and(
                eq(deliveryRuns.id, input.runId),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
            ),
        )
        .returning({ routeRevision: deliveryRuns.routeRevision });
    if (!updatedRun) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
            'Active delivery run was not found',
        );
    }
    const runCompleted = await completeDeliveryRunIfEligible({
        runId: input.runId,
        completedAt: appliedAt,
        db,
    });

    const outcomes = stops.map((stop) => {
        const exception = exceptionsByStopId.get(stop.id);
        if (!exception) {
            throw new Error('Delivery exception item was not found');
        }
        return {
            stopId: stop.id,
            deliveryRequestId: stop.deliveryRequestId,
            outcome: exception.outcome,
            reason: exception.reason,
        };
    });
    const result: DeliveryRunExceptionOperationStoredResult = {
        outcomes,
        runCompleted,
        routeRevision: updatedRun.routeRevision,
        reroutePending: !runCompleted,
    };

    for (const stop of stops) {
        const exception = exceptionsByStopId.get(stop.id);
        if (!exception) continue;
        await createEvent(
            knownEvents.delivery.requestExceptionRecordedV1(
                stop.deliveryRequestId,
                {
                    runId: input.runId,
                    stopId: stop.id,
                    clientOperationId: input.clientOperationId,
                    outcome: exception.outcome,
                    reason: exception.reason,
                    retryable:
                        exception.outcome ===
                        DeliveryRunExceptionOutcomes.DEFERRED,
                    ...(exception.note ? { note: exception.note } : {}),
                    occurredAt: input.occurredAt.toISOString(),
                    recordedByUserId: input.driverUserId,
                    routeRevision: updatedRun.routeRevision,
                },
            ),
            db,
        );
    }
    await db.insert(deliveryRunExceptionOperations).values({
        runId: input.runId,
        driverUserId: input.driverUserId,
        clientOperationId: input.clientOperationId,
        payloadHash,
        result,
        occurredAt: input.occurredAt,
    });

    return {
        clientOperationId: input.clientOperationId,
        replayed: false,
        result,
    };
}

export async function recordDeliveryRunStopExceptions(
    input: RecordDeliveryRunStopExceptionsInput,
    db?: DeliveryRunTransactionClient,
): Promise<RecordDeliveryRunStopExceptionsResult> {
    const normalized = normalizeDeliveryRunStopExceptionInput(input);
    if (db) {
        await acquireDeliveryDispatchLock(db);
        return await recordDeliveryRunStopExceptionsInDatabase(normalized, db);
    }
    return await withDeliveryDispatchTransaction(async (tx) =>
        recordDeliveryRunStopExceptionsInDatabase(normalized, tx),
    );
}

function ensureRouteRevisionInput(value: number) {
    if (!Number.isInteger(value) || value < 0) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
            'Delivery route revision is invalid',
        );
    }
}

function assertRouteRevision(current: number, expected: number) {
    if (current !== expected) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
            'Delivery route changed. Refresh the active run and retry.',
        );
    }
}

async function nextDeliveryRunRetryLaneRank(
    runId: string,
    db: TransactionClient,
) {
    const [row] = await db
        .select({
            value: sql<number>`coalesce(max(${deliveryRunStops.retryLaneRank}), 0) + 1`,
        })
        .from(deliveryRunStops)
        .where(eq(deliveryRunStops.runId, runId));
    return Number(row?.value ?? 1);
}

async function retryLaneRankForStop(
    stop: typeof deliveryRunStops.$inferSelect,
    db: TransactionClient,
) {
    const samePhysicalStop = stop.stopKey
        ? eq(deliveryRunStops.stopKey, stop.stopKey)
        : and(
              isNull(deliveryRunStops.stopKey),
              eq(deliveryRunStops.formattedAddress, stop.formattedAddress),
          );
    if (stop.retryLaneRank !== null) {
        const reusableNextAttempt = await db.query.deliveryRunStops.findFirst({
            columns: { retryLaneRank: true },
            where: and(
                eq(deliveryRunStops.runId, stop.runId),
                samePhysicalStop,
                isNotNull(deliveryRunStops.retryLaneRank),
                isNull(deliveryRunStops.releasedAt),
                eq(deliveryRunStops.retryAttempt, stop.retryAttempt + 1),
                inArray(deliveryRunStops.state, [
                    DeliveryRunStopStates.PENDING,
                    DeliveryRunStopStates.ARRIVED,
                    DeliveryRunStopStates.DEFERRED,
                ]),
            ),
            orderBy: [asc(deliveryRunStops.retryLaneRank)],
        });
        return (
            reusableNextAttempt?.retryLaneRank ??
            (await nextDeliveryRunRetryLaneRank(stop.runId, db))
        );
    }
    const reusable = await db.query.deliveryRunStops.findFirst({
        columns: { retryLaneRank: true },
        where: and(
            eq(deliveryRunStops.runId, stop.runId),
            samePhysicalStop,
            isNotNull(deliveryRunStops.retryLaneRank),
            isNull(deliveryRunStops.releasedAt),
            inArray(deliveryRunStops.state, [
                DeliveryRunStopStates.PENDING,
                DeliveryRunStopStates.ARRIVED,
                DeliveryRunStopStates.DEFERRED,
            ]),
        ),
        orderBy: [asc(deliveryRunStops.retryLaneRank)],
    });
    return (
        reusable?.retryLaneRank ??
        (await nextDeliveryRunRetryLaneRank(stop.runId, db))
    );
}

export type RetryDeliveryRunStopResult = {
    stopIds: number[];
    routeRevision: number;
    reroutePending: true;
};

export async function retryDeliveryRunStop({
    driverUserId,
    runId,
    stopId,
    expectedRouteRevision,
    occurredAt = new Date(),
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
    expectedRouteRevision: number;
    occurredAt?: Date;
}): Promise<RetryDeliveryRunStopResult> {
    ensureRouteRevisionInput(expectedRouteRevision);
    return await withDeliveryDispatchTransaction(async (tx) => {
        await tx.execute(
            sql`select ${deliveryRuns.id} from ${deliveryRuns} where ${deliveryRuns.id} = ${runId} for update`,
        );
        const run = await tx.query.deliveryRuns.findFirst({
            where: eq(deliveryRuns.id, runId),
        });
        if (
            !run ||
            run.state !== DeliveryRunStates.ACTIVE ||
            run.driverUserId !== driverUserId
        ) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
                'Active delivery run was not found',
            );
        }
        assertRouteRevision(run.routeRevision, expectedRouteRevision);

        const progress = await getDeliveryRunExecutionProgressFromDb(runId, tx);
        const current = progress.find((step) => step.state === 'current');
        if (
            current?.kind !== 'delivery' ||
            current.retryLaneRank === undefined ||
            !current.stopIds.includes(stopId)
        ) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
                'Deferred delivery retry is not the current checkpoint',
            );
        }
        const stops = await tx.query.deliveryRunStops.findMany({
            where: and(
                eq(deliveryRunStops.runId, runId),
                inArray(deliveryRunStops.id, current.stopIds),
                eq(deliveryRunStops.state, DeliveryRunStopStates.DEFERRED),
                isNull(deliveryRunStops.releasedAt),
            ),
            orderBy: [asc(deliveryRunStops.sequence)],
        });
        if (stops.length === 0) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.EXCEPTION_TRANSITION_INVALID,
                'Deferred delivery checkpoint is no longer retryable',
            );
        }
        if (!stops.some((stop) => stop.id === stopId)) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.EXCEPTION_TRANSITION_INVALID,
                'Only a deferred delivery stop can start its retry checkpoint',
            );
        }

        await tx
            .update(deliveryRunStops)
            .set({
                state: DeliveryRunStopStates.PENDING,
                arrivedAt: null,
                deliveredAt: null,
                exceptionReason: null,
                exceptionNote: null,
                exceptionOccurredAt: null,
                exceptionRecordedByUserId: null,
                handoffVerificationState:
                    DeliveryRunHandoffItemStates.UNVERIFIED,
                handoffVerificationReason: null,
                handoffVerifiedAt: null,
                handoffVerifiedByUserId: null,
            })
            .where(
                inArray(
                    deliveryRunStops.id,
                    stops.map((stop) => stop.id),
                ),
            );
        const [updatedRun] = await tx
            .update(deliveryRuns)
            .set({
                routeRevision: sql`${deliveryRuns.routeRevision} + 1`,
                rerouteRequiredAt: occurredAt,
                rerouteAttemptedAt: null,
            })
            .where(
                and(
                    eq(deliveryRuns.id, runId),
                    eq(deliveryRuns.routeRevision, expectedRouteRevision),
                    eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                ),
            )
            .returning({ routeRevision: deliveryRuns.routeRevision });
        if (!updatedRun) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
                'Delivery route changed. Refresh the active run and retry.',
            );
        }
        for (const stop of stops) {
            await createEvent(
                knownEvents.delivery.requestExceptionRecoveredV1(
                    stop.deliveryRequestId,
                    {
                        runId,
                        stopId: stop.id,
                        recovery: 'retry',
                        recoveredAt: occurredAt.toISOString(),
                        recoveredByUserId: driverUserId,
                        routeRevision: updatedRun.routeRevision,
                    },
                ),
                tx,
            );
        }
        return {
            stopIds: stops.map((stop) => stop.id),
            routeRevision: updatedRun.routeRevision,
            reroutePending: true,
        };
    });
}

export type RecoverDeliveryRunStopResult = {
    requestId: string;
    routeRevision: number;
    resumedInRun: boolean;
    reroutePending: boolean;
};

export async function recoverDeliveryRunStop({
    adminUserId,
    runId,
    stopId,
    expectedRouteRevision,
    occurredAt = new Date(),
}: {
    adminUserId: string;
    runId: string;
    stopId: number;
    expectedRouteRevision: number;
    occurredAt?: Date;
}): Promise<RecoverDeliveryRunStopResult> {
    ensureRouteRevisionInput(expectedRouteRevision);
    return await withDeliveryDispatchTransaction(async (tx) => {
        await tx.execute(
            sql`select ${deliveryRuns.id} from ${deliveryRuns} where ${deliveryRuns.id} = ${runId} for update`,
        );
        const run = await tx.query.deliveryRuns.findFirst({
            where: eq(deliveryRuns.id, runId),
        });
        if (!run) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
                'Delivery run was not found',
            );
        }
        assertRouteRevision(run.routeRevision, expectedRouteRevision);
        const stop = await tx.query.deliveryRunStops.findFirst({
            where: and(
                eq(deliveryRunStops.id, stopId),
                eq(deliveryRunStops.runId, runId),
            ),
        });
        if (!stop || stop.state !== DeliveryRunStopStates.FAILED) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.EXCEPTION_TRANSITION_INVALID,
                'Only a failed delivery stop can be recovered',
            );
        }
        const [request, latestStop] = await Promise.all([
            getDeliveryRequest(stop.deliveryRequestId, tx),
            tx.query.deliveryRunStops.findFirst({
                columns: { id: true },
                where: eq(
                    deliveryRunStops.deliveryRequestId,
                    stop.deliveryRequestId,
                ),
                orderBy: [desc(deliveryRunStops.id)],
            }),
        ]);
        if (
            request?.state !== DeliveryRequestStates.FAILED ||
            latestStop?.id !== stop.id
        ) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.EXCEPTION_TRANSITION_INVALID,
                'Failed delivery recovery is stale or already applied',
            );
        }

        const resumedInRun = run.state === DeliveryRunStates.ACTIVE;
        if (resumedInRun) {
            const retryLaneRank = await retryLaneRankForStop(stop, tx);
            await tx
                .update(deliveryRunStops)
                .set({
                    state: DeliveryRunStopStates.PENDING,
                    retryLaneRank,
                    retryAttempt: stop.retryAttempt + 1,
                    arrivedAt: null,
                    deliveredAt: null,
                    exceptionReason: null,
                    exceptionNote: null,
                    exceptionOccurredAt: null,
                    exceptionRecordedByUserId: null,
                    handoffVerificationState:
                        DeliveryRunHandoffItemStates.UNVERIFIED,
                    handoffVerificationReason: null,
                    handoffVerifiedAt: null,
                    handoffVerifiedByUserId: null,
                    releasedAt: null,
                })
                .where(
                    and(
                        eq(deliveryRunStops.id, stop.id),
                        eq(
                            deliveryRunStops.state,
                            DeliveryRunStopStates.FAILED,
                        ),
                    ),
                );
        }
        const [updatedRun] = await tx
            .update(deliveryRuns)
            .set({
                routeRevision: sql`${deliveryRuns.routeRevision} + 1`,
                ...(resumedInRun
                    ? {
                          rerouteRequiredAt: occurredAt,
                          rerouteAttemptedAt: null,
                      }
                    : {}),
            })
            .where(
                and(
                    eq(deliveryRuns.id, runId),
                    eq(deliveryRuns.routeRevision, expectedRouteRevision),
                ),
            )
            .returning({ routeRevision: deliveryRuns.routeRevision });
        if (!updatedRun) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
                'Delivery route changed. Refresh the delivery run and retry.',
            );
        }
        await createEvent(
            knownEvents.delivery.requestExceptionRecoveredV1(
                stop.deliveryRequestId,
                {
                    runId,
                    stopId: stop.id,
                    recovery: 'admin-recovery',
                    recoveredAt: occurredAt.toISOString(),
                    recoveredByUserId: adminUserId,
                    routeRevision: updatedRun.routeRevision,
                },
            ),
            tx,
        );
        return {
            requestId: stop.deliveryRequestId,
            routeRevision: updatedRun.routeRevision,
            resumedInRun,
            reroutePending: resumedInRun,
        };
    });
}

export async function reassignDeliveryRun({
    adminUserId,
    runId,
    newDriverUserId,
    expectedRouteRevision,
    occurredAt = new Date(),
}: {
    adminUserId: string;
    runId: string;
    newDriverUserId: string;
    expectedRouteRevision: number;
    occurredAt?: Date;
}) {
    ensureRouteRevisionInput(expectedRouteRevision);
    return await withDeliveryDispatchTransaction(async (tx) => {
        await tx.execute(
            sql`select ${deliveryRuns.id} from ${deliveryRuns} where ${deliveryRuns.id} = ${runId} for update`,
        );
        const run = await tx.query.deliveryRuns.findFirst({
            where: eq(deliveryRuns.id, runId),
        });
        if (!run || run.state !== DeliveryRunStates.ACTIVE) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
                'Active delivery run was not found',
            );
        }
        assertRouteRevision(run.routeRevision, expectedRouteRevision);
        if (run.driverUserId === newDriverUserId) {
            return {
                driverUserId: newDriverUserId,
                routeRevision: run.routeRevision,
                reroutePending: run.rerouteRequiredAt !== null,
            };
        }
        const driver = await tx.query.users.findFirst({
            columns: { id: true, role: true },
            where: eq(users.id, newDriverUserId),
        });
        if (!driver || !['driver', 'admin'].includes(driver.role)) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
                'New delivery driver is invalid',
            );
        }
        const targetRun = await tx.query.deliveryRuns.findFirst({
            columns: { id: true },
            where: and(
                eq(deliveryRuns.driverUserId, newDriverUserId),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
            ),
        });
        if (targetRun) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.RUN_DRIVER_CONFLICT,
                'The selected driver already has an active delivery run',
            );
        }
        await tx
            .update(deliveryRunStops)
            .set({
                state: DeliveryRunStopStates.PENDING,
                arrivedAt: null,
            })
            .where(
                and(
                    eq(deliveryRunStops.runId, runId),
                    eq(deliveryRunStops.state, DeliveryRunStopStates.ARRIVED),
                    isNull(deliveryRunStops.releasedAt),
                ),
            );
        const [updatedRun] = await tx
            .update(deliveryRuns)
            .set({
                driverUserId: newDriverUserId,
                routeRevision: sql`${deliveryRuns.routeRevision} + 1`,
                rerouteRequiredAt: occurredAt,
                rerouteAttemptedAt: null,
                currentLatitude: null,
                currentLongitude: null,
                currentLocationAccuracy: null,
                currentLocationHeading: null,
                currentLocationSpeed: null,
                currentLocationRecordedAt: null,
                currentLocationReceivedAt: null,
            })
            .where(
                and(
                    eq(deliveryRuns.id, runId),
                    eq(deliveryRuns.routeRevision, expectedRouteRevision),
                    eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                ),
            )
            .returning({ routeRevision: deliveryRuns.routeRevision });
        if (!updatedRun) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
                'Delivery route changed. Refresh the active run and retry.',
            );
        }
        await createEvent(
            knownEvents.delivery.runReassignedV1(runId, {
                previousDriverUserId: run.driverUserId,
                newDriverUserId,
                reassignedAt: occurredAt.toISOString(),
                reassignedByUserId: adminUserId,
                routeRevision: updatedRun.routeRevision,
            }),
            tx,
        );
        return {
            driverUserId: newDriverUserId,
            routeRevision: updatedRun.routeRevision,
            reroutePending: true,
        };
    });
}

export async function abandonDeliveryRun({
    adminUserId,
    runId,
    expectedRouteRevision,
    reason,
    occurredAt = new Date(),
}: {
    adminUserId: string;
    runId: string;
    expectedRouteRevision: number;
    reason?: string;
    occurredAt?: Date;
}) {
    ensureRouteRevisionInput(expectedRouteRevision);
    const normalizedReason = reason?.trim().slice(0, 1_000);
    return await withDeliveryDispatchTransaction(async (tx) => {
        await tx.execute(
            sql`select ${deliveryRuns.id} from ${deliveryRuns} where ${deliveryRuns.id} = ${runId} for update`,
        );
        const run = await tx.query.deliveryRuns.findFirst({
            where: eq(deliveryRuns.id, runId),
        });
        if (!run || run.state !== DeliveryRunStates.ACTIVE) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
                'Active delivery run was not found',
            );
        }
        assertRouteRevision(run.routeRevision, expectedRouteRevision);
        const stops = await tx.query.deliveryRunStops.findMany({
            where: eq(deliveryRunStops.runId, runId),
            orderBy: [asc(deliveryRunStops.sequence)],
        });
        const recoverableStops = stops.filter(
            (stop) =>
                stop.state !== DeliveryRunStopStates.DELIVERED &&
                stop.state !== DeliveryRunStopStates.CANCELLED,
        );
        for (const stop of recoverableStops) {
            if (stop.state === DeliveryRunStopStates.FAILED) {
                await tx
                    .update(deliveryRunStops)
                    .set({ releasedAt: occurredAt })
                    .where(eq(deliveryRunStops.id, stop.id));
                continue;
            }
            await tx
                .update(deliveryRunStops)
                .set({
                    state: DeliveryRunStopStates.CANCELLED,
                    deliveredAt: null,
                    exceptionReason: DeliveryRunExceptionReasons.CANCELLATION,
                    exceptionNote: normalizedReason ?? null,
                    exceptionOccurredAt: occurredAt,
                    exceptionRecordedByUserId: adminUserId,
                    releasedAt: occurredAt,
                })
                .where(eq(deliveryRunStops.id, stop.id));
        }
        await tx
            .update(deliveryRunStops)
            .set({ releasedAt: occurredAt })
            .where(
                and(
                    eq(deliveryRunStops.runId, runId),
                    isNull(deliveryRunStops.releasedAt),
                    inArray(deliveryRunStops.state, [
                        DeliveryRunStopStates.DELIVERED,
                        DeliveryRunStopStates.CANCELLED,
                    ]),
                ),
            );
        const [updatedRun] = await tx
            .update(deliveryRuns)
            .set({
                state: DeliveryRunStates.CANCELLED,
                completedAt: occurredAt,
                routeRevision: sql`${deliveryRuns.routeRevision} + 1`,
                rerouteRequiredAt: null,
                rerouteAttemptedAt: null,
                currentLatitude: null,
                currentLongitude: null,
                currentLocationAccuracy: null,
                currentLocationHeading: null,
                currentLocationSpeed: null,
                currentLocationRecordedAt: null,
                currentLocationReceivedAt: null,
            })
            .where(
                and(
                    eq(deliveryRuns.id, runId),
                    eq(deliveryRuns.routeRevision, expectedRouteRevision),
                    eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                ),
            )
            .returning({ routeRevision: deliveryRuns.routeRevision });
        if (!updatedRun) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
                'Delivery route changed. Refresh the active run and retry.',
            );
        }
        for (const stop of recoverableStops) {
            await createEvent(
                knownEvents.delivery.requestExceptionRecoveredV1(
                    stop.deliveryRequestId,
                    {
                        runId,
                        stopId: stop.id,
                        recovery: 'route-abandonment',
                        recoveredAt: occurredAt.toISOString(),
                        recoveredByUserId: adminUserId,
                        routeRevision: updatedRun.routeRevision,
                    },
                ),
                tx,
            );
        }
        await createEvent(
            knownEvents.delivery.runAbandonedV1(runId, {
                abandonedAt: occurredAt.toISOString(),
                abandonedByUserId: adminUserId,
                ...(normalizedReason ? { reason: normalizedReason } : {}),
                releasedRequestIds: recoverableStops.map(
                    (stop) => stop.deliveryRequestId,
                ),
                routeRevision: updatedRun.routeRevision,
            }),
            tx,
        );
        return {
            releasedRequestIds: recoverableStops.map(
                (stop) => stop.deliveryRequestId,
            ),
            routeRevision: updatedRun.routeRevision,
        };
    });
}

export type ApplyDeliveryRunRerouteInput = {
    runId: string;
    expectedRouteRevision: number;
    rerouteClaimedAt: Date;
    encodedPolyline?: string;
    estimateSource: PreparedDeliveryRunEstimateSource;
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    pickupEstimates: Array<{
        pickupNodeId: string;
        itinerarySequence: number;
        estimatedArrivalAt: Date;
        incomingTravelSeconds: number;
        incomingDistanceMeters: number;
    }>;
    stopEstimates: Array<{
        stopIds: number[];
        itinerarySequence: number;
        estimatedArrivalAt: Date;
        estimatedTravelSeconds: number;
        estimatedDistanceMeters: number;
    }>;
};

export async function applyDeliveryRunReroute(
    input: ApplyDeliveryRunRerouteInput,
) {
    ensureRouteRevisionInput(input.expectedRouteRevision);
    const invalidPickupEstimate = input.pickupEstimates.some(
        (estimate) =>
            !Number.isInteger(estimate.itinerarySequence) ||
            estimate.itinerarySequence <= 0 ||
            !(estimate.estimatedArrivalAt instanceof Date) ||
            !Number.isFinite(estimate.estimatedArrivalAt.getTime()) ||
            !isNonnegativeInteger(estimate.incomingTravelSeconds) ||
            !isNonnegativeInteger(estimate.incomingDistanceMeters),
    );
    const invalidStopEstimate = input.stopEstimates.some(
        (estimate) =>
            !Number.isInteger(estimate.itinerarySequence) ||
            estimate.itinerarySequence <= 0 ||
            !(estimate.estimatedArrivalAt instanceof Date) ||
            !Number.isFinite(estimate.estimatedArrivalAt.getTime()) ||
            !isNonnegativeInteger(estimate.estimatedTravelSeconds) ||
            !isNonnegativeInteger(estimate.estimatedDistanceMeters),
    );
    if (
        !isPreparedEstimateSource(input.estimateSource) ||
        !(input.rerouteClaimedAt instanceof Date) ||
        !Number.isFinite(input.rerouteClaimedAt.getTime()) ||
        !isNonnegativeInteger(input.totalDistanceMeters) ||
        !isNonnegativeInteger(input.totalDurationSeconds) ||
        invalidPickupEstimate ||
        invalidStopEstimate
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
            'Delivery reroute estimates are invalid',
        );
    }
    return await withDeliveryDispatchTransaction(async (tx) => {
        await tx.execute(
            sql`select ${deliveryRuns.id} from ${deliveryRuns} where ${deliveryRuns.id} = ${input.runId} for update`,
        );
        const run = await tx.query.deliveryRuns.findFirst({
            where: eq(deliveryRuns.id, input.runId),
        });
        if (!run || run.state !== DeliveryRunStates.ACTIVE) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
                'Active delivery run was not found',
            );
        }
        assertRouteRevision(run.routeRevision, input.expectedRouteRevision);
        if (
            run.rerouteRequiredAt === null ||
            run.rerouteAttemptedAt?.getTime() !==
                input.rerouteClaimedAt.getTime()
        ) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
                'Delivery reroute was already applied',
            );
        }

        const progress = await getDeliveryRunExecutionProgressFromDb(
            input.runId,
            tx,
        );
        const allRunStops = await tx.query.deliveryRunStops.findMany({
            columns: { id: true, sequence: true, state: true },
            where: eq(deliveryRunStops.runId, input.runId),
        });
        const nonterminalStops = allRunStops.filter(
            (stop) => !deliveryRunTerminalStopStates.includes(stop.state),
        );
        const originalSequenceByStopId = new Map(
            allRunStops.map((stop) => [stop.id, stop.sequence]),
        );
        const nonterminalStopIds = new Set(
            nonterminalStops.map((stop) => stop.id),
        );
        const canonicalStopGroup = (stopIds: readonly number[]) =>
            [...stopIds].sort((first, second) => first - second).join(',');
        const expectedPickupIds = new Set(
            progress.flatMap((step) =>
                step.kind === 'pickup' && step.state !== 'completed'
                    ? [step.pickupNodeId]
                    : [],
            ),
        );
        const providedPickupIds = new Set(
            input.pickupEstimates.map((estimate) => estimate.pickupNodeId),
        );
        if (
            providedPickupIds.size !== input.pickupEstimates.length ||
            providedPickupIds.size !== expectedPickupIds.size ||
            [...providedPickupIds].some(
                (pickupNodeId) => !expectedPickupIds.has(pickupNodeId),
            )
        ) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
                'Delivery reroute pickup checkpoints changed',
            );
        }

        const expectedStopGroups = new Set(
            progress.flatMap((step) => {
                if (step.kind !== 'delivery' || step.state === 'completed') {
                    return [];
                }
                const stopIds = step.stopIds.filter((stopId) =>
                    nonterminalStopIds.has(stopId),
                );
                return stopIds.length > 0 ? [canonicalStopGroup(stopIds)] : [];
            }),
        );
        const providedStopIds = input.stopEstimates.flatMap(
            (estimate) => estimate.stopIds,
        );
        const providedStopGroups = new Set(
            input.stopEstimates.map((estimate) =>
                canonicalStopGroup(estimate.stopIds),
            ),
        );
        if (
            input.stopEstimates.some(
                (estimate) =>
                    estimate.stopIds.length === 0 ||
                    new Set(estimate.stopIds).size !== estimate.stopIds.length,
            ) ||
            new Set(providedStopIds).size !== providedStopIds.length ||
            providedStopGroups.size !== input.stopEstimates.length ||
            providedStopGroups.size !== expectedStopGroups.size ||
            [...providedStopGroups].some(
                (stopGroup) => !expectedStopGroups.has(stopGroup),
            )
        ) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
                'Delivery reroute stop checkpoints changed',
            );
        }

        const proposedCheckpointSequences = [
            ...input.pickupEstimates.map(
                (estimate) => estimate.itinerarySequence,
            ),
            ...input.stopEstimates.flatMap((estimate) =>
                run.routePlanVersion < 2
                    ? estimate.stopIds.map(
                          (_stopId, index) =>
                              estimate.itinerarySequence + index,
                      )
                    : [estimate.itinerarySequence],
            ),
        ];
        const completedCheckpointSequences = new Set(
            progress.flatMap((step) =>
                step.state === 'completed' ? [step.itinerarySequence] : [],
            ),
        );
        const providedStopIdSet = new Set(providedStopIds);
        const legacyOccupiedSequences = new Set(
            run.routePlanVersion < 2
                ? allRunStops.flatMap((stop) =>
                      providedStopIdSet.has(stop.id) ? [] : [stop.sequence],
                  )
                : [],
        );
        if (
            new Set(proposedCheckpointSequences).size !==
                proposedCheckpointSequences.length ||
            proposedCheckpointSequences.some(
                (sequence) =>
                    completedCheckpointSequences.has(sequence) ||
                    legacyOccupiedSequences.has(sequence),
            )
        ) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
                'Delivery reroute itinerary sequences conflict',
            );
        }

        if (input.pickupEstimates.length > 0) {
            const [maximum] = await tx
                .select({
                    value: sql<number>`coalesce(max(${deliveryRunPickupNodes.itinerarySequence}), 0)`,
                })
                .from(deliveryRunPickupNodes)
                .where(eq(deliveryRunPickupNodes.runId, input.runId));
            const temporaryBase = Number(maximum?.value ?? 0) + 1;
            for (const [index, estimate] of input.pickupEstimates.entries()) {
                const [updated] = await tx
                    .update(deliveryRunPickupNodes)
                    .set({ itinerarySequence: temporaryBase + index })
                    .where(
                        and(
                            eq(
                                deliveryRunPickupNodes.id,
                                estimate.pickupNodeId,
                            ),
                            eq(deliveryRunPickupNodes.runId, input.runId),
                        ),
                    )
                    .returning({ id: deliveryRunPickupNodes.id });
                if (!updated) {
                    throw new DeliveryRunExecutionError(
                        DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
                        'Delivery reroute pickup checkpoint is invalid',
                    );
                }
            }
        }
        if (run.routePlanVersion < 2 && providedStopIds.length > 0) {
            const temporaryBase =
                Math.max(0, ...allRunStops.map((stop) => stop.sequence)) + 1;
            for (const [index, stopId] of providedStopIds.entries()) {
                const [updated] = await tx
                    .update(deliveryRunStops)
                    .set({ sequence: temporaryBase + index })
                    .where(
                        and(
                            eq(deliveryRunStops.runId, input.runId),
                            eq(deliveryRunStops.id, stopId),
                            notInArray(
                                deliveryRunStops.state,
                                deliveryRunTerminalStopStates,
                            ),
                        ),
                    )
                    .returning({ id: deliveryRunStops.id });
                if (!updated) {
                    throw new DeliveryRunExecutionError(
                        DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
                        'Delivery stops changed while the reroute was calculated',
                    );
                }
            }
        }

        for (const estimate of input.pickupEstimates) {
            const rows = await tx
                .update(deliveryRunPickupNodes)
                .set({
                    itinerarySequence: estimate.itinerarySequence,
                    estimatedArrivalAt: estimate.estimatedArrivalAt,
                    incomingTravelSeconds: estimate.incomingTravelSeconds,
                    incomingDistanceMeters: estimate.incomingDistanceMeters,
                })
                .where(
                    and(
                        eq(deliveryRunPickupNodes.id, estimate.pickupNodeId),
                        eq(deliveryRunPickupNodes.runId, input.runId),
                    ),
                )
                .returning({ id: deliveryRunPickupNodes.id });
            if (!rows[0]) {
                throw new DeliveryRunExecutionError(
                    DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
                    'Delivery reroute pickup checkpoint is invalid',
                );
            }
        }
        for (const estimate of input.stopEstimates) {
            if (estimate.stopIds.length === 0) {
                throw new DeliveryRunExecutionError(
                    DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
                    'Delivery reroute stop checkpoint is empty',
                );
            }
            const orderedStopIds = [...estimate.stopIds].sort(
                (first, second) =>
                    (originalSequenceByStopId.get(first) ?? first) -
                    (originalSequenceByStopId.get(second) ?? second),
            );
            let updatedCount = 0;
            for (const [index, stopId] of orderedStopIds.entries()) {
                const updated = await tx
                    .update(deliveryRunStops)
                    .set({
                        ...(run.routePlanVersion < 2
                            ? {
                                  sequence: estimate.itinerarySequence + index,
                              }
                            : {
                                  itinerarySequence: estimate.itinerarySequence,
                              }),
                        estimatedArrivalAt: estimate.estimatedArrivalAt,
                        estimatedTravelSeconds: estimate.estimatedTravelSeconds,
                        estimatedDistanceMeters:
                            estimate.estimatedDistanceMeters,
                    })
                    .where(
                        and(
                            eq(deliveryRunStops.runId, input.runId),
                            eq(deliveryRunStops.id, stopId),
                            notInArray(
                                deliveryRunStops.state,
                                deliveryRunTerminalStopStates,
                            ),
                        ),
                    )
                    .returning({ id: deliveryRunStops.id });
                updatedCount += updated.length;
            }
            if (updatedCount !== orderedStopIds.length) {
                throw new DeliveryRunExecutionError(
                    DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
                    'Delivery stops changed while the reroute was calculated',
                );
            }
        }
        const appliedAt = new Date();
        const [updatedRun] = await tx
            .update(deliveryRuns)
            .set({
                encodedPolyline: input.encodedPolyline ?? null,
                totalDistanceMeters: input.totalDistanceMeters,
                totalDurationSeconds: input.totalDurationSeconds,
                estimateSource:
                    run.routePlanVersion < 2
                        ? DeliveryRunEstimateSources.LEGACY
                        : input.estimateSource,
                estimatesUpdatedAt: appliedAt,
                rerouteRequiredAt: null,
                rerouteAttemptedAt: null,
                routeRevision: sql`${deliveryRuns.routeRevision} + 1`,
            })
            .where(
                and(
                    eq(deliveryRuns.id, input.runId),
                    eq(deliveryRuns.routeRevision, input.expectedRouteRevision),
                    isNotNull(deliveryRuns.rerouteRequiredAt),
                    eq(deliveryRuns.rerouteAttemptedAt, input.rerouteClaimedAt),
                    eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                ),
            )
            .returning({ routeRevision: deliveryRuns.routeRevision });
        if (!updatedRun) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
                'Delivery route changed while the reroute was calculated',
            );
        }
        return {
            routeRevision: updatedRun.routeRevision,
            reroutePending: false,
            estimatesUpdatedAt: appliedAt,
        };
    });
}

export const deliveryRunRerouteLeaseMs = 30_000;

export async function claimDeliveryRunReroute({
    runId,
    expectedRouteRevision,
    claimedAt = new Date(),
}: {
    runId: string;
    expectedRouteRevision: number;
    claimedAt?: Date;
}) {
    ensureRouteRevisionInput(expectedRouteRevision);
    if (!(claimedAt instanceof Date) || !Number.isFinite(claimedAt.getTime())) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
            'Delivery reroute claim time is invalid',
        );
    }
    const availableBefore = new Date(
        claimedAt.getTime() - deliveryRunRerouteLeaseMs,
    );
    const [claimed] = await storage()
        .update(deliveryRuns)
        .set({ rerouteAttemptedAt: claimedAt })
        .where(
            and(
                eq(deliveryRuns.id, runId),
                eq(deliveryRuns.routeRevision, expectedRouteRevision),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                isNotNull(deliveryRuns.rerouteRequiredAt),
                or(
                    isNull(deliveryRuns.rerouteAttemptedAt),
                    lte(deliveryRuns.rerouteAttemptedAt, availableBefore),
                ),
            ),
        )
        .returning({ claimedAt: deliveryRuns.rerouteAttemptedAt });
    return claimed?.claimedAt ? { rerouteClaimedAt: claimed.claimedAt } : null;
}

export function getDeliveryRunStop(stopId: number) {
    return storage().query.deliveryRunStops.findFirst({
        where: eq(deliveryRunStops.id, stopId),
        with: {
            run: true,
            runSlot: true,
        },
    });
}

export async function getDeliveryRunStopsForRequestIds(requestIds: string[]) {
    if (requestIds.length === 0) {
        return [];
    }

    const rows = await storage()
        .select({
            run: deliveryRuns,
            stop: deliveryRunStops,
            runSlot: deliveryRunSlots,
        })
        .from(deliveryRunStops)
        .innerJoin(deliveryRuns, eq(deliveryRunStops.runId, deliveryRuns.id))
        .leftJoin(
            deliveryRunSlots,
            and(
                eq(deliveryRunStops.runId, deliveryRunSlots.runId),
                eq(deliveryRunStops.runSlotId, deliveryRunSlots.id),
            ),
        )
        .where(inArray(deliveryRunStops.deliveryRequestId, requestIds));

    const preferredByRequestId = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
        const current = preferredByRequestId.get(row.stop.deliveryRequestId);
        if (
            !current ||
            (current.stop.releasedAt !== null &&
                row.stop.releasedAt === null) ||
            ((current.stop.releasedAt === null) ===
                (row.stop.releasedAt === null) &&
                row.stop.id > current.stop.id)
        ) {
            preferredByRequestId.set(row.stop.deliveryRequestId, row);
        }
    }

    return requestIds.flatMap((requestId) => {
        const row = preferredByRequestId.get(requestId);
        return row
            ? [{ run: row.run, stop: { ...row.stop, runSlot: row.runSlot } }]
            : [];
    });
}

export async function getActiveDeliveryRunStopsForRequestIds(
    requestIds: string[],
) {
    if (requestIds.length === 0) {
        return [];
    }

    return await storage()
        .select({
            run: deliveryRuns,
            stop: deliveryRunStops,
            runSlot: deliveryRunSlots,
        })
        .from(deliveryRunStops)
        .innerJoin(deliveryRuns, eq(deliveryRunStops.runId, deliveryRuns.id))
        .leftJoin(
            deliveryRunSlots,
            and(
                eq(deliveryRunStops.runId, deliveryRunSlots.runId),
                eq(deliveryRunStops.runSlotId, deliveryRunSlots.id),
            ),
        )
        .where(
            and(
                inArray(deliveryRunStops.deliveryRequestId, requestIds),
                isNull(deliveryRunStops.releasedAt),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
            ),
        )
        .then((rows) =>
            rows.map((row) => ({
                run: row.run,
                stop: { ...row.stop, runSlot: row.runSlot },
            })),
        );
}

export async function getDeliveryAccountContacts(accountIds: string[]) {
    if (accountIds.length === 0) {
        return [];
    }

    return await storage()
        .select({
            accountId: accountUsers.accountId,
            id: users.id,
            userName: users.userName,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            role: users.role,
        })
        .from(accountUsers)
        .innerJoin(users, eq(accountUsers.userId, users.id))
        .where(inArray(accountUsers.accountId, accountIds));
}

export async function accountCanTrackDeliveryRun({
    accountId,
    runId,
}: {
    accountId: string;
    runId: string;
}) {
    const progress = await getDeliveryRunExecutionProgress(runId);
    const current = progress.find((step) => step.state === 'current');
    if (
        current?.kind !== 'delivery' ||
        !current.pickupConfirmed ||
        current.actionableStopIds.length === 0
    ) {
        return false;
    }
    const rows = await storage()
        .selectDistinct({ accountId: operations.accountId })
        .from(deliveryRunStops)
        .innerJoin(deliveryRuns, eq(deliveryRunStops.runId, deliveryRuns.id))
        .innerJoin(
            deliveryRequests,
            eq(deliveryRunStops.deliveryRequestId, deliveryRequests.id),
        )
        .innerJoin(operations, eq(deliveryRequests.operationId, operations.id))
        .where(
            and(
                eq(deliveryRunStops.runId, runId),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                inArray(deliveryRunStops.id, current.actionableStopIds),
                inArray(deliveryRunStops.state, [
                    DeliveryRunStopStates.PENDING,
                    DeliveryRunStopStates.ARRIVED,
                ]),
            ),
        );

    return rows.some((row) => row.accountId === accountId);
}

export async function updateDeliveryRunLocation({
    runId,
    driverUserId,
    latitude,
    longitude,
    accuracy,
    heading,
    speed,
    recordedAt,
}: {
    runId: string;
    driverUserId: string;
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    recordedAt: Date;
}) {
    ensureCoordinates(latitude, longitude);

    const normalizedAccuracy = accuracy ?? null;
    const normalizedHeading = heading ?? null;
    const normalizedSpeed = speed ?? null;

    return await storage().transaction(async (tx) => {
        await tx.execute(
            sql`select ${deliveryRuns.id} from ${deliveryRuns} where ${deliveryRuns.id} = ${runId} for update`,
        );
        const current = await tx.query.deliveryRuns.findFirst({
            where: and(
                eq(deliveryRuns.id, runId),
                eq(deliveryRuns.driverUserId, driverUserId),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
            ),
        });
        if (!current) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
                'Active delivery run not found',
            );
        }

        const currentRecordedTime =
            current.currentLocationRecordedAt?.getTime() ?? null;
        if (
            currentRecordedTime !== null &&
            currentRecordedTime > recordedAt.getTime()
        ) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.LOCATION_STALE,
                'A newer delivery location is already stored',
            );
        }
        if (currentRecordedTime === recordedAt.getTime()) {
            const identicalReplay =
                current.currentLatitude === latitude &&
                current.currentLongitude === longitude &&
                current.currentLocationAccuracy === normalizedAccuracy &&
                current.currentLocationHeading === normalizedHeading &&
                current.currentLocationSpeed === normalizedSpeed;
            if (identicalReplay && current.currentLocationReceivedAt) {
                return {
                    acceptedAt: current.currentLocationReceivedAt,
                    previousAcceptedAt: current.currentLocationReceivedAt,
                    replayed: true,
                };
            }
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.LOCATION_CONFLICT,
                'Delivery location timestamp conflicts with stored telemetry',
            );
        }

        const acceptedAt = new Date();
        const [updated] = await tx
            .update(deliveryRuns)
            .set({
                currentLatitude: latitude,
                currentLongitude: longitude,
                currentLocationAccuracy: normalizedAccuracy,
                currentLocationHeading: normalizedHeading,
                currentLocationSpeed: normalizedSpeed,
                currentLocationRecordedAt: recordedAt,
                currentLocationReceivedAt: acceptedAt,
            })
            .where(
                and(
                    eq(deliveryRuns.id, runId),
                    eq(deliveryRuns.driverUserId, driverUserId),
                    eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                ),
            )
            .returning({ acceptedAt: deliveryRuns.currentLocationReceivedAt });
        if (!updated?.acceptedAt) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
                'Active delivery run not found',
            );
        }
        return {
            acceptedAt: updated.acceptedAt,
            previousAcceptedAt: current.currentLocationReceivedAt,
            replayed: false,
        };
    });
}

export async function clearExpiredDeliveryRunLocations(now = new Date()) {
    const cutoff = new Date(now.getTime() - deliveryRunExactLocationTtlMs);
    return await storage()
        .update(deliveryRuns)
        .set({
            currentLatitude: null,
            currentLongitude: null,
            currentLocationAccuracy: null,
            currentLocationHeading: null,
            currentLocationSpeed: null,
            currentLocationRecordedAt: null,
        })
        .where(
            and(
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                or(
                    isNull(deliveryRuns.currentLocationReceivedAt),
                    lt(deliveryRuns.currentLocationReceivedAt, cutoff),
                ),
                or(
                    isNotNull(deliveryRuns.currentLatitude),
                    isNotNull(deliveryRuns.currentLongitude),
                    isNotNull(deliveryRuns.currentLocationAccuracy),
                    isNotNull(deliveryRuns.currentLocationHeading),
                    isNotNull(deliveryRuns.currentLocationSpeed),
                    isNotNull(deliveryRuns.currentLocationRecordedAt),
                ),
            ),
        )
        .returning({
            runId: deliveryRuns.id,
            lastAcceptedAt: deliveryRuns.currentLocationReceivedAt,
        });
}

export async function updateDeliveryRunEstimates({
    runId,
    driverUserId,
    expectedRouteRevision,
    expectedLocationRecordedAt,
    expectedLocationReceivedAt,
    encodedPolyline,
    totalDistanceMeters,
    totalDurationSeconds,
    estimates,
}: {
    runId: string;
    driverUserId: string;
    expectedRouteRevision: number;
    expectedLocationRecordedAt: Date;
    expectedLocationReceivedAt: Date;
    encodedPolyline?: string;
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    estimates: DeliveryRunStopEstimate[];
}) {
    return await storage().transaction(async (tx) => {
        const [updatedRun] = await tx
            .update(deliveryRuns)
            .set({
                encodedPolyline,
                totalDistanceMeters,
                totalDurationSeconds,
                estimatesUpdatedAt: new Date(),
            })
            .where(
                and(
                    eq(deliveryRuns.id, runId),
                    eq(deliveryRuns.driverUserId, driverUserId),
                    eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                    eq(deliveryRuns.routeRevision, expectedRouteRevision),
                    eq(
                        deliveryRuns.currentLocationRecordedAt,
                        expectedLocationRecordedAt,
                    ),
                    eq(
                        deliveryRuns.currentLocationReceivedAt,
                        expectedLocationReceivedAt,
                    ),
                ),
            )
            .returning({ id: deliveryRuns.id });
        if (!updatedRun) return false;

        for (const estimate of estimates) {
            await tx
                .update(deliveryRunStops)
                .set({
                    estimatedArrivalAt: estimate.estimatedArrivalAt,
                    estimatedTravelSeconds: estimate.estimatedTravelSeconds,
                    estimatedDistanceMeters: estimate.estimatedDistanceMeters,
                })
                .where(
                    and(
                        eq(deliveryRunStops.runId, runId),
                        eq(
                            deliveryRunStops.deliveryRequestId,
                            estimate.deliveryRequestId,
                        ),
                        inArray(deliveryRunStops.state, [
                            DeliveryRunStopStates.PENDING,
                            DeliveryRunStopStates.ARRIVED,
                        ]),
                    ),
                );
        }
        return true;
    });
}

const deliveryRunStopOperationMaximumAgeMs = 36 * 60 * 60 * 1000;
const deliveryRunStopOperationMaximumFutureSkewMs = 5 * 60 * 1000;

type NormalizedRecordDeliveryRunStopOperationInput =
    RecordDeliveryRunStopOperationBase & {
        kind: DeliveryRunStopOperationKind;
        deliveryNotes?: string;
    };

function invalidDeliveryRunStopOperation(message: string): never {
    throw new DeliveryRunExecutionError(
        DeliveryRunExecutionErrorCodes.STOP_OPERATION_INVALID,
        message,
    );
}

export function deliveryRunStopOperationOccurredAtIsAcceptable(
    occurredAt: Date,
    appliedAt = new Date(),
) {
    const occurredAtMs = occurredAt.getTime();
    const appliedAtMs = appliedAt.getTime();
    if (!Number.isFinite(occurredAtMs) || !Number.isFinite(appliedAtMs)) {
        return false;
    }
    const ageMs = appliedAtMs - occurredAtMs;
    return (
        ageMs <= deliveryRunStopOperationMaximumAgeMs &&
        ageMs >= -deliveryRunStopOperationMaximumFutureSkewMs
    );
}

function normalizeDeliveryRunStopOperationInput(
    input: RecordDeliveryRunStopOperationInput,
): NormalizedRecordDeliveryRunStopOperationInput {
    const clientOperationId = input.clientOperationId.trim();
    if (clientOperationId.length === 0 || clientOperationId.length > 128) {
        invalidDeliveryRunStopOperation(
            'Delivery stop operation ID must contain 1 to 128 characters',
        );
    }
    if (
        input.kind !== DeliveryRunStopOperationKinds.ARRIVE &&
        input.kind !== DeliveryRunStopOperationKinds.DELIVER
    ) {
        invalidDeliveryRunStopOperation(
            'Delivery stop operation kind is invalid',
        );
    }
    if (!Number.isInteger(input.targetStopId) || input.targetStopId <= 0) {
        invalidDeliveryRunStopOperation('Delivery stop selection is invalid');
    }
    if (
        !Number.isInteger(input.expectedRouteRevision) ||
        input.expectedRouteRevision < 0
    ) {
        invalidDeliveryRunStopOperation('Delivery route revision is invalid');
    }
    if (
        !(input.occurredAt instanceof Date) ||
        !Number.isFinite(input.occurredAt.getTime())
    ) {
        invalidDeliveryRunStopOperation(
            'Delivery stop operation occurrence time is invalid',
        );
    }
    const deliveryNotes =
        input.kind === DeliveryRunStopOperationKinds.DELIVER
            ? input.deliveryNotes?.trim()
            : undefined;
    if (deliveryNotes && deliveryNotes.length > 1_000) {
        invalidDeliveryRunStopOperation(
            'Delivery notes must not exceed 1000 characters',
        );
    }
    return {
        driverUserId: input.driverUserId,
        runId: input.runId,
        targetStopId: input.targetStopId,
        expectedRouteRevision: input.expectedRouteRevision,
        clientOperationId,
        occurredAt: input.occurredAt,
        kind: input.kind,
        ...(deliveryNotes ? { deliveryNotes } : {}),
    };
}

function deliveryRunStopOperationPayloadHash(
    input: NormalizedRecordDeliveryRunStopOperationInput,
) {
    return hashValue(
        JSON.stringify({
            clientOperationId: input.clientOperationId,
            kind: input.kind,
            targetStopId: input.targetStopId,
            expectedRouteRevision: input.expectedRouteRevision,
            occurredAt: input.occurredAt.toISOString(),
            deliveryNotes: input.deliveryNotes ?? null,
        }),
    );
}

async function lockDeliveryRun(runId: string, db: TransactionClient) {
    await db.execute(
        sql`select ${deliveryRuns.id} from ${deliveryRuns} where ${deliveryRuns.id} = ${runId} for update`,
    );
}

async function ensureOwnedDeliveryRunStops({
    driverUserId,
    runId,
    stopIds,
    expectedRouteRevision,
    runAlreadyLocked = false,
    db,
}: {
    driverUserId: string;
    runId: string;
    stopIds: number[];
    expectedRouteRevision?: number;
    runAlreadyLocked?: boolean;
    db: TransactionClient;
}) {
    const uniqueStopIds = Array.from(new Set(stopIds));
    if (uniqueStopIds.length === 0) {
        throw new Error('Active delivery stop not found');
    }

    // Serialize every arrival/delivery transition for this run before reading
    // stop state. Without this lock, a late arrival write can overwrite a
    // concurrently committed delivered state.
    if (!runAlreadyLocked) await lockDeliveryRun(runId, db);

    const stops = await db.query.deliveryRunStops.findMany({
        where: and(
            eq(deliveryRunStops.runId, runId),
            inArray(deliveryRunStops.id, uniqueStopIds),
        ),
        with: { run: true },
        orderBy: [asc(deliveryRunStops.sequence)],
    });
    const run = stops[0]?.run;

    if (
        stops.length !== uniqueStopIds.length ||
        !run ||
        run.driverUserId !== driverUserId ||
        run.state !== DeliveryRunStates.ACTIVE
    ) {
        throw new Error('Active delivery stop not found');
    }
    if (
        expectedRouteRevision !== undefined &&
        run.routeRevision !== expectedRouteRevision
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
            'Delivery route changed. Refresh the active run and retry.',
        );
    }

    const actionableStops = stops.filter((stop) =>
        isDeliveryRunStopActionable(stop.state),
    );
    const hasUnfinishedStops = actionableStops.length > 0;
    if (hasUnfinishedStops) {
        if (run.routePlanVersion >= 2) {
            const progress = await getDeliveryRunExecutionProgressFromDb(
                runId,
                db,
            );
            const current = progress.find((step) => step.state === 'current');
            if (current?.kind === 'pickup') {
                throw new DeliveryRunExecutionError(
                    DeliveryRunExecutionErrorCodes.PICKUP_DEPENDENCY_PENDING,
                    'Delivery pickup dependency is pending',
                );
            }
            if (current?.kind !== 'delivery') {
                throw new DeliveryRunExecutionError(
                    DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
                    'Delivery stops must be completed in route order',
                );
            }
            if (!current.pickupConfirmed) {
                throw new DeliveryRunExecutionError(
                    DeliveryRunExecutionErrorCodes.PICKUP_DEPENDENCY_PENDING,
                    'Delivery pickup dependency is pending',
                );
            }
            const currentStopIds = new Set(current.stopIds);
            const currentActionableStopIds = new Set(current.actionableStopIds);
            const selectedActionableStopIds = actionableStops.map(
                (stop) => stop.id,
            );
            if (
                uniqueStopIds.some((stopId) => !currentStopIds.has(stopId)) ||
                currentActionableStopIds.size !==
                    selectedActionableStopIds.length ||
                selectedActionableStopIds.some(
                    (stopId) => !currentActionableStopIds.has(stopId),
                )
            ) {
                throw new DeliveryRunExecutionError(
                    DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
                    'Bulk delivery stops must be completed atomically in route order',
                );
            }
        } else {
            const progress = await getDeliveryRunExecutionProgressFromDb(
                runId,
                db,
            );
            const current = progress.find((step) => step.state === 'current');
            if (
                current?.kind !== 'delivery' ||
                current.actionableStopIds.some(
                    (stopId) => !uniqueStopIds.includes(stopId),
                )
            ) {
                throw new DeliveryRunExecutionError(
                    DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
                    'Delivery stops must be completed in route order',
                );
            }
        }
    } else if (
        stops.some(
            (stop) =>
                stop.state !== DeliveryRunStopStates.DELIVERED &&
                !isDeliveryRunStopActionable(stop.state),
        )
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.EXCEPTION_TRANSITION_INVALID,
            'Exception delivery stops cannot be marked arrived or delivered',
        );
    }

    return stops;
}

async function applyDeliveryRunStopsArrivedInDatabase({
    runId,
    stops,
    occurredAt,
    db,
}: {
    runId: string;
    stops: Awaited<ReturnType<typeof ensureOwnedDeliveryRunStops>>;
    occurredAt: Date;
    db: TransactionClient;
}) {
    const advancesExecution = stops.some(
        (stop) => stop.state === DeliveryRunStopStates.PENDING,
    );

    for (const stop of stops) {
        if (!isDeliveryRunStopActionable(stop.state)) continue;
        const [updatedStop] = await db
            .update(deliveryRunStops)
            .set({
                state: DeliveryRunStopStates.ARRIVED,
                arrivedAt: stop.arrivedAt ?? occurredAt,
            })
            .where(
                and(
                    eq(deliveryRunStops.id, stop.id),
                    inArray(deliveryRunStops.state, [
                        DeliveryRunStopStates.PENDING,
                        DeliveryRunStopStates.ARRIVED,
                    ]),
                ),
            )
            .returning({ id: deliveryRunStops.id });
        if (!updatedStop) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.EXCEPTION_TRANSITION_INVALID,
                `Delivery stop ${stop.id} changed before arrival could be recorded`,
            );
        }
    }

    if (advancesExecution) {
        await db
            .update(deliveryRuns)
            .set({
                routeRevision: sql`${deliveryRuns.routeRevision} + 1`,
                rerouteAttemptedAt: null,
            })
            .where(
                and(
                    eq(deliveryRuns.id, runId),
                    eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                ),
            );
    }
    return stops;
}

export async function markDeliveryRunStopsArrived({
    driverUserId,
    runId,
    stopIds,
    expectedRouteRevision,
}: {
    driverUserId: string;
    runId: string;
    stopIds: number[];
    expectedRouteRevision?: number;
}) {
    return await storage().transaction(async (tx) => {
        const stops = await ensureOwnedDeliveryRunStops({
            driverUserId,
            runId,
            stopIds,
            expectedRouteRevision,
            db: tx,
        });
        return await applyDeliveryRunStopsArrivedInDatabase({
            runId,
            stops,
            occurredAt: new Date(),
            db: tx,
        });
    });
}

export async function markDeliveryRunStopArrived({
    driverUserId,
    runId,
    stopId,
    expectedRouteRevision,
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
    expectedRouteRevision?: number;
}) {
    const stops = await markDeliveryRunStopsArrived({
        driverUserId,
        runId,
        stopIds: [stopId],
        expectedRouteRevision,
    });
    return stops[0];
}

export async function markDeliveryRunStopDelivered({
    driverUserId,
    runId,
    stopId,
    expectedRouteRevision,
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
    expectedRouteRevision?: number;
}) {
    const requestIds = await storage().transaction(async (tx) =>
        markDeliveryRunStopsDeliveredInDatabase({
            driverUserId,
            runId,
            stopIds: [stopId],
            expectedRouteRevision,
            db: tx,
        }),
    );
    return requestIds[0];
}

async function markDeliveryRunStopsDeliveredInDatabase({
    driverUserId,
    runId,
    stopIds,
    expectedRouteRevision,
    db,
}: {
    driverUserId: string;
    runId: string;
    stopIds: number[];
    expectedRouteRevision?: number;
    db: TransactionClient;
}) {
    const stops = await ensureOwnedDeliveryRunStops({
        driverUserId,
        runId,
        stopIds,
        expectedRouteRevision,
        db,
    });
    const now = new Date();
    return await applyDeliveryRunStopsDeliveredInDatabase({
        runId,
        stops,
        occurredAt: now,
        appliedAt: now,
        db,
    });
}

async function applyDeliveryRunStopsDeliveredInDatabase({
    runId,
    stops,
    occurredAt,
    appliedAt,
    db,
}: {
    runId: string;
    stops: Awaited<ReturnType<typeof ensureOwnedDeliveryRunStops>>;
    occurredAt: Date;
    appliedAt: Date;
    db: TransactionClient;
}) {
    const advancesExecution = stops.some((stop) =>
        isDeliveryRunStopActionable(stop.state),
    );

    for (const stop of stops) {
        if (!isDeliveryRunStopActionable(stop.state)) {
            continue;
        }
        const [updatedStop] = await db
            .update(deliveryRunStops)
            .set({
                state: DeliveryRunStopStates.DELIVERED,
                arrivedAt: stop.arrivedAt ?? occurredAt,
                deliveredAt: occurredAt,
            })
            .where(
                and(
                    eq(deliveryRunStops.id, stop.id),
                    eq(deliveryRunStops.runId, runId),
                    inArray(deliveryRunStops.state, [
                        DeliveryRunStopStates.PENDING,
                        DeliveryRunStopStates.ARRIVED,
                    ]),
                ),
            )
            .returning({ id: deliveryRunStops.id });
        if (!updatedStop) {
            throw new DeliveryRunExecutionError(
                DeliveryRunExecutionErrorCodes.EXCEPTION_TRANSITION_INVALID,
                `Delivery stop ${stop.id} changed before delivery could be recorded`,
            );
        }
    }

    if (advancesExecution) {
        await db
            .update(deliveryRuns)
            .set({
                routeRevision: sql`${deliveryRuns.routeRevision} + 1`,
                rerouteAttemptedAt: null,
            })
            .where(
                and(
                    eq(deliveryRuns.id, runId),
                    eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                ),
            );
    }

    await completeDeliveryRunIfEligible({
        runId,
        completedAt: appliedAt,
        db,
    });

    return stops.flatMap((stop) =>
        stop.state === DeliveryRunStopStates.DELIVERED ||
        isDeliveryRunStopActionable(stop.state)
            ? [stop.deliveryRequestId]
            : [],
    );
}

export async function fulfillDeliveryRunStops({
    driverUserId,
    runId,
    stopIds,
    deliveryNotes,
    expectedRouteRevision,
}: {
    driverUserId: string;
    runId: string;
    stopIds: number[];
    deliveryNotes?: string;
    expectedRouteRevision?: number;
}) {
    return await withDeliveryDispatchTransaction(async (tx) => {
        const stops = await ensureOwnedDeliveryRunStops({
            driverUserId,
            runId,
            stopIds,
            expectedRouteRevision,
            db: tx,
        });
        for (const stop of stops) {
            if (!isDeliveryRunStopActionable(stop.state)) continue;
            await fulfillDeliveryRequest(
                stop.deliveryRequestId,
                deliveryNotes,
                tx,
            );
        }
        const appliedAt = new Date();
        return await applyDeliveryRunStopsDeliveredInDatabase({
            runId,
            stops,
            occurredAt: appliedAt,
            appliedAt,
            db: tx,
        });
    });
}

export async function fulfillDeliveryRunStop({
    driverUserId,
    runId,
    stopId,
    deliveryNotes,
    expectedRouteRevision,
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
    deliveryNotes?: string;
    expectedRouteRevision?: number;
}) {
    const requestIds = await fulfillDeliveryRunStops({
        driverUserId,
        runId,
        stopIds: [stopId],
        deliveryNotes,
        expectedRouteRevision,
    });
    return requestIds[0];
}

async function currentDeliveryRunStopIdsForOperation({
    driverUserId,
    runId,
    targetStopId,
    expectedRouteRevision,
    db,
}: {
    driverUserId: string;
    runId: string;
    targetStopId: number;
    expectedRouteRevision: number;
    db: TransactionClient;
}) {
    const run = await db.query.deliveryRuns.findFirst({
        where: eq(deliveryRuns.id, runId),
    });
    if (
        !run ||
        run.driverUserId !== driverUserId ||
        run.state !== DeliveryRunStates.ACTIVE
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
            'Active delivery run was not found',
        );
    }
    if (run.routeRevision !== expectedRouteRevision) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
            'Delivery route changed. Refresh the active run and retry.',
        );
    }

    const progress = await getDeliveryRunExecutionProgressFromDb(runId, db);
    const current = progress.find((step) => step.state === 'current');
    if (current?.kind === 'pickup') {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.PICKUP_DEPENDENCY_PENDING,
            'Delivery pickup dependency is pending',
        );
    }
    if (
        current?.kind !== 'delivery' ||
        !current.stopIds.includes(targetStopId)
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
            'Delivery operation must target the current delivery checkpoint',
        );
    }
    if (!current.pickupConfirmed) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.PICKUP_DEPENDENCY_PENDING,
            'Delivery pickup dependency is pending',
        );
    }
    return current.stopIds;
}

function deliveryRunStopOperationReceiptResult({
    receipt,
    driverUserId,
    payloadHash,
}: {
    receipt: typeof deliveryRunStopOperations.$inferSelect;
    driverUserId: string;
    payloadHash: string;
}): RecordDeliveryRunStopOperationResult & {
    newlyFulfilledRequestIds: string[];
} {
    if (
        receipt.driverUserId !== driverUserId ||
        receipt.payloadHash !== payloadHash
    ) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.STOP_OPERATION_CONFLICT,
            'Delivery stop operation ID was reused with different content',
        );
    }
    return {
        clientOperationId: receipt.clientOperationId,
        replayed: true,
        result: receipt.result,
        newlyFulfilledRequestIds: [],
    };
}

async function recordDeliveryRunStopOperationInDatabase(
    input: NormalizedRecordDeliveryRunStopOperationInput,
    db: TransactionClient,
): Promise<
    RecordDeliveryRunStopOperationResult & {
        newlyFulfilledRequestIds: string[];
    }
> {
    const payloadHash = deliveryRunStopOperationPayloadHash(input);
    const existingReceipt = await db.query.deliveryRunStopOperations.findFirst({
        where: and(
            eq(deliveryRunStopOperations.runId, input.runId),
            eq(
                deliveryRunStopOperations.clientOperationId,
                input.clientOperationId,
            ),
        ),
    });
    if (existingReceipt) {
        return deliveryRunStopOperationReceiptResult({
            receipt: existingReceipt,
            driverUserId: input.driverUserId,
            payloadHash,
        });
    }

    await lockDeliveryRun(input.runId, db);
    const receiptAfterLock = await db.query.deliveryRunStopOperations.findFirst(
        {
            where: and(
                eq(deliveryRunStopOperations.runId, input.runId),
                eq(
                    deliveryRunStopOperations.clientOperationId,
                    input.clientOperationId,
                ),
            ),
        },
    );
    if (receiptAfterLock) {
        return deliveryRunStopOperationReceiptResult({
            receipt: receiptAfterLock,
            driverUserId: input.driverUserId,
            payloadHash,
        });
    }

    const appliedAt = new Date();
    if (
        !deliveryRunStopOperationOccurredAtIsAcceptable(
            input.occurredAt,
            appliedAt,
        )
    ) {
        invalidDeliveryRunStopOperation(
            'Delivery stop operation occurrence time is outside the accepted range',
        );
    }
    const stopIds = await currentDeliveryRunStopIdsForOperation({
        driverUserId: input.driverUserId,
        runId: input.runId,
        targetStopId: input.targetStopId,
        expectedRouteRevision: input.expectedRouteRevision,
        db,
    });
    const stops = await ensureOwnedDeliveryRunStops({
        driverUserId: input.driverUserId,
        runId: input.runId,
        stopIds,
        expectedRouteRevision: input.expectedRouteRevision,
        runAlreadyLocked: true,
        db,
    });
    if (
        input.kind === DeliveryRunStopOperationKinds.DELIVER &&
        stops.some(
            (stop) =>
                isDeliveryRunStopActionable(stop.state) &&
                stop.arrivedAt &&
                stop.arrivedAt > input.occurredAt,
        )
    ) {
        invalidDeliveryRunStopOperation(
            'Delivery cannot occur before the recorded arrival',
        );
    }

    const newlyFulfilledStops =
        input.kind === DeliveryRunStopOperationKinds.DELIVER
            ? stops.filter((stop) => isDeliveryRunStopActionable(stop.state))
            : [];
    const newlyFulfilledRequestIds = newlyFulfilledStops.map(
        (stop) => stop.deliveryRequestId,
    );
    const handoff =
        input.kind === DeliveryRunStopOperationKinds.DELIVER
            ? deliveryRunHandoffSnapshot(stops)
            : undefined;
    if (input.kind === DeliveryRunStopOperationKinds.DELIVER) {
        for (const stop of newlyFulfilledStops) {
            try {
                const item = handoff?.items.find(
                    ({ stopId }) => stopId === stop.id,
                );
                await fulfillDeliveryRequest(
                    stop.deliveryRequestId,
                    input.deliveryNotes,
                    db,
                    item
                        ? {
                              version: 1,
                              runId: input.runId,
                              stopId: item.stopId,
                              retryAttempt: item.retryAttempt,
                              clientOperationId: input.clientOperationId,
                              traceLinkId: item.traceLinkId,
                              qrAvailable: item.qrAvailable,
                              result: item.state,
                              ...(item.reason ? { reason: item.reason } : {}),
                              ...(item.verifiedAt
                                  ? { verifiedAt: item.verifiedAt }
                                  : {}),
                          }
                        : undefined,
                );
            } catch (error) {
                if (error instanceof DeliveryRequestFulfillmentError) {
                    throw new DeliveryRunExecutionError(
                        DeliveryRunExecutionErrorCodes.STOP_OPERATION_STATE_CONFLICT,
                        'Delivery request state changed before stop completion',
                    );
                }
                throw error;
            }
        }
        await applyDeliveryRunStopsDeliveredInDatabase({
            runId: input.runId,
            stops,
            occurredAt: input.occurredAt,
            appliedAt,
            db,
        });
    } else {
        await applyDeliveryRunStopsArrivedInDatabase({
            runId: input.runId,
            stops,
            occurredAt: input.occurredAt,
            db,
        });
    }

    const runAfterMutation = await db.query.deliveryRuns.findFirst({
        columns: {
            routeRevision: true,
            rerouteRequiredAt: true,
            state: true,
        },
        where: eq(deliveryRuns.id, input.runId),
    });
    if (!runAfterMutation) {
        throw new DeliveryRunExecutionError(
            DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
            'Delivery run was not found after applying the operation',
        );
    }
    const runCompleted = runAfterMutation.state === DeliveryRunStates.COMPLETED;
    const result: DeliveryRunStopOperationStoredResult = {
        kind: input.kind,
        targetStopId: input.targetStopId,
        affectedStopIds: stops.map((stop) => stop.id),
        routeRevision: runAfterMutation.routeRevision,
        reroutePending:
            !runCompleted && Boolean(runAfterMutation.rerouteRequiredAt),
        runCompleted,
        ...(handoff ? { handoff } : {}),
    };
    await db.insert(deliveryRunStopOperations).values({
        runId: input.runId,
        targetStopId: input.targetStopId,
        driverUserId: input.driverUserId,
        clientOperationId: input.clientOperationId,
        kind: input.kind,
        payloadHash,
        result,
        occurredAt: input.occurredAt,
        appliedAt,
    });
    return {
        clientOperationId: input.clientOperationId,
        replayed: false,
        result,
        newlyFulfilledRequestIds,
    };
}

export async function recordDeliveryRunStopOperation(
    input: RecordDeliveryRunStopOperationInput,
) {
    const normalized = normalizeDeliveryRunStopOperationInput(input);
    return await withDeliveryDispatchTransaction(async (tx) =>
        recordDeliveryRunStopOperationInDatabase(normalized, tx),
    );
}
