import {
    createHash,
    randomBytes,
    randomUUID,
    timingSafeEqual,
} from 'node:crypto';
import { and, asc, eq, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import 'server-only';
import {
    accountUsers,
    DeliveryRequestStates,
    type DeliveryRunPreparationPlanPayload,
    DeliveryRunStates,
    DeliveryRunStopStates,
    deliveryAddresses,
    deliveryRequests,
    deliveryRunPickupNodes,
    deliveryRunPreparations,
    deliveryRunSlots,
    deliveryRunStops,
    deliveryRuns,
    events,
    operations,
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
    deliveryDispatchEventTypes,
    fulfillDeliveryRequest,
    getDeliveryRequestDispatchSnapshots,
} from './deliveryRequestsRepo';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = StorageClient | TransactionClient;

export type CreateDeliveryRunStopInput = {
    deliveryRequestId: string;
    sequence: number;
    latitude: number;
    longitude: number;
    formattedAddress: string;
    estimatedArrivalAt?: Date;
    estimatedTravelSeconds?: number;
    estimatedDistanceMeters?: number;
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
    pickupNodes?: CreateDeliveryRunPickupNodeInput[];
    runSlots?: CreateDeliveryRunSlotInput[];
    stops: CreateDeliveryRunStopInput[];
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

export type SaveDeliveryRunPreparationInput = {
    dispatchRevision: number;
    selectionRequestIds: string[];
    createRunInput: CreateDeliveryRunInput;
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

function normalizePreparationPlan({
    dispatchRevision,
    selectionRequestIds,
    createRunInput,
    requestSnapshots,
}: SaveDeliveryRunPreparationInput): DeliveryRunPreparationPlanPayload {
    if (!Number.isInteger(dispatchRevision) || dispatchRevision < 0) {
        throw new DeliveryRunPersistenceError(
            DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
            'Delivery dispatch revision is invalid',
        );
    }
    const pickupNodes = createRunInput.pickupNodes;
    const runSlots = createRunInput.runSlots;
    if (
        !pickupNodes?.length ||
        !runSlots?.length ||
        createRunInput.stops.length === 0 ||
        requestSnapshots.length !== createRunInput.stops.length
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
    for (const node of pickupNodes) {
        if (
            !Number.isInteger(node.sequence) ||
            node.sequence <= 0 ||
            pickupLocationIds.has(node.pickupLocationId) ||
            pickupSequences.has(node.sequence) ||
            (node.latitude === undefined) !== (node.longitude === undefined)
        ) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Delivery pickup nodes are invalid',
            );
        }
        if (node.latitude !== undefined && node.longitude !== undefined) {
            ensureCoordinates(node.latitude, node.longitude);
        }
        pickupLocationIds.add(node.pickupLocationId);
        pickupSequences.add(node.sequence);
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
    const normalizedStops = createRunInput.stops.map((stop) => {
        ensureCoordinates(stop.latitude, stop.longitude);
        const snapshot = snapshotsByRequestId.get(stop.deliveryRequestId);
        if (
            !snapshot ||
            !Number.isInteger(stop.sequence) ||
            stop.sequence <= 0 ||
            stopRequestIds.has(stop.deliveryRequestId) ||
            stopSequences.has(stop.sequence) ||
            stop.timeSlotId === undefined ||
            !timeSlotIds.has(stop.timeSlotId) ||
            stop.timeSlotId !== snapshot.slot.id ||
            stop.stopKey !== snapshot.stopKey ||
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
        stopRequestIds.add(stop.deliveryRequestId);
        stopSequences.add(stop.sequence);
        return {
            deliveryRequestId: stop.deliveryRequestId,
            sequence: stop.sequence,
            latitude: stop.latitude,
            longitude: stop.longitude,
            formattedAddress: stop.formattedAddress,
            ...(stop.estimatedArrivalAt
                ? { estimatedArrivalAt: iso(stop.estimatedArrivalAt) }
                : {}),
            ...(stop.estimatedTravelSeconds !== undefined
                ? { estimatedTravelSeconds: stop.estimatedTravelSeconds }
                : {}),
            ...(stop.estimatedDistanceMeters !== undefined
                ? { estimatedDistanceMeters: stop.estimatedDistanceMeters }
                : {}),
            timeSlotId: stop.timeSlotId,
            stopKey: stop.stopKey,
            requestDispatchEventId: stop.requestDispatchEventId,
            deliveryAddressId: stop.deliveryAddressId,
            deliveryAddressUpdatedAt: iso(stop.deliveryAddressUpdatedAt),
        };
    });

    return {
        formatVersion: 1,
        dispatchRevision,
        selectionRequestIds: [...selectionRequestIds],
        createRunInput: {
            driverUserId: createRunInput.driverUserId,
            timeSlotId: createRunInput.timeSlotId,
            ...(createRunInput.encodedPolyline
                ? { encodedPolyline: createRunInput.encodedPolyline }
                : {}),
            ...(createRunInput.totalDistanceMeters !== undefined
                ? { totalDistanceMeters: createRunInput.totalDistanceMeters }
                : {}),
            ...(createRunInput.totalDurationSeconds !== undefined
                ? { totalDurationSeconds: createRunInput.totalDurationSeconds }
                : {}),
            pickupNodes: pickupNodes.map((node) => ({
                ...node,
                sourceUpdatedAt: iso(node.sourceUpdatedAt),
            })),
            runSlots: normalizedSlots,
            stops: normalizedStops,
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
        where: inArray(deliveryRunStops.deliveryRequestId, requestIds),
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
        estimatesUpdatedAt: new Date(),
    });

    const pickupNodeIdsByLocationId = new Map<number, string>();
    const pickupNodeRows = plan.createRunInput.pickupNodes.map((node) => {
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
    });
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
    await db.insert(deliveryRunStops).values(
        plan.createRunInput.stops.map((stop) => {
            const runSlotId = runSlotIdsByTimeSlotId.get(stop.timeSlotId);
            const snapshot = snapshotsByRequestId.get(stop.deliveryRequestId);
            if (!runSlotId || !snapshot) {
                throw new DeliveryRunPersistenceError(
                    DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                    'Delivery stop has no persisted slot or request snapshot',
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
                latitude: stop.latitude,
                longitude: stop.longitude,
                formattedAddress: stop.formattedAddress,
                estimatedArrivalAt: stop.estimatedArrivalAt
                    ? new Date(stop.estimatedArrivalAt)
                    : undefined,
                estimatedTravelSeconds: stop.estimatedTravelSeconds,
                estimatedDistanceMeters: stop.estimatedDistanceMeters,
            };
        }),
    );
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
            preparation.plan.formatVersion !== 1 ||
            preparation.plan.createRunInput.driverUserId !== driverUserId
        ) {
            throw new DeliveryRunPersistenceError(
                DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
                'Delivery run preparation payload is invalid',
            );
        }

        await ensurePreparationCanCreateRun(preparation.plan, tx);
        await validatePreparationSnapshot(preparation.plan, tx);
        await validatePreparedBulkMembership(preparation.plan, tx);
        return await insertPreparedDeliveryRun(
            preparation.plan,
            preparationId,
            tx,
        );
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

    return rows.map(({ run, stop, runSlot }) => ({
        run,
        stop: { ...stop, runSlot },
    }));
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
    const rows = await storage()
        .select({ accountId: operations.accountId })
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
                ne(deliveryRunStops.state, DeliveryRunStopStates.DELIVERED),
            ),
        )
        .orderBy(asc(deliveryRunStops.sequence))
        .limit(1);

    return rows[0]?.accountId === accountId;
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
    accuracy?: number;
    heading?: number;
    speed?: number;
    recordedAt: Date;
}) {
    ensureCoordinates(latitude, longitude);

    const rows = await storage()
        .update(deliveryRuns)
        .set({
            currentLatitude: latitude,
            currentLongitude: longitude,
            currentLocationAccuracy: accuracy,
            currentLocationHeading: heading,
            currentLocationSpeed: speed,
            currentLocationRecordedAt: recordedAt,
        })
        .where(
            and(
                eq(deliveryRuns.id, runId),
                eq(deliveryRuns.driverUserId, driverUserId),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                or(
                    isNull(deliveryRuns.currentLocationRecordedAt),
                    lte(deliveryRuns.currentLocationRecordedAt, recordedAt),
                ),
            ),
        )
        .returning({ id: deliveryRuns.id });

    if (!rows[0]) {
        throw new Error('Active delivery run not found');
    }
}

export async function updateDeliveryRunEstimates({
    runId,
    encodedPolyline,
    totalDistanceMeters,
    totalDurationSeconds,
    estimates,
}: {
    runId: string;
    encodedPolyline?: string;
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    estimates: DeliveryRunStopEstimate[];
}) {
    await storage().transaction(async (tx) => {
        await tx
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
                    eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                ),
            );

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
                        ne(
                            deliveryRunStops.state,
                            DeliveryRunStopStates.DELIVERED,
                        ),
                    ),
                );
        }
    });
}

async function ensureOwnedDeliveryRunStops({
    driverUserId,
    runId,
    stopIds,
    db = storage(),
}: {
    driverUserId: string;
    runId: string;
    stopIds: number[];
    db?: DatabaseClient;
}) {
    const uniqueStopIds = Array.from(new Set(stopIds));
    if (uniqueStopIds.length === 0) {
        throw new Error('Active delivery stop not found');
    }

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

    const hasUndeliveredStops = stops.some(
        (stop) => stop.state !== DeliveryRunStopStates.DELIVERED,
    );
    if (hasUndeliveredStops) {
        const currentStop = await db.query.deliveryRunStops.findFirst({
            columns: { id: true },
            where: and(
                eq(deliveryRunStops.runId, runId),
                ne(deliveryRunStops.state, DeliveryRunStopStates.DELIVERED),
            ),
            orderBy: [asc(deliveryRunStops.sequence)],
        });
        if (currentStop && !uniqueStopIds.includes(currentStop.id)) {
            throw new Error('Delivery stops must be completed in route order');
        }
    }

    return stops;
}

export async function markDeliveryRunStopsArrived({
    driverUserId,
    runId,
    stopIds,
}: {
    driverUserId: string;
    runId: string;
    stopIds: number[];
}) {
    return await storage().transaction(async (tx) => {
        const stops = await ensureOwnedDeliveryRunStops({
            driverUserId,
            runId,
            stopIds,
            db: tx,
        });
        const now = new Date();

        for (const stop of stops) {
            if (stop.state === DeliveryRunStopStates.DELIVERED) {
                continue;
            }
            await tx
                .update(deliveryRunStops)
                .set({
                    state: DeliveryRunStopStates.ARRIVED,
                    arrivedAt: stop.arrivedAt ?? now,
                })
                .where(eq(deliveryRunStops.id, stop.id));
        }

        return stops;
    });
}

export async function markDeliveryRunStopArrived({
    driverUserId,
    runId,
    stopId,
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
}) {
    const stops = await markDeliveryRunStopsArrived({
        driverUserId,
        runId,
        stopIds: [stopId],
    });
    return stops[0];
}

export async function markDeliveryRunStopDelivered({
    driverUserId,
    runId,
    stopId,
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
}) {
    const requestIds = await storage().transaction(async (tx) =>
        markDeliveryRunStopsDeliveredInDatabase({
            driverUserId,
            runId,
            stopIds: [stopId],
            db: tx,
        }),
    );
    return requestIds[0];
}

async function markDeliveryRunStopsDeliveredInDatabase({
    driverUserId,
    runId,
    stopIds,
    db,
}: {
    driverUserId: string;
    runId: string;
    stopIds: number[];
    db: DatabaseClient;
}) {
    const stops = await ensureOwnedDeliveryRunStops({
        driverUserId,
        runId,
        stopIds,
        db,
    });
    const now = new Date();

    for (const stop of stops) {
        if (stop.state === DeliveryRunStopStates.DELIVERED) {
            continue;
        }
        await db
            .update(deliveryRunStops)
            .set({
                state: DeliveryRunStopStates.DELIVERED,
                arrivedAt: stop.arrivedAt ?? now,
                deliveredAt: now,
            })
            .where(eq(deliveryRunStops.id, stop.id));
    }

    const remaining = await db.query.deliveryRunStops.findFirst({
        columns: { id: true },
        where: and(
            eq(deliveryRunStops.runId, runId),
            ne(deliveryRunStops.state, DeliveryRunStopStates.DELIVERED),
        ),
    });

    if (!remaining) {
        await db
            .update(deliveryRuns)
            .set({
                state: DeliveryRunStates.COMPLETED,
                completedAt: new Date(),
                currentLatitude: null,
                currentLongitude: null,
                currentLocationAccuracy: null,
                currentLocationHeading: null,
                currentLocationSpeed: null,
                currentLocationRecordedAt: null,
            })
            .where(
                and(
                    eq(deliveryRuns.id, runId),
                    eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                ),
            );
    }

    return stops.map((stop) => stop.deliveryRequestId);
}

export async function fulfillDeliveryRunStops({
    driverUserId,
    runId,
    stopIds,
    deliveryNotes,
}: {
    driverUserId: string;
    runId: string;
    stopIds: number[];
    deliveryNotes?: string;
}) {
    return await withDeliveryDispatchTransaction(async (tx) => {
        const stops = await ensureOwnedDeliveryRunStops({
            driverUserId,
            runId,
            stopIds,
            db: tx,
        });
        for (const stop of stops) {
            await fulfillDeliveryRequest(
                stop.deliveryRequestId,
                deliveryNotes,
                tx,
            );
        }
        return await markDeliveryRunStopsDeliveredInDatabase({
            driverUserId,
            runId,
            stopIds,
            db: tx,
        });
    });
}

export async function fulfillDeliveryRunStop({
    driverUserId,
    runId,
    stopId,
    deliveryNotes,
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
    deliveryNotes?: string;
}) {
    const requestIds = await fulfillDeliveryRunStops({
        driverUserId,
        runId,
        stopIds: [stopId],
        deliveryNotes,
    });
    return requestIds[0];
}
