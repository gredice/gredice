import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    abandonDeliveryRun,
    accountCanTrackDeliveryRun,
    accountUsers,
    applyDeliveryRunHandoffMutations,
    applyDeliveryRunPickupMutations,
    applyDeliveryRunReroute,
    type CreatePreparedDeliveryRunInput,
    cancelDeliveryRequest,
    changeDeliveryRequestSlot,
    claimDeliveryRunReroute,
    clearExpiredDeliveryRunLocations,
    consumeDeliveryRunPreparation,
    createDeliveryAddress,
    createDeliveryRun,
    createEvent,
    DeliveryAddressMutationError,
    DeliveryRequestStates,
    DeliveryRunAssignmentError,
    DeliveryRunAssignmentErrorCodes,
    DeliveryRunCompletionOverrideReasons,
    DeliveryRunEstimateSources,
    DeliveryRunExceptionOutcomes,
    DeliveryRunExceptionReasons,
    DeliveryRunExecutionError,
    DeliveryRunExecutionErrorCodes,
    DeliveryRunHandoffItemStates,
    DeliveryRunHandoffOperationKinds,
    DeliveryRunHandoffSkipReasons,
    DeliveryRunManifestItemStates,
    DeliveryRunManifestStates,
    DeliveryRunPersistenceError,
    DeliveryRunPersistenceErrorCodes,
    DeliveryRunPickupOperationKinds,
    type DeliveryRunPreparationPlanPayloadV1,
    type DeliveryRunPreparationPlanPayloadV2,
    type DeliveryRunPreparationPlanPayloadV3,
    type DeliveryRunRequestSnapshotInput,
    DeliveryRunStates,
    DeliveryRunStopOperationKinds,
    DeliveryRunStopStates,
    deleteDeliveryAddress,
    deliveryRequests,
    deliveryRunExactLocationTtlMs,
    deliveryRunExceptionOperations,
    deliveryRunHandoffOperationRetentionMs,
    deliveryRunHandoffOperations,
    deliveryRunPickupNodes,
    deliveryRunPickupOperations,
    deliveryRunPreparations,
    deliveryRunRerouteLeaseMs,
    deliveryRunRoutePolyline,
    deliveryRunStopOperationOccurredAtIsAcceptable,
    deliveryRunStopOperations,
    deliveryRunStops,
    deliveryRunStopsAllowCompletion,
    deliveryRuns,
    events,
    farms,
    filterMissingDeliveryLifecycleNotifications,
    fulfillDeliveryRunStop,
    fulfillDeliveryRunStops,
    gardens,
    getActiveDeliveryRunStopsForRequestIds,
    getDeliveryDispatchRevision,
    getDeliveryLifecycleReconciliationCandidates,
    getDeliveryRequest,
    getDeliveryRequestDispatchSnapshots,
    getDeliveryRun,
    getDeliveryRunExecutionProgress,
    getDeliveryRunHandoffManifest,
    getDeliveryRunStopsForRequestIds,
    harvestTraceLinks,
    hasLegacyGoogleRouteArtifact,
    knownEvents,
    knownEventTypes,
    markDeliveryRunStopArrived,
    markDeliveryRunStopsArrived,
    operations,
    pickupLocations,
    pruneExpiredDeliveryRunHandoffOperations,
    type RecordDeliveryRunStopExceptionsInput,
    raisedBedFields,
    raisedBeds,
    readyDeliveryRequest,
    reassignDeliveryRun,
    recordDeliveryRunRouteProgressMilestones,
    recordDeliveryRunStopExceptions,
    recordDeliveryRunStopOperation,
    recoverDeliveryRunStop,
    retryDeliveryRunStop,
    saveDeliveryRunPreparation,
    storage,
    timeSlots,
    uncancelDeliveryRequest,
    updateDeliveryAddress,
    updateDeliveryRunEstimates,
    updateDeliveryRunLocation,
    updatePickupAwareDeliveryRunEstimates,
    updatePickupLocation,
    updateTimeSlot,
    users,
} from '@gredice/storage';
import { and, eq, inArray } from 'drizzle-orm';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

type DeliveryRunFixture = Awaited<ReturnType<typeof createDeliveryRunFixture>>;
type DeliveryRunExecutionStep = Awaited<
    ReturnType<typeof getDeliveryRunExecutionProgress>
>[number];
type DeliveryRunExecutionDeliveryStep = Extract<
    DeliveryRunExecutionStep,
    { kind: 'delivery' }
>;
let nextSupplementalOperationEntityId = 10_000;

function isRetryDeliveryStep(
    step: DeliveryRunExecutionStep,
): step is DeliveryRunExecutionDeliveryStep {
    return step.kind === 'delivery' && step.retryLaneRank !== undefined;
}

async function createDeliveryRunFixture({
    accountIndexes = [0],
    driverCount = 1,
}: {
    accountIndexes?: number[];
    driverCount?: number;
} = {}) {
    createTestDb();
    assert.ok(accountIndexes.length > 0);
    assert.ok(driverCount > 0);

    const accountCount = Math.max(...accountIndexes) + 1;
    const accountIds: string[] = [];
    for (let index = 0; index < accountCount; index += 1) {
        accountIds.push(await createTestAccount());
    }

    const driverUserIds = Array.from({ length: driverCount }, () =>
        randomUUID(),
    );
    await storage()
        .insert(users)
        .values(
            driverUserIds.map((driverUserId, index) => ({
                id: driverUserId,
                userName: `driver-${driverUserId}@example.test`,
                displayName: `Test Driver ${index + 1}`,
                role: 'driver',
            })),
        );

    const [location] = await storage()
        .insert(pickupLocations)
        .values({
            name: 'Test HQ',
            street1: 'Testna 1',
            city: 'Zagreb',
            postalCode: '10000',
            countryCode: 'HR',
        })
        .returning();
    assert.ok(location);

    const [slot] = await storage()
        .insert(timeSlots)
        .values({
            locationId: location.id,
            type: 'delivery',
            startAt: new Date('2026-07-13T08:00:00.000Z'),
            endAt: new Date('2026-07-13T10:00:00.000Z'),
        })
        .returning();
    assert.ok(slot);

    const operationRows = await storage()
        .insert(operations)
        .values(
            accountIndexes.map((accountIndex, index) => {
                const accountId = accountIds[accountIndex];
                assert.ok(accountId);
                return {
                    entityId: index + 1,
                    entityTypeName: 'operation',
                    accountId,
                };
            }),
        )
        .returning({ id: operations.id });
    assert.equal(operationRows.length, accountIndexes.length);

    const requestIds = operationRows.map(() => randomUUID());
    await storage()
        .insert(deliveryRequests)
        .values(
            operationRows.map((operation, index) => ({
                id: requestIds[index] ?? randomUUID(),
                operationId: operation.id,
            })),
        );

    return {
        accountIds,
        driverUserIds,
        locationId: location.id,
        operationIds: operationRows.map((operation) => operation.id),
        requestIds,
        timeSlotId: slot.id,
    };
}

async function createRequestEvents(fixture: DeliveryRunFixture) {
    for (const [index, requestId] of fixture.requestIds.entries()) {
        const operationId = fixture.operationIds[index];
        const accountId = fixture.accountIds[0];
        assert.ok(operationId);
        assert.ok(accountId);
        await createEvent(
            knownEvents.delivery.requestCreatedV1(requestId, {
                operationId,
                slotId: fixture.timeSlotId,
                mode: 'pickup',
                locationId: fixture.locationId,
                accountId,
            }),
        );
    }
}

function createRunStops(requestIds: string[]) {
    return requestIds.map((deliveryRequestId, index) => {
        const destinationIndex = Math.floor(index / 2);
        return {
            deliveryRequestId,
            sequence: index + 1,
            latitude: 45.8 + destinationIndex / 100,
            longitude: 15.97 + destinationIndex / 100,
            formattedAddress: `Testna ${destinationIndex + 1}, Zagreb, HR`,
            estimatedArrivalAt: new Date(
                Date.parse('2026-07-13T08:15:00.000Z') +
                    destinationIndex * 900_000,
            ),
            estimatedTravelSeconds: 600,
            estimatedDistanceMeters: 2_250,
        };
    });
}

function createRun({
    fixture,
    driverUserId,
    requestIds,
    stops,
    totalDistanceMeters = 4_500,
    totalDurationSeconds = 1_200,
}: {
    fixture: DeliveryRunFixture;
    driverUserId: string;
    requestIds: string[];
    stops?: ReturnType<typeof createRunStops>;
    totalDistanceMeters?: number;
    totalDurationSeconds?: number;
}) {
    return createDeliveryRun({
        driverUserId,
        timeSlotId: fixture.timeSlotId,
        totalDistanceMeters,
        totalDurationSeconds,
        stops: stops ?? createRunStops(requestIds),
    });
}

function snapshotAddress(address: {
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

function snapshotStopKey(
    slotId: number,
    address: Parameters<typeof snapshotAddress>[0],
) {
    return `${slotId}:${snapshotAddress(address)
        .normalize('NFKC')
        .toLocaleLowerCase('hr-HR')
        .replace(/\s*,\s*/g, ',')
        .replace(/\s+/g, ' ')
        .trim()}`;
}

async function createPreparedRunFixture({
    driverCount = 1,
    bulk = false,
}: {
    driverCount?: number;
    bulk?: boolean;
} = {}) {
    const fixture = await createDeliveryRunFixture({
        accountIndexes: [0, 0],
        driverCount,
    });
    const [accountId] = fixture.accountIds;
    const [firstRequestId, secondRequestId] = fixture.requestIds;
    const [firstOperationId, secondOperationId] = fixture.operationIds;
    assert.ok(accountId);
    assert.ok(firstRequestId);
    assert.ok(secondRequestId);
    assert.ok(firstOperationId);
    assert.ok(secondOperationId);

    const deliveryOperationIds = [firstOperationId, secondOperationId];
    const [farm] = await storage()
        .insert(farms)
        .values({
            name: `Delivery trace farm ${randomUUID()}`,
            latitude: 45.8,
            longitude: 15.97,
        })
        .returning();
    assert.ok(farm);
    const [garden] = await storage()
        .insert(gardens)
        .values({
            accountId,
            farmId: farm.id,
            name: `Delivery trace garden ${randomUUID()}`,
        })
        .returning();
    assert.ok(garden);
    const [raisedBed] = await storage()
        .insert(raisedBeds)
        .values({
            accountId,
            gardenId: garden.id,
            name: `Delivery trace bed ${randomUUID()}`,
        })
        .returning();
    assert.ok(raisedBed);
    const traceLinksByOperationId = new Map<
        number,
        typeof harvestTraceLinks.$inferSelect
    >();
    for (const [index, operationId] of Array.from(
        new Set(deliveryOperationIds),
    ).entries()) {
        const [field] = await storage()
            .insert(raisedBedFields)
            .values({ raisedBedId: raisedBed.id, positionIndex: index })
            .returning();
        assert.ok(field);
        const [plantPlaceEvent] = await storage()
            .insert(events)
            .values({
                type: 'test.delivery.harvest-trace',
                version: 1,
                aggregateId: `delivery-trace-${randomUUID()}`,
                data: {},
            })
            .returning({ id: events.id });
        assert.ok(plantPlaceEvent);
        await storage()
            .update(operations)
            .set({
                farmId: farm.id,
                gardenId: garden.id,
                raisedBedId: raisedBed.id,
                raisedBedFieldId: field.id,
            })
            .where(eq(operations.id, operationId));
        const publicToken = `${bulk ? 'bulk' : 'route'}-trace-${randomUUID()}`;
        const [traceLink] = await storage()
            .insert(harvestTraceLinks)
            .values({
                publicToken,
                accountId,
                gardenId: garden.id,
                raisedBedId: raisedBed.id,
                raisedBedFieldId: field.id,
                fieldPositionIndex: field.positionIndex,
                fieldLabel: `Polje ${index + 1}`,
                plantPlaceEventId: plantPlaceEvent.id,
                harvestOperationId: operationId,
                tracePath: `/trag/${publicToken}`,
            })
            .returning();
        assert.ok(traceLink);
        traceLinksByOperationId.set(operationId, traceLink);
    }

    const firstLocation = await storage().query.pickupLocations.findFirst({
        where: eq(pickupLocations.id, fixture.locationId),
    });
    const firstSlot = await storage().query.timeSlots.findFirst({
        where: eq(timeSlots.id, fixture.timeSlotId),
    });
    assert.ok(firstLocation);
    assert.ok(firstSlot);
    const [secondLocation] = await storage()
        .insert(pickupLocations)
        .values({
            name: 'Drugo skladište',
            street1: 'Ilica 10',
            city: 'Zagreb',
            postalCode: '10000',
            countryCode: 'HR',
        })
        .returning();
    assert.ok(secondLocation);
    const [secondSlot] = await storage()
        .insert(timeSlots)
        .values({
            locationId: secondLocation.id,
            type: 'delivery',
            startAt: new Date('2026-07-13T10:00:00.000Z'),
            endAt: new Date('2026-07-13T12:00:00.000Z'),
        })
        .returning();
    assert.ok(secondSlot);

    const addressIds = await Promise.all(
        ['Prva 1', 'Druga 2'].map((street1, index) =>
            createDeliveryAddress({
                accountId,
                label: `Adresa ${index + 1}`,
                contactName: `Primatelj ${index + 1}`,
                phone: `+385 91 000 000${index}`,
                street1,
                city: 'Zagreb',
                postalCode: '10000',
                countryCode: 'HR',
            }),
        ),
    );
    const slotIds = [firstSlot.id, secondSlot.id];
    for (const [index, requestId] of fixture.requestIds.entries()) {
        const operationId = deliveryOperationIds[index];
        const addressId = addressIds[bulk ? 0 : index];
        const slotId = slotIds[bulk ? 0 : index];
        assert.ok(operationId);
        assert.ok(addressId);
        assert.ok(slotId);
        await createEvent(
            knownEvents.delivery.requestCreatedV1(requestId, {
                operationId,
                slotId,
                mode: 'delivery',
                addressId,
                accountId,
            }),
        );
        await createEvent(
            knownEvents.delivery.requestReadyV1(requestId, {
                status: 'ready',
            }),
        );
    }

    const currentSnapshots = await getDeliveryRequestDispatchSnapshots(
        fixture.requestIds,
    );
    const requestSnapshots: DeliveryRunRequestSnapshotInput[] =
        currentSnapshots.map((snapshot) => {
            assert.ok(snapshot.address);
            assert.ok(snapshot.slot);
            assert.ok(snapshot.pickupLocation);
            return {
                deliveryRequestId: snapshot.deliveryRequestId,
                requestDispatchEventId: snapshot.requestDispatchEventId,
                state: snapshot.state,
                stopKey: snapshotStopKey(snapshot.slot.id, snapshot.address),
                address: {
                    id: snapshot.address.id,
                    updatedAt: snapshot.address.updatedAt,
                    label: snapshot.address.label,
                    contactName: snapshot.address.contactName,
                    phone: snapshot.address.phone,
                    street1: snapshot.address.street1,
                    street2: snapshot.address.street2,
                    city: snapshot.address.city,
                    postalCode: snapshot.address.postalCode,
                    countryCode: snapshot.address.countryCode,
                },
                slot: {
                    id: snapshot.slot.id,
                    updatedAt: snapshot.slot.updatedAt,
                    locationId: snapshot.slot.locationId,
                    startAt: snapshot.slot.startAt,
                    endAt: snapshot.slot.endAt,
                },
                pickupLocation: {
                    id: snapshot.pickupLocation.id,
                    updatedAt: snapshot.pickupLocation.updatedAt,
                    name: snapshot.pickupLocation.name,
                    street1: snapshot.pickupLocation.street1,
                    street2: snapshot.pickupLocation.street2,
                    city: snapshot.pickupLocation.city,
                    postalCode: snapshot.pickupLocation.postalCode,
                    countryCode: snapshot.pickupLocation.countryCode,
                },
            };
        });
    const snapshotsByRequestId = new Map(
        requestSnapshots.map((snapshot) => [
            snapshot.deliveryRequestId,
            snapshot,
        ]),
    );
    const locations = bulk ? [firstLocation] : [firstLocation, secondLocation];
    const slots = bulk ? [firstSlot] : [firstSlot, secondSlot];
    const createRunInput: CreatePreparedDeliveryRunInput = {
        driverUserId: fixture.driverUserIds[0] ?? '',
        timeSlotId: firstSlot.id,
        totalDistanceMeters: 8_000,
        totalDurationSeconds: 2_400,
        routePlanVersion: 2,
        estimateSource: 'local',
        pickupNodes: locations.map((location, index) => ({
            pickupLocationId: location.id,
            sequence: index + 1,
            itinerarySequence: index * 2 + 1,
            estimatedArrivalAt: new Date(
                Date.parse('2026-07-13T08:00:00.000Z') + index * 7_200_000,
            ),
            incomingTravelSeconds: index === 0 ? 0 : 900,
            incomingDistanceMeters: index === 0 ? 0 : 3_000,
            serviceDurationSeconds: 600,
            name: location.name,
            street1: location.street1,
            street2: location.street2,
            city: location.city,
            postalCode: location.postalCode,
            countryCode: location.countryCode,
            sourceUpdatedAt: location.updatedAt,
            latitude: 45.79 + index / 100,
            longitude: 15.96 + index / 100,
        })),
        runSlots: slots.map((slot, index) => ({
            timeSlotId: slot.id,
            pickupLocationId: slot.locationId,
            sequence: index + 1,
            manifestId: `manifest-${randomUUID()}`,
            windowStartAt: slot.startAt,
            windowEndAt: slot.endAt,
            sourceUpdatedAt: slot.updatedAt,
        })),
        stops: fixture.requestIds.map((deliveryRequestId, index) => {
            const snapshot = snapshotsByRequestId.get(deliveryRequestId);
            const physicalIndex = bulk ? 0 : index;
            assert.ok(snapshot);
            return {
                deliveryRequestId,
                sequence: index + 1,
                itinerarySequence: physicalIndex * 2 + 2,
                serviceDurationSeconds: 300,
                latitude: 45.8 + physicalIndex / 100,
                longitude: 15.97 + physicalIndex / 100,
                formattedAddress: snapshotAddress(snapshot.address),
                estimatedArrivalAt: new Date(
                    Date.parse('2026-07-13T08:15:00.000Z') +
                        physicalIndex * 7_200_000,
                ),
                estimatedTravelSeconds: 600,
                estimatedDistanceMeters: 2_250,
                timeSlotId: snapshot.slot.id,
                stopKey: snapshot.stopKey,
                requestDispatchEventId: snapshot.requestDispatchEventId,
                deliveryAddressId: snapshot.address.id,
                deliveryAddressUpdatedAt: snapshot.address.updatedAt,
            };
        }),
        manifestItems: fixture.requestIds.map((deliveryRequestId, index) => {
            const operationId = deliveryOperationIds[index];
            const traceLink = operationId
                ? traceLinksByOperationId.get(operationId)
                : undefined;
            assert.ok(traceLink);
            return {
                deliveryRequestId,
                timeSlotId: slotIds[bulk ? 0 : index] ?? firstSlot.id,
                harvestTraceLinkId: traceLink.id,
                traceToken: traceLink.publicToken,
            };
        }),
    };

    return {
        fixture,
        addressIds,
        createRunInput,
        requestSnapshots,
        traceLinks: Array.from(traceLinksByOperationId.values()),
        selectionRequestIds: [...fixture.requestIds],
        dispatchRevision: await getDeliveryDispatchRevision(),
    };
}

async function startPreparedBulkRunWithConfirmedPickup({
    driverCount = 1,
}: {
    driverCount?: number;
} = {}) {
    const prepared = await createPreparedRunFixture({
        bulk: true,
        driverCount,
    });
    const driverUserId = prepared.fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    const [pickup] = run.pickupNodes;
    const [manifest] = run.runSlots;
    assert.ok(pickup);
    assert.ok(manifest);
    await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: pickup.id,
        mutations: prepared.traceLinks.map((trace, index) => ({
            clientOperationId: `exception-fixture-scan-${index}`,
            occurredAt: new Date(
                Date.parse('2026-07-13T08:01:00.000Z') + index * 1000,
            ),
            kind: DeliveryRunPickupOperationKinds.SCAN,
            traceToken: trace.publicToken,
        })),
    });
    await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: pickup.id,
        mutations: [
            {
                clientOperationId: 'exception-fixture-confirm-manifest',
                occurredAt: new Date('2026-07-13T08:02:00.000Z'),
                kind: DeliveryRunPickupOperationKinds.CONFIRM_MANIFEST,
                manifestId: manifest.manifestId,
            },
        ],
    });
    return { prepared, run, driverUserId };
}

async function addReadyDeliveryRequest({
    prepared,
    addressId,
    slotId,
}: {
    prepared: Awaited<ReturnType<typeof createPreparedRunFixture>>;
    addressId: number;
    slotId: number;
}) {
    const accountId = prepared.fixture.accountIds[0];
    assert.ok(accountId);
    const [operation] = await storage()
        .insert(operations)
        .values({
            entityId: nextSupplementalOperationEntityId++,
            entityTypeName: 'operation',
            accountId,
        })
        .returning({ id: operations.id });
    assert.ok(operation);
    const requestId = randomUUID();
    await storage().insert(deliveryRequests).values({
        id: requestId,
        operationId: operation.id,
    });
    await createEvent(
        knownEvents.delivery.requestCreatedV1(requestId, {
            operationId: operation.id,
            slotId,
            mode: 'delivery',
            addressId,
            accountId,
        }),
    );
    await createEvent(
        knownEvents.delivery.requestReadyV1(requestId, { status: 'ready' }),
    );
    return requestId;
}

async function singleRequestPreparation({
    prepared,
    requestId,
    driverUserId,
}: {
    prepared: Awaited<ReturnType<typeof createPreparedRunFixture>>;
    requestId: string;
    driverUserId: string;
}) {
    const [dispatchSnapshot] = await getDeliveryRequestDispatchSnapshots([
        requestId,
    ]);
    const requestSnapshot = prepared.requestSnapshots.find(
        (snapshot) => snapshot.deliveryRequestId === requestId,
    );
    const stop = prepared.createRunInput.stops.find(
        (candidate) => candidate.deliveryRequestId === requestId,
    );
    const manifestItem = prepared.createRunInput.manifestItems.find(
        (candidate) => candidate.deliveryRequestId === requestId,
    );
    assert.ok(dispatchSnapshot);
    assert.ok(requestSnapshot);
    assert.ok(stop);
    assert.ok(manifestItem);
    return {
        dispatchRevision: await getDeliveryDispatchRevision(),
        selectionRequestIds: [requestId],
        requestSnapshots: [
            {
                ...requestSnapshot,
                state: dispatchSnapshot.state,
                requestDispatchEventId: dispatchSnapshot.requestDispatchEventId,
            },
        ],
        createRunInput: {
            ...prepared.createRunInput,
            driverUserId,
            runSlots: prepared.createRunInput.runSlots.map((slot) => ({
                ...slot,
                manifestId: `manifest-${randomUUID()}`,
            })),
            stops: [
                {
                    ...stop,
                    sequence: 1,
                    requestDispatchEventId:
                        dispatchSnapshot.requestDispatchEventId,
                },
            ],
            manifestItems: [manifestItem],
        },
    };
}

async function assertPersistenceError(promise: Promise<unknown>, code: string) {
    await assert.rejects(
        promise,
        (error) =>
            error instanceof DeliveryRunPersistenceError && error.code === code,
    );
}

async function assertExecutionError(promise: Promise<unknown>, code: string) {
    await assert.rejects(
        promise,
        (error) =>
            error instanceof DeliveryRunExecutionError && error.code === code,
    );
}

function asV2PreparationPlan(
    plan: DeliveryRunPreparationPlanPayloadV3,
): DeliveryRunPreparationPlanPayloadV2 {
    const { manifestItems: _manifestItems, ...createRunInput } =
        plan.createRunInput;
    return {
        ...plan,
        formatVersion: 2,
        createRunInput,
    };
}

function asLegacyPreparationPlan(
    plan: DeliveryRunPreparationPlanPayloadV2,
): DeliveryRunPreparationPlanPayloadV1 {
    return {
        formatVersion: 1,
        dispatchRevision: plan.dispatchRevision,
        selectionRequestIds: [...plan.selectionRequestIds],
        createRunInput: {
            driverUserId: plan.createRunInput.driverUserId,
            timeSlotId: plan.createRunInput.timeSlotId,
            ...(plan.createRunInput.encodedPolyline
                ? { encodedPolyline: plan.createRunInput.encodedPolyline }
                : {}),
            totalDistanceMeters: plan.createRunInput.totalDistanceMeters,
            totalDurationSeconds: plan.createRunInput.totalDurationSeconds,
            pickupNodes: plan.createRunInput.pickupNodes.map((node) => ({
                pickupLocationId: node.pickupLocationId,
                sequence: node.sequence,
                name: node.name,
                street1: node.street1,
                street2: node.street2,
                city: node.city,
                postalCode: node.postalCode,
                countryCode: node.countryCode,
                sourceUpdatedAt: node.sourceUpdatedAt,
                latitude: node.latitude,
                longitude: node.longitude,
            })),
            runSlots: plan.createRunInput.runSlots.map((slot) => ({ ...slot })),
            stops: plan.createRunInput.stops.map((stop) => ({
                deliveryRequestId: stop.deliveryRequestId,
                sequence: stop.sequence,
                latitude: stop.latitude,
                longitude: stop.longitude,
                formattedAddress: stop.formattedAddress,
                estimatedArrivalAt: stop.estimatedArrivalAt,
                estimatedTravelSeconds: stop.estimatedTravelSeconds,
                estimatedDistanceMeters: stop.estimatedDistanceMeters,
                timeSlotId: stop.timeSlotId,
                stopKey: stop.stopKey,
                requestDispatchEventId: stop.requestDispatchEventId,
                deliveryAddressId: stop.deliveryAddressId,
                deliveryAddressUpdatedAt: stop.deliveryAddressUpdatedAt,
            })),
        },
        requestSnapshots: plan.requestSnapshots.map((snapshot) => ({
            ...snapshot,
            address: { ...snapshot.address },
            slot: { ...snapshot.slot },
            pickupLocation: { ...snapshot.pickupLocation },
        })),
    };
}

test('delivery run fulfills a current bulk stop atomically and preserves route order', async () => {
    const fixture = await createDeliveryRunFixture({
        accountIndexes: [0, 0, 1, 0],
    });
    const [accountId, otherAccountId] = fixture.accountIds;
    const [driverUserId] = fixture.driverUserIds;
    const [firstRequestId, secondRequestId, thirdRequestId, nextRequestId] =
        fixture.requestIds;
    assert.ok(accountId);
    assert.ok(otherAccountId);
    assert.ok(driverUserId);
    assert.ok(firstRequestId);
    assert.ok(secondRequestId);
    assert.ok(thirdRequestId);
    assert.ok(nextRequestId);

    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: [firstRequestId, secondRequestId, thirdRequestId],
    });
    assert.equal(run.stops.length, 3);
    const [firstStop, secondStop, thirdStop] = run.stops;
    assert.ok(firstStop);
    assert.ok(secondStop);
    assert.ok(thirdStop);

    assert.equal(
        await accountCanTrackDeliveryRun({ accountId, runId: run.id }),
        true,
    );
    assert.equal(
        await accountCanTrackDeliveryRun({
            accountId: otherAccountId,
            runId: run.id,
        }),
        false,
    );
    await assert.rejects(
        markDeliveryRunStopArrived({
            driverUserId,
            runId: run.id,
            stopId: thirdStop.id,
        }),
        /route order/,
    );
    await assert.rejects(
        fulfillDeliveryRunStop({
            driverUserId,
            runId: run.id,
            stopId: thirdStop.id,
        }),
        /route order/,
    );
    assert.notEqual(
        (await getDeliveryRequest(thirdStop.deliveryRequestId))?.state,
        'fulfilled',
    );

    await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.801,
        longitude: 15.971,
        accuracy: 7,
        heading: 180,
        speed: 8.5,
        recordedAt: new Date('2026-07-13T08:05:00.000Z'),
    });
    await markDeliveryRunStopsArrived({
        driverUserId,
        runId: run.id,
        stopIds: [firstStop.id, secondStop.id],
    });
    const arrivedRun = await getDeliveryRun(run.id);
    assert.deepEqual(
        arrivedRun?.stops.slice(0, 2).map((stop) => stop.state),
        ['arrived', 'arrived'],
    );
    await fulfillDeliveryRunStops({
        driverUserId,
        runId: run.id,
        stopIds: [firstStop.id, secondStop.id],
    });
    assert.equal(
        (await getDeliveryRequest(firstStop.deliveryRequestId))?.state,
        'fulfilled',
    );
    assert.equal(
        (await getDeliveryRequest(secondStop.deliveryRequestId))?.state,
        'fulfilled',
    );
    assert.equal(
        await accountCanTrackDeliveryRun({ accountId, runId: run.id }),
        false,
    );
    assert.equal(
        await accountCanTrackDeliveryRun({
            accountId: otherAccountId,
            runId: run.id,
        }),
        true,
    );
    await fulfillDeliveryRunStop({
        driverUserId,
        runId: run.id,
        stopId: thirdStop.id,
    });

    const completedRun = await getDeliveryRun(run.id);
    assert.equal(completedRun?.state, 'completed');
    assert.ok(completedRun?.completedAt);
    assert.equal(completedRun.currentLatitude, null);
    assert.equal(completedRun.currentLongitude, null);
    assert.equal(completedRun.currentLocationAccuracy, null);
    assert.equal(completedRun.currentLocationHeading, null);
    assert.equal(completedRun.currentLocationSpeed, null);
    assert.equal(completedRun.currentLocationRecordedAt, null);
    assert.equal(completedRun.currentLocationReceivedAt, null);
    assert.equal(
        await accountCanTrackDeliveryRun({ accountId, runId: run.id }),
        false,
    );
    assert.equal(
        await accountCanTrackDeliveryRun({
            accountId: otherAccountId,
            runId: run.id,
        }),
        false,
    );
    await assert.rejects(
        fulfillDeliveryRunStops({
            driverUserId,
            runId: run.id,
            stopIds: [firstStop.id, secondStop.id],
        }),
        /Active delivery stop not found/,
    );

    const nextRun = await createRun({
        fixture,
        driverUserId,
        requestIds: [nextRequestId],
    });
    assert.notEqual(nextRun.id, run.id);
    assert.equal(nextRun.state, 'active');
});

test('concurrent arrival and delivery never regress a delivered stop', async () => {
    const fixture = await createDeliveryRunFixture();
    const [driverUserId] = fixture.driverUserIds;
    const [requestId] = fixture.requestIds;
    assert.ok(driverUserId);
    assert.ok(requestId);

    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: [requestId],
    });
    const [stop] = run.stops;
    assert.ok(stop);

    const [arrival, delivery] = await Promise.allSettled([
        markDeliveryRunStopArrived({
            driverUserId,
            runId: run.id,
            stopId: stop.id,
        }),
        fulfillDeliveryRunStop({
            driverUserId,
            runId: run.id,
            stopId: stop.id,
        }),
    ]);

    assert.equal(delivery.status, 'fulfilled');
    assert.ok(
        arrival.status === 'fulfilled' ||
            (arrival.reason instanceof Error &&
                /Active delivery stop not found/.test(arrival.reason.message)),
    );
    const completedRun = await getDeliveryRun(run.id);
    assert.equal(completedRun?.state, DeliveryRunStates.COMPLETED);
    assert.equal(
        completedRun?.stops[0]?.state,
        DeliveryRunStopStates.DELIVERED,
    );
    assert.ok(completedRun?.stops[0]?.deliveredAt);
});

test('same-driver route creation replays the active run and ignores a new selection', async () => {
    const fixture = await createDeliveryRunFixture({ accountIndexes: [0, 0] });
    const [driverUserId] = fixture.driverUserIds;
    const [firstRequestId, secondRequestId] = fixture.requestIds;
    assert.ok(driverUserId);
    assert.ok(firstRequestId);
    assert.ok(secondRequestId);

    const originalRun = await createRun({
        fixture,
        driverUserId,
        requestIds: [firstRequestId],
        totalDistanceMeters: 1_000,
        totalDurationSeconds: 300,
    });
    const replayedRun = await createRun({
        fixture,
        driverUserId,
        requestIds: [secondRequestId],
        totalDistanceMeters: 9_000,
        totalDurationSeconds: 3_000,
    });

    assert.equal(replayedRun.id, originalRun.id);
    assert.equal(replayedRun.totalDistanceMeters, 1_000);
    assert.equal(replayedRun.totalDurationSeconds, 300);
    assert.deepEqual(
        replayedRun.stops.map((stop) => stop.deliveryRequestId),
        [firstRequestId],
    );
});

test('concurrent cross-driver assignment permits one run and rolls back the loser', async () => {
    const fixture = await createDeliveryRunFixture({
        accountIndexes: [0, 0],
        driverCount: 2,
    });
    const [firstDriverUserId, secondDriverUserId] = fixture.driverUserIds;
    const [contestedRequestId, recoveryRequestId] = fixture.requestIds;
    assert.ok(firstDriverUserId);
    assert.ok(secondDriverUserId);
    assert.ok(contestedRequestId);
    assert.ok(recoveryRequestId);

    const attempts = await Promise.allSettled([
        createRun({
            fixture,
            driverUserId: firstDriverUserId,
            requestIds: [contestedRequestId],
        }),
        createRun({
            fixture,
            driverUserId: secondDriverUserId,
            requestIds: [contestedRequestId],
        }),
    ]);
    assert.equal(
        attempts.filter((result) => result.status === 'fulfilled').length,
        1,
    );
    assert.equal(
        attempts.filter((result) => result.status === 'rejected').length,
        1,
    );

    const winningIndex = attempts.findIndex(
        (result) => result.status === 'fulfilled',
    );
    assert.notEqual(winningIndex, -1);
    const losingDriverUserId =
        winningIndex === 0 ? secondDriverUserId : firstDriverUserId;
    const recoveryRun = await createRun({
        fixture,
        driverUserId: losingDriverUserId,
        requestIds: [recoveryRequestId],
    });
    assert.deepEqual(
        recoveryRun.stops.map((stop) => stop.deliveryRequestId),
        [recoveryRequestId],
    );
});

test('GPS acknowledgement replays identically without extending freshness and rejects conflicts', async () => {
    const fixture = await createDeliveryRunFixture();
    const [driverUserId] = fixture.driverUserIds;
    const [requestId] = fixture.requestIds;
    assert.ok(driverUserId);
    assert.ok(requestId);

    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: [requestId],
    });
    const latestRecordedAt = new Date('2026-07-13T08:10:00.000Z');
    const accepted = await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.812,
        longitude: 15.982,
        accuracy: 5,
        heading: 135,
        speed: 9.25,
        recordedAt: latestRecordedAt,
    });
    assert.equal(accepted.replayed, false);
    assert.ok(accepted.acceptedAt instanceof Date);
    assert.equal(accepted.previousAcceptedAt, null);

    const replayed = await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.812,
        longitude: 15.982,
        accuracy: 5,
        heading: 135,
        speed: 9.25,
        recordedAt: latestRecordedAt,
    });
    assert.equal(replayed.replayed, true);
    assert.deepEqual(replayed.acceptedAt, accepted.acceptedAt);
    assert.deepEqual(replayed.previousAcceptedAt, accepted.acceptedAt);

    await assertExecutionError(
        updateDeliveryRunLocation({
            runId: run.id,
            driverUserId,
            latitude: 45.7,
            longitude: 15.8,
            accuracy: 99,
            heading: 5,
            speed: 1,
            recordedAt: latestRecordedAt,
        }),
        DeliveryRunExecutionErrorCodes.LOCATION_CONFLICT,
    );

    await assertExecutionError(
        updateDeliveryRunLocation({
            runId: run.id,
            driverUserId,
            latitude: 45.7,
            longitude: 15.8,
            accuracy: 99,
            heading: 5,
            speed: 1,
            recordedAt: new Date('2026-07-13T08:09:59.000Z'),
        }),
        DeliveryRunExecutionErrorCodes.LOCATION_STALE,
    );

    const persistedRun = await getDeliveryRun(run.id);
    assert.equal(persistedRun?.currentLatitude, 45.812);
    assert.equal(persistedRun?.currentLongitude, 15.982);
    assert.equal(persistedRun?.currentLocationAccuracy, 5);
    assert.equal(persistedRun?.currentLocationHeading, 135);
    assert.equal(persistedRun?.currentLocationSpeed, 9.25);
    assert.equal(
        persistedRun?.currentLocationRecordedAt?.toISOString(),
        latestRecordedAt.toISOString(),
    );
    assert.deepEqual(
        persistedRun?.currentLocationReceivedAt,
        accepted.acceptedAt,
    );
});

test('tracking retention clears exact active telemetry after TTL and is idempotent', async () => {
    const fixture = await createDeliveryRunFixture({
        accountIndexes: [0, 1],
        driverCount: 2,
    });
    const [firstDriverUserId, secondDriverUserId] = fixture.driverUserIds;
    const [firstRequestId, secondRequestId] = fixture.requestIds;
    assert.ok(firstDriverUserId);
    assert.ok(secondDriverUserId);
    assert.ok(firstRequestId);
    assert.ok(secondRequestId);

    const firstRun = await createRun({
        fixture,
        driverUserId: firstDriverUserId,
        requestIds: [firstRequestId],
    });
    const secondRun = await createRun({
        fixture,
        driverUserId: secondDriverUserId,
        requestIds: [secondRequestId],
    });
    const now = new Date('2026-07-15T10:05:00.000Z');
    const exactBoundary = new Date(
        now.getTime() - deliveryRunExactLocationTtlMs,
    );
    await storage()
        .update(deliveryRuns)
        .set({
            currentLatitude: 45.812,
            currentLongitude: 15.982,
            currentLocationAccuracy: 5,
            currentLocationHeading: 135,
            currentLocationSpeed: 9.25,
            currentLocationRecordedAt: new Date(
                exactBoundary.getTime() - 1_000,
            ),
            currentLocationReceivedAt: exactBoundary,
        })
        .where(eq(deliveryRuns.id, firstRun.id));
    await storage()
        .update(deliveryRuns)
        .set({
            currentLatitude: 45.7,
            currentLongitude: 15.8,
            currentLocationAccuracy: 9,
            currentLocationHeading: 90,
            currentLocationSpeed: 4,
            currentLocationRecordedAt: new Date('2026-07-15T10:00:00.000Z'),
            currentLocationReceivedAt: null,
        })
        .where(eq(deliveryRuns.id, secondRun.id));

    const boundaryCleanup = await clearExpiredDeliveryRunLocations(now);
    assert.deepEqual(
        boundaryCleanup.map((row) => row.runId),
        [secondRun.id],
    );
    assert.equal((await getDeliveryRun(firstRun.id))?.currentLatitude, 45.812);

    const expired = await clearExpiredDeliveryRunLocations(
        new Date(now.getTime() + 1),
    );
    assert.deepEqual(
        expired.map((row) => row.runId),
        [firstRun.id],
    );
    const persisted = await getDeliveryRun(firstRun.id);
    assert.equal(persisted?.currentLatitude, null);
    assert.equal(persisted?.currentLongitude, null);
    assert.equal(persisted?.currentLocationAccuracy, null);
    assert.equal(persisted?.currentLocationHeading, null);
    assert.equal(persisted?.currentLocationSpeed, null);
    assert.equal(persisted?.currentLocationRecordedAt, null);
    assert.deepEqual(persisted?.currentLocationReceivedAt, exactBoundary);
    assert.deepEqual(
        await clearExpiredDeliveryRunLocations(new Date(now.getTime() + 2)),
        [],
    );
});

test('concurrent identical GPS submissions share one authoritative receipt', async () => {
    const fixture = await createDeliveryRunFixture();
    const [driverUserId] = fixture.driverUserIds;
    const [requestId] = fixture.requestIds;
    assert.ok(driverUserId);
    assert.ok(requestId);
    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: [requestId],
    });
    const payload = {
        runId: run.id,
        driverUserId,
        latitude: 45.812,
        longitude: 15.982,
        accuracy: 5,
        heading: 135,
        speed: 9.25,
        recordedAt: new Date('2026-07-13T08:10:00.000Z'),
    };

    const results = await Promise.all([
        updateDeliveryRunLocation(payload),
        updateDeliveryRunLocation(payload),
    ]);
    assert.deepEqual(results.map((result) => result.replayed).sort(), [
        false,
        true,
    ]);
    assert.deepEqual(results[0]?.acceptedAt, results[1]?.acceptedAt);
});

test('a slower estimate calculation cannot overwrite the route for a newer accepted GPS sample', async () => {
    const fixture = await createDeliveryRunFixture();
    const [driverUserId] = fixture.driverUserIds;
    const [requestId] = fixture.requestIds;
    assert.ok(driverUserId);
    assert.ok(requestId);
    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: [requestId],
    });
    const olderRecordedAt = new Date('2026-07-13T08:10:00.000Z');
    const olderAcknowledgement = await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.81,
        longitude: 15.97,
        recordedAt: olderRecordedAt,
    });
    const slowerOlderEstimate = {
        runId: run.id,
        driverUserId,
        expectedRouteRevision: run.routeRevision,
        expectedLocationRecordedAt: olderRecordedAt,
        expectedLocationReceivedAt: olderAcknowledgement.acceptedAt,
        encodedPolyline: 'older-route',
        totalDistanceMeters: 9_000,
        totalDurationSeconds: 1_800,
        estimates: [
            {
                deliveryRequestId: requestId,
                estimatedArrivalAt: new Date('2026-07-13T08:40:00.000Z'),
                estimatedTravelSeconds: 1_800,
                estimatedDistanceMeters: 9_000,
            },
        ],
    };

    const newerRecordedAt = new Date('2026-07-13T08:10:10.000Z');
    const newerAcknowledgement = await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.82,
        longitude: 15.98,
        recordedAt: newerRecordedAt,
    });
    const newerArrivalAt = new Date('2026-07-13T08:20:00.000Z');
    assert.equal(
        await updateDeliveryRunEstimates({
            runId: run.id,
            driverUserId,
            expectedRouteRevision: run.routeRevision,
            expectedLocationRecordedAt: newerRecordedAt,
            expectedLocationReceivedAt: newerAcknowledgement.acceptedAt,
            encodedPolyline: 'newer-route',
            totalDistanceMeters: 3_000,
            totalDurationSeconds: 600,
            estimates: [
                {
                    deliveryRequestId: requestId,
                    estimatedArrivalAt: newerArrivalAt,
                    estimatedTravelSeconds: 600,
                    estimatedDistanceMeters: 3_000,
                },
            ],
        }),
        true,
    );

    assert.equal(await updateDeliveryRunEstimates(slowerOlderEstimate), false);
    const persisted = await getDeliveryRun(run.id);
    assert.equal(
        hasLegacyGoogleRouteArtifact(persisted?.encodedPolyline),
        true,
    );
    assert.equal(
        deliveryRunRoutePolyline(persisted?.encodedPolyline),
        'newer-route',
    );
    assert.equal(persisted?.estimateSource, 'legacy');
    assert.equal(persisted?.totalDistanceMeters, 3_000);
    assert.equal(persisted?.totalDurationSeconds, 600);
    assert.equal(persisted?.stops[0]?.estimatedTravelSeconds, 600);
    assert.equal(persisted?.stops[0]?.estimatedDistanceMeters, 3_000);
    assert.deepEqual(persisted?.stops[0]?.estimatedArrivalAt, newerArrivalAt);

    const localRecordedAt = new Date('2026-07-13T08:10:20.000Z');
    const localAcknowledgement = await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.83,
        longitude: 15.99,
        recordedAt: localRecordedAt,
    });
    assert.equal(
        await updateDeliveryRunEstimates({
            runId: run.id,
            driverUserId,
            expectedRouteRevision: run.routeRevision,
            expectedLocationRecordedAt: localRecordedAt,
            expectedLocationReceivedAt: localAcknowledgement.acceptedAt,
            totalDistanceMeters: 2_500,
            totalDurationSeconds: 500,
            estimates: [
                {
                    deliveryRequestId: requestId,
                    estimatedArrivalAt: new Date('2026-07-13T08:18:40.000Z'),
                    estimatedTravelSeconds: 500,
                    estimatedDistanceMeters: 2_500,
                },
            ],
        }),
        true,
    );
    const localPersisted = await getDeliveryRun(run.id);
    assert.equal(localPersisted?.encodedPolyline, null);
    assert.equal(localPersisted?.estimateSource, 'legacy');
});

test('a modern pickup-aware route durably records bounded route-progress reconciliation sources without location data', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    const requestId = prepared.fixture.requestIds[0];
    assert.ok(driverUserId);
    assert.ok(requestId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    assert.equal(run.routePlanVersion, 2);
    const [stop] = run.stops;
    assert.ok(stop);
    const occurredAt = new Date('2026-07-13T08:10:00.000Z');
    const routeProgressMilestones = [
        'near-arrival',
        'next-stop',
        'delayed',
    ] as const;
    const milestoneSources = routeProgressMilestones.map((milestone) => ({
        deliveryRequestId: requestId,
        milestone,
        occurredAt,
        retryAttempt: stop.retryAttempt,
        stopId: stop.id,
    }));

    await assert.rejects(
        () =>
            Reflect.apply(recordDeliveryRunRouteProgressMilestones, undefined, [
                {
                    routeRevision: run.routeRevision,
                    runId: run.id,
                    milestones: [
                        {
                            deliveryRequestId: requestId,
                            milestone: 'arrived',
                            occurredAt,
                            retryAttempt: stop.retryAttempt,
                            stopId: stop.id,
                        },
                    ],
                },
            ]),
        /Invalid delivery route progress milestone/u,
    );

    await assert.rejects(
        () =>
            recordDeliveryRunRouteProgressMilestones({
                routeRevision: run.routeRevision,
                runId: run.id,
                milestones: milestoneSources,
            }),
        /Delivery route progress source is stale/u,
    );
    const [pickup] = run.pickupNodes;
    const [manifest] = run.runSlots;
    const [trace] = prepared.traceLinks;
    assert.ok(pickup);
    assert.ok(manifest);
    assert.ok(trace);
    await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: pickup.id,
        mutations: [
            {
                clientOperationId: 'route-progress-authority-scan',
                occurredAt: new Date('2026-07-13T08:08:00.000Z'),
                kind: DeliveryRunPickupOperationKinds.SCAN,
                traceToken: trace.publicToken,
            },
            {
                clientOperationId: 'route-progress-authority-confirm',
                occurredAt: new Date('2026-07-13T08:09:00.000Z'),
                kind: DeliveryRunPickupOperationKinds.CONFIRM_MANIFEST,
                manifestId: manifest.manifestId,
            },
        ],
    });

    const recorded = await recordDeliveryRunRouteProgressMilestones({
        routeRevision: run.routeRevision,
        runId: run.id,
        milestones: milestoneSources,
    });
    assert.equal(recorded.length, 3);
    assert.deepEqual(
        await recordDeliveryRunRouteProgressMilestones({
            routeRevision: run.routeRevision,
            runId: run.id,
            milestones: milestoneSources,
        }),
        [],
    );

    const sourceRows = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.delivery.requestRouteProgress),
            eq(events.aggregateId, requestId),
        ),
        orderBy: (event, { asc }) => [asc(event.id)],
    });
    assert.deepEqual(
        sourceRows.map(({ data }) => data),
        routeProgressMilestones.map((milestone) => ({
            milestone,
            occurredAt: occurredAt.toISOString(),
            retryAttempt: stop.retryAttempt,
            routeRevision: run.routeRevision,
            runId: run.id,
            stopId: stop.id,
        })),
    );
    assert.doesNotMatch(
        JSON.stringify(sourceRows),
        /latitude|longitude|formattedAddress|currentLocation/u,
    );

    const pending = await getDeliveryLifecycleReconciliationCandidates({
        limit: 20,
        startedAt: new Date(0),
    });
    const sourceEventIds = new Set(sourceRows.map(({ id }) => id));
    const routeProgressCandidates = pending.candidates.filter(({ eventId }) =>
        sourceEventIds.has(eventId),
    );
    assert.deepEqual(
        routeProgressCandidates.map(({ milestone, sourceKind }) => ({
            milestone,
            sourceKind,
        })),
        routeProgressMilestones.map((milestone) => ({
            milestone,
            sourceKind: 'route-progress',
        })),
    );
});

test('pickup confirmation records route-started only for pending unreleased manifest siblings', async () => {
    const prepared = await createPreparedRunFixture({ bulk: true });
    const driverUserId = prepared.fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        deliveryRequestIds: prepared.fixture.requestIds,
        driverUserId,
        preparationToken: saved.preparationToken,
    });
    const [pickup] = run.pickupNodes;
    const [manifest] = run.runSlots;
    const [pendingStop, cancelledStop] = run.stops;
    assert.ok(pickup);
    assert.ok(manifest);
    assert.ok(pendingStop);
    assert.ok(cancelledStop);
    await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: pickup.id,
        mutations: prepared.traceLinks.map((trace, index) => ({
            clientOperationId: `mixed-manifest-scan-${index}`,
            occurredAt: new Date(
                Date.parse('2026-07-13T08:01:00.000Z') + index * 1000,
            ),
            kind: DeliveryRunPickupOperationKinds.SCAN,
            traceToken: trace.publicToken,
        })),
    });
    await storage()
        .update(deliveryRunStops)
        .set({
            exceptionOccurredAt: new Date('2026-07-13T08:01:30.000Z'),
            exceptionReason: DeliveryRunExceptionReasons.CANCELLATION,
            releasedAt: new Date('2026-07-13T08:01:30.000Z'),
            state: DeliveryRunStopStates.CANCELLED,
        })
        .where(eq(deliveryRunStops.id, cancelledStop.id));
    await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: pickup.id,
        mutations: [
            {
                clientOperationId: 'mixed-manifest-confirm',
                occurredAt: new Date('2026-07-13T08:02:00.000Z'),
                kind: DeliveryRunPickupOperationKinds.CONFIRM_MANIFEST,
                manifestId: manifest.manifestId,
            },
        ],
    });

    const routeStartedSources = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.delivery.requestRouteStarted),
            inArray(events.aggregateId, [
                pendingStop.deliveryRequestId,
                cancelledStop.deliveryRequestId,
            ]),
        ),
    });
    assert.deepEqual(
        routeStartedSources.map(({ aggregateId }) => aggregateId),
        [pendingStop.deliveryRequestId],
    );
});

test('legacy GPS estimate updates cannot mark a pickup-aware route', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    const requestId = prepared.fixture.requestIds[0];
    assert.ok(driverUserId);
    assert.ok(requestId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    const recordedAt = new Date('2026-07-13T08:10:00.000Z');
    const acknowledgement = await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.81,
        longitude: 15.97,
        recordedAt,
    });

    assert.equal(
        await updateDeliveryRunEstimates({
            runId: run.id,
            driverUserId,
            expectedRouteRevision: run.routeRevision,
            expectedLocationRecordedAt: recordedAt,
            expectedLocationReceivedAt: acknowledgement.acceptedAt,
            encodedPolyline: 'must-not-mark-v2',
            totalDistanceMeters: 1,
            totalDurationSeconds: 1,
            estimates: [
                {
                    deliveryRequestId: requestId,
                    estimatedArrivalAt: new Date('2026-07-13T08:10:01.000Z'),
                    estimatedTravelSeconds: 1,
                    estimatedDistanceMeters: 1,
                },
            ],
        }),
        false,
    );
    const persisted = await getDeliveryRun(run.id);
    assert.equal(persisted?.routePlanVersion, 2);
    assert.equal(persisted?.estimateSource, DeliveryRunEstimateSources.LOCAL);
    assert.equal(
        deliveryRunRoutePolyline(persisted?.encodedPolyline),
        deliveryRunRoutePolyline(run.encodedPolyline),
    );
});

test('pickup-aware live estimates refresh every remaining checkpoint without changing itinerary order', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    const originalPickupOrder = new Map(
        run.pickupNodes.map((node) => [node.id, node.itinerarySequence]),
    );
    const originalStopOrder = new Map(
        run.stops.map((stop) => [stop.id, stop.itinerarySequence]),
    );
    const recordedAt = new Date('2026-07-16T08:10:00.000Z');
    const acknowledgement = await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.81,
        longitude: 15.97,
        recordedAt,
    });
    const estimatesUpdatedAt = new Date(
        acknowledgement.acceptedAt.getTime() + 1_000,
    );
    const progress = await getDeliveryRunExecutionProgress(run.id);
    const pickupEstimates = progress.flatMap((step, index) =>
        step.kind === 'pickup' && step.state !== 'completed'
            ? [
                  {
                      pickupNodeId: step.pickupNodeId,
                      estimatedArrivalAt: new Date(
                          estimatesUpdatedAt.getTime() + (index + 1) * 60_000,
                      ),
                      incomingTravelSeconds: 120 + index,
                      incomingDistanceMeters: 1_200 + index,
                  },
              ]
            : [],
    );
    const stopEstimates = progress.flatMap((step, index) =>
        step.kind === 'delivery' && step.state !== 'completed'
            ? [
                  {
                      stopIds: step.stopIds,
                      estimatedArrivalAt: new Date(
                          estimatesUpdatedAt.getTime() + (index + 1) * 60_000,
                      ),
                      estimatedTravelSeconds: 240 + index,
                      estimatedDistanceMeters: 2_400 + index,
                  },
              ]
            : [],
    );
    const refresh = {
        runId: run.id,
        driverUserId,
        expectedRouteRevision: run.routeRevision,
        expectedLocationRecordedAt: recordedAt,
        expectedLocationReceivedAt: acknowledgement.acceptedAt,
        estimatesUpdatedAt,
        encodedPolyline: 'fixed-live-route',
        estimateSource: DeliveryRunEstimateSources.GOOGLE,
        totalDistanceMeters: 6_400,
        totalDurationSeconds: 1_400,
        pickupEstimates,
        stopEstimates,
    };

    assert.equal(await updatePickupAwareDeliveryRunEstimates(refresh), true);
    const persisted = await getDeliveryRun(run.id);
    assert.ok(persisted);
    assert.equal(persisted.routeRevision, run.routeRevision);
    assert.equal(persisted.encodedPolyline, 'fixed-live-route');
    assert.equal(persisted.estimateSource, DeliveryRunEstimateSources.GOOGLE);
    assert.equal(persisted.totalDistanceMeters, 6_400);
    assert.equal(persisted.totalDurationSeconds, 1_400);
    assert.deepEqual(persisted.estimatesUpdatedAt, estimatesUpdatedAt);
    assert.deepEqual(
        new Map(
            persisted.pickupNodes.map((node) => [
                node.id,
                node.itinerarySequence,
            ]),
        ),
        originalPickupOrder,
    );
    assert.deepEqual(
        new Map(
            persisted.stops.map((stop) => [stop.id, stop.itinerarySequence]),
        ),
        originalStopOrder,
    );
    for (const estimate of pickupEstimates) {
        const pickup: (typeof persisted.pickupNodes)[number] | undefined =
            persisted.pickupNodes.find(
                (node) => node.id === estimate.pickupNodeId,
            );
        assert.deepEqual(
            {
                estimatedArrivalAt: pickup?.estimatedArrivalAt,
                incomingTravelSeconds: pickup?.incomingTravelSeconds,
                incomingDistanceMeters: pickup?.incomingDistanceMeters,
            },
            {
                estimatedArrivalAt: estimate.estimatedArrivalAt,
                incomingTravelSeconds: estimate.incomingTravelSeconds,
                incomingDistanceMeters: estimate.incomingDistanceMeters,
            },
        );
    }
    for (const estimate of stopEstimates) {
        for (const stopId of estimate.stopIds) {
            const stop: (typeof persisted.stops)[number] | undefined =
                persisted.stops.find((candidate) => candidate.id === stopId);
            assert.deepEqual(
                {
                    estimatedArrivalAt: stop?.estimatedArrivalAt,
                    estimatedTravelSeconds: stop?.estimatedTravelSeconds,
                    estimatedDistanceMeters: stop?.estimatedDistanceMeters,
                },
                {
                    estimatedArrivalAt: estimate.estimatedArrivalAt,
                    estimatedTravelSeconds: estimate.estimatedTravelSeconds,
                    estimatedDistanceMeters: estimate.estimatedDistanceMeters,
                },
            );
        }
    }

    const newerRecordedAt = new Date(recordedAt.getTime() + 10_000);
    await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.82,
        longitude: 15.98,
        recordedAt: newerRecordedAt,
    });
    assert.equal(
        await updatePickupAwareDeliveryRunEstimates({
            ...refresh,
            totalDistanceMeters: 99_999,
        }),
        false,
    );
    const afterStaleRefresh = await getDeliveryRun(run.id);
    assert.equal(afterStaleRefresh?.totalDistanceMeters, 6_400);
});

test('pickup-aware live estimate freshness rejects a partial checkpoint set atomically', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    const recordedAt = new Date('2026-07-16T09:10:00.000Z');
    const acknowledgement = await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.81,
        longitude: 15.97,
        recordedAt,
    });
    const estimatesUpdatedAt = new Date(
        acknowledgement.acceptedAt.getTime() + 1_000,
    );
    const progress = await getDeliveryRunExecutionProgress(run.id);
    const pickupEstimates = progress.flatMap((step) =>
        step.kind === 'pickup' && step.state !== 'completed'
            ? [
                  {
                      pickupNodeId: step.pickupNodeId,
                      estimatedArrivalAt: estimatesUpdatedAt,
                      incomingTravelSeconds: 60,
                      incomingDistanceMeters: 600,
                  },
              ]
            : [],
    );
    const stopEstimates = progress.flatMap((step) =>
        step.kind === 'delivery' && step.state !== 'completed'
            ? [
                  {
                      stopIds: step.stopIds,
                      estimatedArrivalAt: estimatesUpdatedAt,
                      estimatedTravelSeconds: 60,
                      estimatedDistanceMeters: 600,
                  },
              ]
            : [],
    );
    assert.ok(stopEstimates.length > 1);

    await assert.rejects(
        () =>
            updatePickupAwareDeliveryRunEstimates({
                runId: run.id,
                driverUserId,
                expectedRouteRevision: run.routeRevision,
                expectedLocationRecordedAt: recordedAt,
                expectedLocationReceivedAt: acknowledgement.acceptedAt,
                estimatesUpdatedAt,
                estimateSource: DeliveryRunEstimateSources.LOCAL,
                totalDistanceMeters: 1,
                totalDurationSeconds: 1,
                pickupEstimates,
                stopEstimates: stopEstimates.slice(1),
            }),
        (error: unknown) => {
            assert.ok(error instanceof DeliveryRunExecutionError);
            assert.equal(
                error.code,
                DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
            );
            return true;
        },
    );
    const persisted = await getDeliveryRun(run.id);
    assert.equal(persisted?.totalDistanceMeters, run.totalDistanceMeters);
    assert.equal(persisted?.totalDurationSeconds, run.totalDurationSeconds);
    assert.deepEqual(persisted?.estimatesUpdatedAt, run.estimatesUpdatedAt);
});

test('an estimate calculation cannot overwrite a route whose revision advanced at arrival', async () => {
    const fixture = await createDeliveryRunFixture();
    const [driverUserId] = fixture.driverUserIds;
    const [requestId] = fixture.requestIds;
    assert.ok(driverUserId);
    assert.ok(requestId);
    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: [requestId],
    });
    const [stop] = run.stops;
    assert.ok(stop);
    const recordedAt = new Date('2026-07-13T08:10:00.000Z');
    const acknowledgement = await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.81,
        longitude: 15.97,
        recordedAt,
    });

    await markDeliveryRunStopArrived({
        driverUserId,
        runId: run.id,
        stopId: stop.id,
        expectedRouteRevision: run.routeRevision,
    });
    assert.equal(
        await updateDeliveryRunEstimates({
            runId: run.id,
            driverUserId,
            expectedRouteRevision: run.routeRevision,
            expectedLocationRecordedAt: recordedAt,
            expectedLocationReceivedAt: acknowledgement.acceptedAt,
            encodedPolyline: 'stale-route',
            totalDistanceMeters: 9_000,
            totalDurationSeconds: 1_800,
            estimates: [
                {
                    deliveryRequestId: requestId,
                    estimatedArrivalAt: new Date('2026-07-13T08:40:00.000Z'),
                    estimatedTravelSeconds: 1_800,
                    estimatedDistanceMeters: 9_000,
                },
            ],
        }),
        false,
    );

    const persisted = await getDeliveryRun(run.id);
    assert.equal(persisted?.routeRevision, run.routeRevision + 1);
    assert.equal(persisted?.totalDistanceMeters, run.totalDistanceMeters);
    assert.equal(persisted?.totalDurationSeconds, run.totalDurationSeconds);
    assert.equal(
        persisted?.stops[0]?.estimatedTravelSeconds,
        stop.estimatedTravelSeconds,
    );
    assert.equal(
        persisted?.stops[0]?.estimatedDistanceMeters,
        stop.estimatedDistanceMeters,
    );
    assert.deepEqual(
        persisted?.stops[0]?.estimatedArrivalAt,
        stop.estimatedArrivalAt,
    );
});

test('cancelled bulk member rolls back fulfillment of the current route group', async () => {
    const fixture = await createDeliveryRunFixture({
        accountIndexes: [0, 0, 0],
    });
    await createRequestEvents(fixture);
    const [driverUserId] = fixture.driverUserIds;
    const [firstRequestId, secondRequestId] = fixture.requestIds;
    assert.ok(driverUserId);
    assert.ok(firstRequestId);
    assert.ok(secondRequestId);

    await cancelDeliveryRequest(
        secondRequestId,
        'admin',
        'Otkazano prije dostave',
    );
    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: fixture.requestIds,
    });
    const [firstStop, secondStop, thirdStop] = run.stops;
    assert.ok(firstStop);
    assert.ok(secondStop);
    assert.ok(thirdStop);

    await assert.rejects(
        fulfillDeliveryRunStops({
            driverUserId,
            runId: run.id,
            stopIds: [firstStop.id, secondStop.id],
        }),
        /Cannot fulfill a cancelled delivery request/,
    );

    const unchangedRun = await getDeliveryRun(run.id);
    assert.deepEqual(
        unchangedRun?.stops.map((stop) => stop.state),
        ['pending', 'pending', 'pending'],
    );
    assert.notEqual(
        (await getDeliveryRequest(firstRequestId))?.state,
        'fulfilled',
    );
    await assert.rejects(
        fulfillDeliveryRunStop({
            driverUserId,
            runId: run.id,
            stopId: thirdStop.id,
        }),
        /Delivery stops must be completed in route order/,
    );
});

test('bulk arrival records a lifecycle source only for the pending sibling that transitioned', async () => {
    const fixture = await createDeliveryRunFixture({ accountIndexes: [0, 0] });
    const [driverUserId] = fixture.driverUserIds;
    assert.ok(driverUserId);
    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: fixture.requestIds,
    });
    const [pendingStop, cancelledStop] = run.stops;
    assert.ok(pendingStop);
    assert.ok(cancelledStop);
    await storage()
        .update(deliveryRunStops)
        .set({
            exceptionOccurredAt: new Date('2026-07-13T08:01:30.000Z'),
            exceptionReason: DeliveryRunExceptionReasons.CANCELLATION,
            releasedAt: new Date('2026-07-13T08:01:30.000Z'),
            state: DeliveryRunStopStates.CANCELLED,
        })
        .where(eq(deliveryRunStops.id, cancelledStop.id));

    const recorded = await recordDeliveryRunStopOperation({
        clientOperationId: 'mixed-bulk-arrival',
        driverUserId,
        expectedRouteRevision: run.routeRevision,
        kind: DeliveryRunStopOperationKinds.ARRIVE,
        occurredAt: new Date(),
        runId: run.id,
        targetStopId: pendingStop.id,
    });
    assert.deepEqual(
        recorded.result.affectedStopIds.sort(),
        [pendingStop.id, cancelledStop.id].sort(),
    );
    const arrivedSources = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.delivery.requestArrived),
            inArray(events.aggregateId, [
                pendingStop.deliveryRequestId,
                cancelledStop.deliveryRequestId,
            ]),
        ),
    });
    assert.deepEqual(
        arrivedSources.map(({ aggregateId }) => aggregateId),
        [pendingStop.deliveryRequestId],
    );
});

test('[legacy] active run rejects source address and slot mutations while keeping snapshots', async () => {
    const fixture = await createDeliveryRunFixture();
    const [accountId] = fixture.accountIds;
    const [driverUserId] = fixture.driverUserIds;
    const [operationId] = fixture.operationIds;
    const [requestId] = fixture.requestIds;
    assert.ok(accountId);
    assert.ok(driverUserId);
    assert.ok(operationId);
    assert.ok(requestId);

    const addressId = await createDeliveryAddress({
        accountId,
        label: 'Početna adresa',
        contactName: 'Primatelj',
        phone: '+385 91 222 2222',
        street1: 'Stara 1',
        city: 'Zagreb',
        postalCode: '10000',
        countryCode: 'HR',
    });
    await createEvent(
        knownEvents.delivery.requestCreatedV1(requestId, {
            operationId,
            slotId: fixture.timeSlotId,
            mode: 'delivery',
            addressId,
            accountId,
        }),
    );
    const [newSlot] = await storage()
        .insert(timeSlots)
        .values({
            locationId: fixture.locationId,
            type: 'delivery',
            startAt: new Date('2099-07-13T11:00:00.000Z'),
            endAt: new Date('2099-07-13T13:00:00.000Z'),
        })
        .returning({ id: timeSlots.id });
    assert.ok(newSlot);
    const [plannedStop] = createRunStops([requestId]);
    assert.ok(plannedStop);
    const snapshotAddress = 'Stara 1, 10000 Zagreb, HR';
    assert.equal(
        (await getDeliveryRequest(requestId))?.address?.street1,
        'Stara 1',
    );
    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: [requestId],
        stops: [{ ...plannedStop, formattedAddress: snapshotAddress }],
    });
    assert.equal(run.stops[0]?.formattedAddress, snapshotAddress);

    for (const mutation of [
        updateDeliveryAddress({ id: addressId, street1: 'Nova 2' }, accountId),
        changeDeliveryRequestSlot(requestId, newSlot.id),
    ]) {
        await assert.rejects(
            mutation,
            (error) =>
                error instanceof DeliveryRunAssignmentError &&
                error.code ===
                    DeliveryRunAssignmentErrorCodes.ACTIVE_ASSIGNMENT_EXISTS,
        );
    }

    const changedRequest = await getDeliveryRequest(requestId);
    const unchangedRun = await getDeliveryRun(run.id);
    assert.equal(changedRequest?.address?.street1, 'Stara 1');
    assert.equal(changedRequest?.slot?.id, fixture.timeSlotId);
    assert.equal(unchangedRun?.timeSlotId, fixture.timeSlotId);
    assert.equal(unchangedRun?.stops[0]?.formattedAddress, snapshotAddress);
});

test('[legacy] bulk fulfillment completes the current physical group atomically', async () => {
    const fixture = await createDeliveryRunFixture({
        accountIndexes: [0, 0, 0],
    });
    const [driverUserId] = fixture.driverUserIds;
    assert.ok(driverUserId);

    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: fixture.requestIds,
    });
    const [firstStop, secondStop, thirdStop] = run.stops;
    assert.ok(firstStop);
    assert.ok(secondStop);
    assert.ok(thirdStop);

    await fulfillDeliveryRunStops({
        driverUserId,
        runId: run.id,
        stopIds: [firstStop.id, secondStop.id],
    });

    const skippedRun = await getDeliveryRun(run.id);
    assert.equal(skippedRun?.state, 'active');
    assert.deepEqual(
        skippedRun?.stops.map((stop) => stop.state),
        ['delivered', 'delivered', 'pending'],
    );
    assert.notEqual(
        (await getDeliveryRequest(thirdStop.deliveryRequestId))?.state,
        'fulfilled',
    );

    await fulfillDeliveryRunStop({
        driverUserId,
        runId: run.id,
        stopId: thirdStop.id,
    });
    assert.equal((await getDeliveryRun(run.id))?.state, 'completed');
});

test('[legacy] route reads keep default provenance and nullable itinerary fields', async () => {
    const fixture = await createDeliveryRunFixture();
    const run = await createRun({
        fixture,
        driverUserId: fixture.driverUserIds[0] ?? '',
        requestIds: fixture.requestIds,
    });

    assert.equal(run.routePlanVersion, 1);
    assert.equal(run.estimateSource, 'legacy');
    assert.equal(run.pickupNodes.length, 0);
    assert.ok(
        run.stops.every(
            (stop) =>
                stop.itinerarySequence === null &&
                stop.serviceDurationSeconds === null,
        ),
    );
});

test('prepared run persists multiple pickup locations, slots, manifests, and stable snapshots', async () => {
    const prepared = await createPreparedRunFixture();
    const [driverUserId] = prepared.fixture.driverUserIds;
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });

    assert.equal(run.routePlanVersion, 2);
    assert.equal(run.estimateSource, 'local');
    assert.equal(run.pickupNodes.length, 2);
    assert.equal(run.runSlots.length, 2);
    assert.equal(new Set(run.runSlots.map((slot) => slot.manifestId)).size, 2);
    assert.ok(
        run.runSlots.every(
            (slot) => slot.manifestState === DeliveryRunManifestStates.PENDING,
        ),
    );
    assert.ok(
        run.stops.every(
            (stop) =>
                stop.pickupItemState === DeliveryRunManifestItemStates.READY,
        ),
    );
    assert.deepEqual(
        run.stops.map((stop) => stop.runSlot?.id),
        run.runSlots.map((slot) => slot.id),
    );
    assert.deepEqual(
        run.pickupNodes.map((node) => node.sequence),
        [1, 2],
    );
    assert.deepEqual(
        run.pickupNodes.map((node) => node.itinerarySequence),
        [1, 3],
    );
    assert.deepEqual(
        run.pickupNodes.map((node) => node.incomingTravelSeconds),
        [0, 900],
    );
    assert.deepEqual(
        run.pickupNodes.map((node) => node.incomingDistanceMeters),
        [0, 3_000],
    );
    assert.deepEqual(
        run.pickupNodes.map((node) => node.serviceDurationSeconds),
        [600, 600],
    );
    assert.deepEqual(
        run.stops.map((stop) => stop.itinerarySequence),
        [2, 4],
    );
    assert.deepEqual(
        run.stops.map((stop) => stop.serviceDurationSeconds),
        [300, 300],
    );
    assert.ok(
        run.pickupNodes.every(
            (node) => node.estimatedArrivalAt instanceof Date,
        ),
    );
    const savedPreparation =
        await storage().query.deliveryRunPreparations.findFirst({
            where: eq(deliveryRunPreparations.id, saved.preparationId),
        });
    assert.equal(savedPreparation?.plan.formatVersion, 3);

    const [firstAddressId] = prepared.addressIds;
    const [firstNode] = run.pickupNodes;
    const [firstRunSlot] = run.runSlots;
    const [firstStop] = run.stops;
    assert.ok(firstAddressId);
    assert.ok(firstNode);
    assert.ok(firstRunSlot);
    assert.ok(firstStop);
    assert.ok(firstNode.pickupLocationId);
    assert.ok(firstRunSlot.timeSlotId);
    await assert.rejects(
        updateDeliveryAddress(
            { id: firstAddressId, street1: 'Promijenjena 99' },
            prepared.fixture.accountIds[0] ?? '',
        ),
        (error) =>
            error instanceof DeliveryRunAssignmentError &&
            error.code ===
                DeliveryRunAssignmentErrorCodes.ACTIVE_ASSIGNMENT_EXISTS,
    );
    await updatePickupLocation({
        id: firstNode.pickupLocationId,
        name: 'Promijenjeno skladište',
    });
    await assert.rejects(
        updateTimeSlot({
            id: firstRunSlot.timeSlotId,
            endAt: new Date('2026-07-13T10:30:00.000Z'),
        }),
        (error) =>
            error instanceof DeliveryRunAssignmentError &&
            error.code ===
                DeliveryRunAssignmentErrorCodes.ACTIVE_ASSIGNMENT_EXISTS,
    );

    const unchanged = await getDeliveryRun(run.id);
    assert.equal(unchanged?.pickupNodes[0]?.name, firstNode.name);
    assert.equal(
        unchanged?.runSlots[0]?.windowEndAt.toISOString(),
        firstRunSlot.windowEndAt.toISOString(),
    );
    assert.equal(
        unchanged?.stops[0]?.formattedAddress,
        firstStop.formattedAddress,
    );
    assert.equal(
        unchanged?.stops[0]?.deliveryContactName,
        firstStop.deliveryContactName,
    );
    const requestRows = await getDeliveryRunStopsForRequestIds([
        firstStop.deliveryRequestId,
    ]);
    assert.equal(requestRows[0]?.stop.runSlot?.id, firstRunSlot.id);
});

test('preparation rejects a manifest trace that is not the request current active trace', async () => {
    const prepared = await createPreparedRunFixture();
    const [firstItem, secondItem] = prepared.createRunInput.manifestItems;
    assert.ok(firstItem);
    assert.ok(secondItem?.traceToken);

    await assertPersistenceError(
        saveDeliveryRunPreparation({
            ...prepared,
            createRunInput: {
                ...prepared.createRunInput,
                manifestItems: [
                    { ...firstItem, traceToken: secondItem.traceToken },
                    secondItem,
                ],
            },
        }),
        DeliveryRunPersistenceErrorCodes.SOURCE_CHANGED,
    );
});

test('preparation consumption rejects revoked or newly activated trace provenance', async () => {
    const revokedPrepared = await createPreparedRunFixture();
    const revokedDriverUserId = revokedPrepared.fixture.driverUserIds[0];
    const [revokedTrace] = revokedPrepared.traceLinks;
    assert.ok(revokedDriverUserId);
    assert.ok(revokedTrace);
    const revokedSaved = await saveDeliveryRunPreparation(revokedPrepared);
    await storage()
        .update(harvestTraceLinks)
        .set({ status: 'revoked', revokedAt: new Date() })
        .where(eq(harvestTraceLinks.id, revokedTrace.id));
    await assertPersistenceError(
        consumeDeliveryRunPreparation({
            preparationToken: revokedSaved.preparationToken,
            driverUserId: revokedDriverUserId,
            deliveryRequestIds: revokedPrepared.fixture.requestIds,
        }),
        DeliveryRunPersistenceErrorCodes.SOURCE_CHANGED,
    );

    const activatedPrepared = await createPreparedRunFixture();
    const activatedDriverUserId = activatedPrepared.fixture.driverUserIds[0];
    const [activatedTrace] = activatedPrepared.traceLinks;
    const [firstItem, ...remainingItems] =
        activatedPrepared.createRunInput.manifestItems;
    assert.ok(activatedDriverUserId);
    assert.ok(activatedTrace);
    assert.ok(firstItem);
    await storage()
        .update(harvestTraceLinks)
        .set({ status: 'revoked', revokedAt: new Date() })
        .where(eq(harvestTraceLinks.id, activatedTrace.id));
    const preparedWithoutTrace = {
        ...activatedPrepared,
        createRunInput: {
            ...activatedPrepared.createRunInput,
            manifestItems: [
                {
                    deliveryRequestId: firstItem.deliveryRequestId,
                    timeSlotId: firstItem.timeSlotId,
                },
                ...remainingItems,
            ],
        },
    };
    const activatedSaved =
        await saveDeliveryRunPreparation(preparedWithoutTrace);
    await storage()
        .update(harvestTraceLinks)
        .set({ status: 'active', revokedAt: null })
        .where(eq(harvestTraceLinks.id, activatedTrace.id));
    await assertPersistenceError(
        consumeDeliveryRunPreparation({
            preparationToken: activatedSaved.preparationToken,
            driverUserId: activatedDriverUserId,
            deliveryRequestIds: activatedPrepared.fixture.requestIds,
        }),
        DeliveryRunPersistenceErrorCodes.SOURCE_CHANGED,
    );
});

test('pickup scan rejects trace provenance revoked after route creation', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    const [trace] = prepared.traceLinks;
    assert.ok(driverUserId);
    assert.ok(trace);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    const [pickup] = run.pickupNodes;
    const [stop] = run.stops;
    assert.ok(pickup);
    assert.ok(stop);
    await storage()
        .update(harvestTraceLinks)
        .set({ status: 'revoked', revokedAt: new Date() })
        .where(eq(harvestTraceLinks.id, trace.id));

    const [result] = await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: pickup.id,
        mutations: [
            {
                clientOperationId: 'scan-revoked-trace',
                occurredAt: new Date('2026-07-13T08:01:00.000Z'),
                kind: 'scan',
                traceToken: trace.publicToken,
            },
        ],
    });
    assert.equal(result?.result.outcome, 'not-found');
    assert.equal(
        (await getDeliveryRun(run.id))?.stops[0]?.pickupItemState,
        DeliveryRunManifestItemStates.READY,
    );
});

test('original selection can consume a preparation expanded with bulk siblings', async () => {
    const prepared = await createPreparedRunFixture({ bulk: true });
    const [driverUserId, selectedRequestId] = [
        prepared.fixture.driverUserIds[0],
        prepared.fixture.requestIds[0],
    ];
    assert.ok(driverUserId);
    assert.ok(selectedRequestId);
    const bulkPrepared = {
        ...prepared,
        selectionRequestIds: [selectedRequestId],
    };
    const saved = await saveDeliveryRunPreparation(bulkPrepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: [selectedRequestId],
    });
    assert.equal(run.stops.length, prepared.requestSnapshots.length);
    assert.deepEqual(
        run.stops.map((stop) => stop.sequence),
        [1, 2],
    );
    assert.deepEqual(
        run.stops.map((stop) => stop.itinerarySequence),
        [2, 2],
    );
    assert.equal(new Set(run.stops.map((stop) => stop.stopKey)).size, 1);
});

test('pickup mutations persist, replay safely, and activate a multi-location itinerary in order', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    const accountId = prepared.fixture.accountIds[0];
    assert.ok(driverUserId);
    assert.ok(accountId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    const [firstPickup, secondPickup] = run.pickupNodes;
    const [firstManifest, secondManifest] = run.runSlots;
    const [firstStop, secondStop] = run.stops;
    const [firstTrace, secondTrace] = prepared.traceLinks;
    assert.ok(firstPickup);
    assert.ok(secondPickup);
    assert.ok(firstManifest);
    assert.ok(secondManifest);
    assert.ok(firstStop);
    assert.ok(secondStop);
    assert.ok(firstTrace);
    assert.ok(secondTrace);

    assert.deepEqual(
        (await getDeliveryRunExecutionProgress(run.id)).map((step) => ({
            kind: step.kind,
            sequence: step.itinerarySequence,
            state: step.state,
        })),
        [
            { kind: 'pickup', sequence: 1, state: 'current' },
            { kind: 'delivery', sequence: 2, state: 'upcoming' },
            { kind: 'pickup', sequence: 3, state: 'upcoming' },
            { kind: 'delivery', sequence: 4, state: 'upcoming' },
        ],
    );
    assert.equal(
        await accountCanTrackDeliveryRun({ accountId, runId: run.id }),
        false,
    );
    await assertExecutionError(
        markDeliveryRunStopArrived({
            driverUserId,
            runId: run.id,
            stopId: firstStop.id,
        }),
        DeliveryRunExecutionErrorCodes.PICKUP_DEPENDENCY_PENDING,
    );

    const scanOccurredAt = new Date('2026-07-13T08:01:00.000Z');
    const [scanResult] = await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: firstPickup.id,
        mutations: [
            {
                clientOperationId: 'scan-first-pickup',
                occurredAt: scanOccurredAt,
                kind: 'scan',
                traceToken: `/trag/${firstTrace.publicToken}`,
            },
        ],
    });
    assert.equal(scanResult?.replayed, false);
    assert.deepEqual(scanResult?.result.affectedStopIds, [firstStop.id]);
    assert.equal(scanResult?.result.itemState, 'scanned');

    const [replayResult] = await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: firstPickup.id,
        mutations: [
            {
                clientOperationId: 'scan-first-pickup',
                occurredAt: scanOccurredAt,
                kind: 'scan',
                traceToken: firstTrace.publicToken,
            },
        ],
    });
    assert.equal(replayResult?.replayed, true);
    await assertExecutionError(
        applyDeliveryRunPickupMutations({
            driverUserId,
            runId: run.id,
            pickupNodeId: firstPickup.id,
            mutations: [
                {
                    clientOperationId: 'scan-first-pickup',
                    occurredAt: scanOccurredAt,
                    kind: 'scan',
                    traceToken: secondTrace.publicToken,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.PICKUP_OPERATION_CONFLICT,
    );

    const [receipt] = await storage()
        .select()
        .from(deliveryRunPickupOperations)
        .where(eq(deliveryRunPickupOperations.runId, run.id));
    assert.ok(receipt);
    assert.match(receipt.payloadHash, /^[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(receipt).includes(firstTrace.publicToken));

    await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: firstPickup.id,
        mutations: [
            {
                clientOperationId: 'confirm-first-manifest',
                occurredAt: new Date('2026-07-13T08:02:00.000Z'),
                kind: 'confirm-manifest',
                manifestId: firstManifest.manifestId,
            },
        ],
    });
    const [semanticConfirmationReplay] = await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: firstPickup.id,
        mutations: [
            {
                clientOperationId: 'confirm-first-manifest-again',
                occurredAt: new Date('2026-07-13T08:02:30.000Z'),
                kind: 'confirm-manifest',
                manifestId: firstManifest.manifestId,
            },
        ],
    });
    assert.equal(semanticConfirmationReplay?.replayed, false);
    assert.equal(semanticConfirmationReplay?.result.outcome, 'already-applied');
    const routeStartedEvents = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.delivery.requestRouteStarted),
            inArray(events.aggregateId, [
                firstStop.deliveryRequestId,
                secondStop.deliveryRequestId,
            ]),
        ),
    });
    assert.deepEqual(
        routeStartedEvents.map((event) => event.aggregateId),
        [firstStop.deliveryRequestId],
    );
    assert.deepEqual(routeStartedEvents[0]?.data, {
        runId: run.id,
        stopId: firstStop.id,
        retryAttempt: 0,
        clientOperationId: 'confirm-first-manifest',
        occurredAt: '2026-07-13T08:02:00.000Z',
        routeRevision: run.routeRevision,
    });
    assert.equal(
        await accountCanTrackDeliveryRun({ accountId, runId: run.id }),
        true,
    );
    await assertExecutionError(
        applyDeliveryRunPickupMutations({
            driverUserId,
            runId: run.id,
            pickupNodeId: secondPickup.id,
            mutations: [
                {
                    clientOperationId: 'future-pickup-change',
                    occurredAt: new Date('2026-07-13T08:03:00.000Z'),
                    kind: 'mark-item',
                    stopId: secondStop.id,
                    outcome: 'not-ready',
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.PICKUP_NOT_CURRENT,
    );

    await markDeliveryRunStopArrived({
        driverUserId,
        runId: run.id,
        stopId: firstStop.id,
    });
    await fulfillDeliveryRunStop({
        driverUserId,
        runId: run.id,
        stopId: firstStop.id,
    });
    assert.equal(
        (await getDeliveryRunExecutionProgress(run.id)).find(
            (step) => step.state === 'current',
        )?.kind,
        'pickup',
    );
    await assertExecutionError(
        applyDeliveryRunPickupMutations({
            driverUserId,
            runId: run.id,
            pickupNodeId: secondPickup.id,
            mutations: [
                {
                    clientOperationId: 'scan-first-pickup',
                    occurredAt: scanOccurredAt,
                    kind: 'scan',
                    traceToken: firstTrace.publicToken,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.PICKUP_OPERATION_CONFLICT,
    );

    await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: secondPickup.id,
        mutations: [
            {
                clientOperationId: 'second-not-ready',
                occurredAt: new Date('2026-07-13T10:00:00.000Z'),
                kind: 'mark-item',
                stopId: secondStop.id,
                outcome: 'not-ready',
            },
        ],
    });
    await assertExecutionError(
        applyDeliveryRunPickupMutations({
            driverUserId,
            runId: run.id,
            pickupNodeId: secondPickup.id,
            mutations: [
                {
                    clientOperationId: 'confirm-incomplete-second',
                    occurredAt: new Date('2026-07-13T10:01:00.000Z'),
                    kind: 'confirm-manifest',
                    manifestId: secondManifest.manifestId,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.PICKUP_MANIFEST_INCOMPLETE,
    );
    await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: secondPickup.id,
        mutations: [
            {
                clientOperationId: 'second-missing-label',
                occurredAt: new Date('2026-07-13T10:02:00.000Z'),
                kind: 'mark-item',
                stopId: secondStop.id,
                outcome: 'missing-label',
            },
            {
                clientOperationId: 'confirm-second-manifest',
                occurredAt: new Date('2026-07-13T10:03:00.000Z'),
                kind: 'confirm-manifest',
                manifestId: secondManifest.manifestId,
            },
        ],
    });
    const current = (await getDeliveryRunExecutionProgress(run.id)).find(
        (step) => step.state === 'current',
    );
    assert.equal(current?.kind, 'delivery');
    assert.deepEqual(current?.kind === 'delivery' ? current.stopIds : [], [
        secondStop.id,
    ]);
});

test('bulk pickup scans and customer completion remain atomic', async () => {
    const prepared = await createPreparedRunFixture({ bulk: true });
    const driverUserId = prepared.fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    const [pickup] = run.pickupNodes;
    const [manifest] = run.runSlots;
    const [firstStop, secondStop] = run.stops;
    const [firstTrace, secondTrace] = prepared.traceLinks;
    assert.ok(pickup);
    assert.ok(manifest);
    assert.ok(firstStop);
    assert.ok(secondStop);
    assert.ok(firstTrace);
    assert.ok(secondTrace);

    const scans = await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: pickup.id,
        mutations: [
            {
                clientOperationId: 'scan-first-bulk-label',
                occurredAt: new Date('2026-07-13T08:01:00.000Z'),
                kind: 'scan',
                traceToken: firstTrace.publicToken,
            },
            {
                clientOperationId: 'scan-second-bulk-label',
                occurredAt: new Date('2026-07-13T08:01:05.000Z'),
                kind: 'scan',
                traceToken: secondTrace.publicToken,
            },
        ],
    });
    assert.deepEqual(
        scans.map((scan) => scan.result.affectedStopIds),
        [[firstStop.id], [secondStop.id]],
    );
    await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: pickup.id,
        mutations: [
            {
                clientOperationId: 'confirm-bulk-manifest',
                occurredAt: new Date('2026-07-13T08:02:00.000Z'),
                kind: 'confirm-manifest',
                manifestId: manifest.manifestId,
            },
        ],
    });
    await assertExecutionError(
        fulfillDeliveryRunStop({
            driverUserId,
            runId: run.id,
            stopId: firstStop.id,
        }),
        DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
    );
    await fulfillDeliveryRunStops({
        driverUserId,
        runId: run.id,
        stopIds: [firstStop.id, secondStop.id],
    });
    assert.equal((await getDeliveryRun(run.id))?.state, 'completed');
});

test('a valid pickup scan promotes missing-label state and persists a matching receipt', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    const [trace] = prepared.traceLinks;
    assert.ok(driverUserId);
    assert.ok(trace);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    const [pickup] = run.pickupNodes;
    const [stop] = run.stops;
    assert.ok(pickup);
    assert.ok(stop);

    await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: pickup.id,
        mutations: [
            {
                clientOperationId: 'mark-missing-before-scan',
                occurredAt: new Date('2026-07-13T08:00:00.000Z'),
                kind: 'mark-item',
                stopId: stop.id,
                outcome: 'missing-label',
            },
        ],
    });
    assert.equal(
        (await getDeliveryRun(run.id))?.stops[0]?.pickupItemState,
        DeliveryRunManifestItemStates.MISSING_LABEL,
    );

    const [scanResult] = await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: pickup.id,
        mutations: [
            {
                clientOperationId: 'scan-after-missing-label',
                occurredAt: new Date('2026-07-13T08:01:00.000Z'),
                kind: 'scan',
                traceToken: trace.publicToken,
            },
        ],
    });
    assert.equal(scanResult?.result.outcome, 'applied');
    assert.equal(
        scanResult?.result.itemState,
        DeliveryRunManifestItemStates.SCANNED,
    );
    assert.equal(
        (await getDeliveryRun(run.id))?.stops[0]?.pickupItemState,
        DeliveryRunManifestItemStates.SCANNED,
    );

    const receipts = await storage()
        .select()
        .from(deliveryRunPickupOperations)
        .where(eq(deliveryRunPickupOperations.runId, run.id));
    const scanReceipt = receipts.find(
        (receipt) => receipt.clientOperationId === 'scan-after-missing-label',
    );
    assert.equal(
        scanReceipt?.result.itemState,
        DeliveryRunManifestItemStates.SCANNED,
    );
});

test('partial manifests remain pending until every item is scanned or marked missing-label', async () => {
    const prepared = await createPreparedRunFixture({ bulk: true });
    const [firstTrace] = prepared.traceLinks;
    assert.ok(firstTrace);
    const driverUserId = prepared.fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    const [pickup] = run.pickupNodes;
    const [manifest] = run.runSlots;
    const [firstStop, secondStop] = run.stops;
    assert.ok(pickup);
    assert.ok(manifest);
    assert.ok(firstStop);
    assert.ok(secondStop);

    await assertExecutionError(
        applyDeliveryRunPickupMutations({
            driverUserId,
            runId: run.id,
            pickupNodeId: pickup.id,
            mutations: [
                {
                    clientOperationId: 'rolled-back-manual-item',
                    occurredAt: new Date('2026-07-13T08:00:00.000Z'),
                    kind: 'mark-item',
                    stopId: firstStop.id,
                    outcome: 'missing-label',
                },
                {
                    clientOperationId: 'rolled-back-confirm',
                    occurredAt: new Date('2026-07-13T08:00:30.000Z'),
                    kind: 'confirm-manifest',
                    manifestId: manifest.manifestId,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.PICKUP_MANIFEST_INCOMPLETE,
    );
    const afterRollback = await getDeliveryRun(run.id);
    assert.ok(
        afterRollback?.stops.every(
            (stop) =>
                stop.pickupItemState === DeliveryRunManifestItemStates.READY,
        ),
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunPickupOperations)
                .where(eq(deliveryRunPickupOperations.runId, run.id))
        ).length,
        0,
    );

    await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: pickup.id,
        mutations: [
            {
                clientOperationId: 'scan-one-of-two',
                occurredAt: new Date('2026-07-13T08:01:00.000Z'),
                kind: 'scan',
                traceToken: firstTrace.publicToken,
            },
        ],
    });
    await assertExecutionError(
        applyDeliveryRunPickupMutations({
            driverUserId,
            runId: run.id,
            pickupNodeId: pickup.id,
            mutations: [
                {
                    clientOperationId: 'confirm-partial',
                    occurredAt: new Date('2026-07-13T08:02:00.000Z'),
                    kind: 'confirm-manifest',
                    manifestId: manifest.manifestId,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.PICKUP_MANIFEST_INCOMPLETE,
    );
    assert.equal(
        (await getDeliveryRun(run.id))?.runSlots[0]?.manifestState,
        DeliveryRunManifestStates.PENDING,
    );

    await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: pickup.id,
        mutations: [
            {
                clientOperationId: 'manual-missing-label',
                occurredAt: new Date('2026-07-13T08:03:00.000Z'),
                kind: 'mark-item',
                stopId: secondStop.id,
                outcome: 'missing-label',
            },
            {
                clientOperationId: 'confirm-complete',
                occurredAt: new Date('2026-07-13T08:04:00.000Z'),
                kind: 'confirm-manifest',
                manifestId: manifest.manifestId,
            },
        ],
    });
    assert.equal(
        (await getDeliveryRun(run.id))?.runSlots[0]?.manifestState,
        DeliveryRunManifestStates.CONFIRMED,
    );
});

test('tampered pickup-node and run-slot snapshots are rejected', async () => {
    const prepared = await createPreparedRunFixture();
    const firstNode = prepared.createRunInput.pickupNodes?.[0];
    const firstSlot = prepared.createRunInput.runSlots?.[0];
    assert.ok(firstNode);
    assert.ok(firstSlot);
    await assertPersistenceError(
        saveDeliveryRunPreparation({
            ...prepared,
            createRunInput: {
                ...prepared.createRunInput,
                pickupNodes: [
                    { ...firstNode, street1: 'Tampered pickup address' },
                    ...(prepared.createRunInput.pickupNodes?.slice(1) ?? []),
                ],
            },
        }),
        DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
    );
    await assertPersistenceError(
        saveDeliveryRunPreparation({
            ...prepared,
            createRunInput: {
                ...prepared.createRunInput,
                runSlots: [
                    {
                        ...firstSlot,
                        windowEndAt: new Date(
                            firstSlot.windowEndAt.getTime() + 60_000,
                        ),
                    },
                    ...(prepared.createRunInput.runSlots?.slice(1) ?? []),
                ],
            },
        }),
        DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
    );
});

test('v2 itinerary gaps, dependency violations, bulk splits, and invalid provenance are rejected', async () => {
    const prepared = await createPreparedRunFixture();
    const [firstNode, secondNode] = prepared.createRunInput.pickupNodes;
    const [firstStop, secondStop] = prepared.createRunInput.stops;
    assert.ok(firstNode);
    assert.ok(secondNode);
    assert.ok(firstStop);
    assert.ok(secondStop);

    await assertPersistenceError(
        saveDeliveryRunPreparation({
            ...prepared,
            createRunInput: {
                ...prepared.createRunInput,
                routePlanVersion: 1,
            },
        }),
        DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
    );
    await assertPersistenceError(
        saveDeliveryRunPreparation({
            ...prepared,
            createRunInput: {
                ...prepared.createRunInput,
                pickupNodes: [
                    { ...firstNode, sequence: 2 },
                    { ...secondNode, sequence: 1 },
                ],
            },
        }),
        DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
    );
    await assertPersistenceError(
        saveDeliveryRunPreparation({
            ...prepared,
            createRunInput: {
                ...prepared.createRunInput,
                pickupNodes: [
                    firstNode,
                    { ...secondNode, incomingDistanceMeters: -1 },
                ],
            },
        }),
        DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
    );
    await assertPersistenceError(
        saveDeliveryRunPreparation({
            ...prepared,
            createRunInput: {
                ...prepared.createRunInput,
                stops: [
                    { ...firstStop, sequence: 2 },
                    { ...secondStop, sequence: 1 },
                ],
            },
        }),
        DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
    );
    await assertPersistenceError(
        saveDeliveryRunPreparation({
            ...prepared,
            createRunInput: {
                ...prepared.createRunInput,
                stops: [{ ...firstStop, itinerarySequence: 1 }, secondStop],
            },
        }),
        DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
    );
    await assertPersistenceError(
        saveDeliveryRunPreparation({
            ...prepared,
            createRunInput: {
                ...prepared.createRunInput,
                stops: [firstStop, { ...secondStop, itinerarySequence: 5 }],
            },
        }),
        DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
    );
    await assertPersistenceError(
        saveDeliveryRunPreparation({
            ...prepared,
            createRunInput: {
                ...prepared.createRunInput,
                stops: [
                    { ...firstStop, formattedAddress: 'Tampered destination' },
                    secondStop,
                ],
            },
        }),
        DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
    );

    const bulkPrepared = await createPreparedRunFixture({ bulk: true });
    const [firstBulkStop, secondBulkStop] = bulkPrepared.createRunInput.stops;
    assert.ok(firstBulkStop);
    assert.ok(secondBulkStop);
    await assertPersistenceError(
        saveDeliveryRunPreparation({
            ...bulkPrepared,
            createRunInput: {
                ...bulkPrepared.createRunInput,
                stops: [
                    firstBulkStop,
                    { ...secondBulkStop, itinerarySequence: 3 },
                ],
            },
        }),
        DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
    );
});

test('persisted v3 itinerary tampering is rejected before run creation', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const preparation = await storage().query.deliveryRunPreparations.findFirst(
        {
            where: eq(deliveryRunPreparations.id, saved.preparationId),
        },
    );
    assert.equal(preparation?.plan.formatVersion, 3);
    if (preparation?.plan.formatVersion !== 3) {
        assert.fail('Expected a v3 delivery run preparation');
    }
    const [firstStop, ...remainingStops] =
        preparation.plan.createRunInput.stops;
    assert.ok(firstStop);
    await storage()
        .update(deliveryRunPreparations)
        .set({
            plan: {
                ...preparation.plan,
                createRunInput: {
                    ...preparation.plan.createRunInput,
                    stops: [
                        { ...firstStop, serviceDurationSeconds: -1 },
                        ...remainingStops,
                    ],
                },
            },
        })
        .where(eq(deliveryRunPreparations.id, saved.preparationId));

    await assertPersistenceError(
        consumeDeliveryRunPreparation({
            preparationToken: saved.preparationToken,
            driverUserId,
            deliveryRequestIds: prepared.fixture.requestIds,
        }),
        DeliveryRunPersistenceErrorCodes.INVALID_PLAN,
    );
    assert.equal(
        await storage().query.deliveryRuns.findFirst({
            where: eq(deliveryRuns.driverUserId, driverUserId),
        }),
        undefined,
    );
});

test('prepared run preserves the route calculation time near token expiry', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const now = new Date();
    const calculatedAt = new Date(now.getTime() - 110_000);
    await storage()
        .update(deliveryRunPreparations)
        .set({
            createdAt: calculatedAt,
            expiresAt: new Date(now.getTime() + 10_000),
        })
        .where(eq(deliveryRunPreparations.id, saved.preparationId));

    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });

    assert.deepEqual(run.estimatesUpdatedAt, calculatedAt);
    assert.ok(run.startedAt.getTime() - calculatedAt.getTime() >= 100_000);
});

test('existing v1 preparation tokens remain consumable as legacy routes', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const preparation = await storage().query.deliveryRunPreparations.findFirst(
        {
            where: eq(deliveryRunPreparations.id, saved.preparationId),
        },
    );
    if (preparation?.plan.formatVersion !== 3) {
        assert.fail('Expected a v3 delivery run preparation');
    }
    const legacyPlan = asLegacyPreparationPlan(
        asV2PreparationPlan(preparation.plan),
    );
    await storage()
        .update(deliveryRunPreparations)
        .set({
            plan: {
                ...legacyPlan,
                createRunInput: {
                    ...legacyPlan.createRunInput,
                    encodedPolyline: 'initial-legacy-google-route',
                },
            },
        })
        .where(eq(deliveryRunPreparations.id, saved.preparationId));

    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    assert.equal(run.routePlanVersion, 1);
    assert.equal(run.estimateSource, 'legacy');
    assert.equal(hasLegacyGoogleRouteArtifact(run.encodedPolyline), false);
    assert.equal(
        deliveryRunRoutePolyline(run.encodedPolyline),
        'initial-legacy-google-route',
    );
    assert.ok(
        run.pickupNodes.every(
            (node) =>
                node.itinerarySequence === null &&
                node.estimatedArrivalAt === null &&
                node.incomingTravelSeconds === null &&
                node.incomingDistanceMeters === null &&
                node.serviceDurationSeconds === null,
        ),
    );
    assert.ok(
        run.stops.every(
            (stop) =>
                stop.itinerarySequence === null &&
                stop.serviceDurationSeconds === null,
        ),
    );
});

test('existing v2 preparation tokens remain consumable with confirmed pickup dependencies', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const preparation = await storage().query.deliveryRunPreparations.findFirst(
        {
            where: eq(deliveryRunPreparations.id, saved.preparationId),
        },
    );
    if (preparation?.plan.formatVersion !== 3) {
        assert.fail('Expected a v3 delivery run preparation');
    }
    await storage()
        .update(deliveryRunPreparations)
        .set({ plan: asV2PreparationPlan(preparation.plan) })
        .where(eq(deliveryRunPreparations.id, saved.preparationId));

    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    assert.equal(run.routePlanVersion, 2);
    assert.ok(
        run.runSlots.every(
            (slot) =>
                slot.manifestState === DeliveryRunManifestStates.CONFIRMED,
        ),
    );
    assert.ok(run.stops.every((stop) => stop.pickupItemState === null));
    const current = (await getDeliveryRunExecutionProgress(run.id)).find(
        (step) => step.state === 'current',
    );
    assert.equal(current?.kind, 'delivery');
    const firstStop = run.stops[0];
    assert.ok(firstStop);
    await markDeliveryRunStopArrived({
        driverUserId,
        runId: run.id,
        stopId: firstStop.id,
    });
});

test('preparation rejects wrong owner or selection and expires without creating a run', async () => {
    const prepared = await createPreparedRunFixture({ driverCount: 2 });
    const [driverUserId, otherDriverUserId] = prepared.fixture.driverUserIds;
    assert.ok(driverUserId);
    assert.ok(otherDriverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);

    await assertPersistenceError(
        consumeDeliveryRunPreparation({
            preparationToken: saved.preparationToken,
            driverUserId,
            deliveryRequestIds: [prepared.fixture.requestIds[0] ?? ''],
        }),
        DeliveryRunPersistenceErrorCodes.PREPARATION_SELECTION_MISMATCH,
    );
    await assertPersistenceError(
        consumeDeliveryRunPreparation({
            preparationToken: saved.preparationToken,
            driverUserId: otherDriverUserId,
            deliveryRequestIds: prepared.fixture.requestIds,
        }),
        DeliveryRunPersistenceErrorCodes.PREPARATION_OWNER_MISMATCH,
    );
    await storage()
        .update(deliveryRunPreparations)
        .set({ expiresAt: new Date(0) })
        .where(eq(deliveryRunPreparations.id, saved.preparationId));
    await assertPersistenceError(
        consumeDeliveryRunPreparation({
            preparationToken: saved.preparationToken,
            driverUserId,
            deliveryRequestIds: prepared.fixture.requestIds,
        }),
        DeliveryRunPersistenceErrorCodes.PREPARATION_EXPIRED,
    );
    assert.equal(
        await storage().query.deliveryRuns.findFirst({
            where: eq(deliveryRuns.driverUserId, driverUserId),
        }),
        undefined,
    );
});

test('preparation cleanup removes stale rows while preserving recent replay', async () => {
    const expiredPrepared = await createPreparedRunFixture();
    const expiredSaved = await saveDeliveryRunPreparation(expiredPrepared);
    await assert.rejects(
        storage()
            .update(deliveryRunPreparations)
            .set({ consumedAt: new Date() })
            .where(eq(deliveryRunPreparations.id, expiredSaved.preparationId)),
        (error) =>
            error instanceof Error &&
            error.cause instanceof Error &&
            error.cause.message.includes(
                'delivery_run_preparations_consumption_shape_check',
            ),
    );
    await storage()
        .update(deliveryRunPreparations)
        .set({ expiresAt: new Date(0) })
        .where(eq(deliveryRunPreparations.id, expiredSaved.preparationId));

    const oldConsumedPrepared = await createPreparedRunFixture();
    const oldConsumedSaved =
        await saveDeliveryRunPreparation(oldConsumedPrepared);
    const oldConsumedRun = await consumeDeliveryRunPreparation({
        preparationToken: oldConsumedSaved.preparationToken,
        driverUserId: oldConsumedPrepared.fixture.driverUserIds[0] ?? '',
        deliveryRequestIds: oldConsumedPrepared.fixture.requestIds,
    });
    await storage()
        .update(deliveryRunPreparations)
        .set({ consumedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
        .where(eq(deliveryRunPreparations.id, oldConsumedSaved.preparationId));

    const recentConsumedPrepared = await createPreparedRunFixture();
    const recentConsumedSaved = await saveDeliveryRunPreparation(
        recentConsumedPrepared,
    );
    const recentConsumedRun = await consumeDeliveryRunPreparation({
        preparationToken: recentConsumedSaved.preparationToken,
        driverUserId: recentConsumedPrepared.fixture.driverUserIds[0] ?? '',
        deliveryRequestIds: recentConsumedPrepared.fixture.requestIds,
    });

    const cleanupTrigger = await createPreparedRunFixture();
    await saveDeliveryRunPreparation(cleanupTrigger);

    for (const preparationId of [
        expiredSaved.preparationId,
        oldConsumedSaved.preparationId,
    ]) {
        assert.equal(
            await storage().query.deliveryRunPreparations.findFirst({
                where: eq(deliveryRunPreparations.id, preparationId),
            }),
            undefined,
        );
    }
    assert.equal(
        (await getDeliveryRun(oldConsumedRun.id))?.id,
        oldConsumedRun.id,
    );
    assert.ok(
        await storage().query.deliveryRunPreparations.findFirst({
            where: eq(
                deliveryRunPreparations.id,
                recentConsumedSaved.preparationId,
            ),
        }),
    );
    const replayed = await consumeDeliveryRunPreparation({
        preparationToken: recentConsumedSaved.preparationToken,
        driverUserId: recentConsumedPrepared.fixture.driverUserIds[0] ?? '',
        deliveryRequestIds: recentConsumedPrepared.fixture.requestIds,
    });
    assert.equal(replayed.id, recentConsumedRun.id);
});

test('stale request revision and edited source roll back preparation consumption', async () => {
    const staleRequest = await createPreparedRunFixture();
    const [staleDriverUserId, staleRequestId] = [
        staleRequest.fixture.driverUserIds[0],
        staleRequest.fixture.requestIds[0],
    ];
    assert.ok(staleDriverUserId);
    assert.ok(staleRequestId);
    const staleSaved = await saveDeliveryRunPreparation(staleRequest);
    await createEvent(
        knownEvents.delivery.requestPreparingV1(staleRequestId, {
            status: 'preparing',
        }),
    );
    await assertPersistenceError(
        consumeDeliveryRunPreparation({
            preparationToken: staleSaved.preparationToken,
            driverUserId: staleDriverUserId,
            deliveryRequestIds: staleRequest.fixture.requestIds,
        }),
        DeliveryRunPersistenceErrorCodes.REQUEST_CHANGED,
    );

    const changedSource = await createPreparedRunFixture();
    const [sourceDriverUserId] = changedSource.fixture.driverUserIds;
    const [sourceAddressId] = changedSource.addressIds;
    assert.ok(sourceDriverUserId);
    assert.ok(sourceAddressId);
    const sourceSaved = await saveDeliveryRunPreparation(changedSource);
    await updateDeliveryAddress(
        { id: sourceAddressId, street1: 'Nova ruta 5' },
        changedSource.fixture.accountIds[0] ?? '',
    );
    await assertPersistenceError(
        consumeDeliveryRunPreparation({
            preparationToken: sourceSaved.preparationToken,
            driverUserId: sourceDriverUserId,
            deliveryRequestIds: changedSource.fixture.requestIds,
        }),
        DeliveryRunPersistenceErrorCodes.SOURCE_CHANGED,
    );

    for (const saved of [staleSaved, sourceSaved]) {
        const row = await storage().query.deliveryRunPreparations.findFirst({
            where: eq(deliveryRunPreparations.id, saved.preparationId),
        });
        assert.equal(row?.consumedAt, null);
        assert.equal(row?.deliveryRunId, null);
    }
    for (const driverUserId of [staleDriverUserId, sourceDriverUserId]) {
        assert.equal(
            await storage().query.deliveryRuns.findFirst({
                where: eq(deliveryRuns.driverUserId, driverUserId),
            }),
            undefined,
        );
    }
});

test('unrelated delivery events do not invalidate a saved preparation', async () => {
    const prepared = await createPreparedRunFixture();
    const [driverUserId] = prepared.fixture.driverUserIds;
    const firstSnapshot = prepared.requestSnapshots[0];
    assert.ok(driverUserId);
    assert.ok(firstSnapshot);
    const saved = await saveDeliveryRunPreparation(prepared);
    const unrelatedAddressId = await createDeliveryAddress({
        accountId: prepared.fixture.accountIds[0] ?? '',
        label: 'Nepovezana adresa',
        contactName: 'Drugi primatelj',
        phone: '+385 91 999 9999',
        street1: 'Nepovezana 100',
        city: 'Zagreb',
        postalCode: '10000',
        countryCode: 'HR',
    });
    await addReadyDeliveryRequest({
        prepared,
        addressId: unrelatedAddressId,
        slotId: firstSnapshot.slot.id,
    });

    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    assert.equal(run.stops.length, prepared.fixture.requestIds.length);
});

test('newly ready bulk siblings invalidate preparation save and consumption', async () => {
    const staleBeforeSave = await createPreparedRunFixture();
    const beforeSaveSnapshot = staleBeforeSave.requestSnapshots[0];
    assert.ok(beforeSaveSnapshot);
    await addReadyDeliveryRequest({
        prepared: staleBeforeSave,
        addressId: beforeSaveSnapshot.address.id,
        slotId: beforeSaveSnapshot.slot.id,
    });
    await assertPersistenceError(
        saveDeliveryRunPreparation(staleBeforeSave),
        DeliveryRunPersistenceErrorCodes.REQUEST_CHANGED,
    );

    const staleAfterSave = await createPreparedRunFixture();
    const [driverUserId] = staleAfterSave.fixture.driverUserIds;
    const afterSaveSnapshot = staleAfterSave.requestSnapshots[0];
    assert.ok(driverUserId);
    assert.ok(afterSaveSnapshot);
    const saved = await saveDeliveryRunPreparation(staleAfterSave);
    await addReadyDeliveryRequest({
        prepared: staleAfterSave,
        addressId: afterSaveSnapshot.address.id,
        slotId: afterSaveSnapshot.slot.id,
    });
    await assertPersistenceError(
        consumeDeliveryRunPreparation({
            preparationToken: saved.preparationToken,
            driverUserId,
            deliveryRequestIds: staleAfterSave.fixture.requestIds,
        }),
        DeliveryRunPersistenceErrorCodes.REQUEST_CHANGED,
    );
});

test('concurrent preparation replay returns one persisted run', async () => {
    const prepared = await createPreparedRunFixture();
    const [driverUserId] = prepared.fixture.driverUserIds;
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const consume = () =>
        consumeDeliveryRunPreparation({
            preparationToken: saved.preparationToken,
            driverUserId,
            deliveryRequestIds: prepared.fixture.requestIds,
        });
    const [first, second] = await Promise.all([consume(), consume()]);
    assert.equal(first.id, second.id);
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRuns)
                .where(eq(deliveryRuns.driverUserId, driverUserId))
        ).length,
        1,
    );
    const preparation = await storage().query.deliveryRunPreparations.findFirst(
        {
            where: eq(deliveryRunPreparations.id, saved.preparationId),
        },
    );
    assert.equal(preparation?.deliveryRunId, first.id);
    assert.ok(preparation?.consumedAt);
});

test('cross-driver prepared run contention assigns each request only once', async () => {
    const prepared = await createPreparedRunFixture({ driverCount: 2 });
    const [firstDriverUserId, secondDriverUserId] =
        prepared.fixture.driverUserIds;
    assert.ok(firstDriverUserId);
    assert.ok(secondDriverUserId);
    const firstSaved = await saveDeliveryRunPreparation(prepared);
    const secondPrepared = {
        ...prepared,
        createRunInput: {
            ...prepared.createRunInput,
            driverUserId: secondDriverUserId,
        },
    };
    const secondSaved = await saveDeliveryRunPreparation(secondPrepared);
    const attempts = await Promise.allSettled([
        consumeDeliveryRunPreparation({
            preparationToken: firstSaved.preparationToken,
            driverUserId: firstDriverUserId,
            deliveryRequestIds: prepared.fixture.requestIds,
        }),
        consumeDeliveryRunPreparation({
            preparationToken: secondSaved.preparationToken,
            driverUserId: secondDriverUserId,
            deliveryRequestIds: prepared.fixture.requestIds,
        }),
    ]);
    assert.equal(
        attempts.filter((attempt) => attempt.status === 'fulfilled').length,
        1,
    );
    const rejection = attempts.find(
        (attempt): attempt is PromiseRejectedResult =>
            attempt.status === 'rejected',
    );
    assert.ok(rejection);
    assert.ok(rejection.reason instanceof DeliveryRunPersistenceError);
    assert.equal(
        rejection.reason.code,
        DeliveryRunPersistenceErrorCodes.ALREADY_ASSIGNED,
    );
    assert.equal(
        (await getDeliveryRunStopsForRequestIds(prepared.fixture.requestIds))
            .length,
        prepared.fixture.requestIds.length,
    );
});

test('route snapshot constraints reject incomplete and cross-run stop references', async () => {
    const legacyFixture = await createDeliveryRunFixture();
    const legacyRun = await createRun({
        fixture: legacyFixture,
        driverUserId: legacyFixture.driverUserIds[0] ?? '',
        requestIds: legacyFixture.requestIds,
    });
    const [legacyStop] = legacyRun.stops;
    assert.ok(legacyStop);
    await assert.rejects(
        storage()
            .update(deliveryRunStops)
            .set({ stopKey: 'partial-snapshot' })
            .where(eq(deliveryRunStops.id, legacyStop.id)),
        (error) =>
            error instanceof Error &&
            error.cause instanceof Error &&
            error.cause.message.includes('snapshot_shape_check'),
    );
    await assert.rejects(
        storage()
            .update(deliveryRunStops)
            .set({ itinerarySequence: 1 })
            .where(eq(deliveryRunStops.id, legacyStop.id)),
        (error) =>
            error instanceof Error &&
            error.cause instanceof Error &&
            error.cause.message.includes('itinerary_shape_check'),
    );
    await assert.rejects(
        storage()
            .update(deliveryRuns)
            .set({ routePlanVersion: 2 })
            .where(eq(deliveryRuns.id, legacyRun.id)),
        (error) =>
            error instanceof Error &&
            error.cause instanceof Error &&
            error.cause.message.includes('route_plan_provenance_check'),
    );

    const firstPrepared = await createPreparedRunFixture();
    const firstSaved = await saveDeliveryRunPreparation(firstPrepared);
    const firstRun = await consumeDeliveryRunPreparation({
        preparationToken: firstSaved.preparationToken,
        driverUserId: firstPrepared.fixture.driverUserIds[0] ?? '',
        deliveryRequestIds: firstPrepared.fixture.requestIds,
    });
    const [firstPickupNode] = firstRun.pickupNodes;
    assert.ok(firstPickupNode);
    await assert.rejects(
        storage()
            .update(deliveryRunPickupNodes)
            .set({ serviceDurationSeconds: null })
            .where(eq(deliveryRunPickupNodes.id, firstPickupNode.id)),
        (error) =>
            error instanceof Error &&
            error.cause instanceof Error &&
            error.cause.message.includes('itinerary_shape_check'),
    );
    const secondPrepared = await createPreparedRunFixture();
    const secondSaved = await saveDeliveryRunPreparation(secondPrepared);
    const secondRun = await consumeDeliveryRunPreparation({
        preparationToken: secondSaved.preparationToken,
        driverUserId: secondPrepared.fixture.driverUserIds[0] ?? '',
        deliveryRequestIds: secondPrepared.fixture.requestIds,
    });
    const [firstStop] = firstRun.stops;
    const [secondRunSlot] = secondRun.runSlots;
    assert.ok(firstStop);
    assert.ok(secondRunSlot);
    await assert.rejects(
        storage()
            .update(deliveryRunStops)
            .set({ runSlotId: secondRunSlot.id })
            .where(eq(deliveryRunStops.id, firstStop.id)),
        (error) =>
            error instanceof Error &&
            error.cause instanceof Error &&
            error.cause.message.includes('delivery_run_stops_run_slot_fk'),
    );
});

test('delivery exceptions persist item outcomes, replay safely, and keep customer projections private', async () => {
    const { run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [firstStop, secondStop] = run.stops;
    assert.ok(firstStop);
    assert.ok(secondStop);
    const occurredAt = new Date('2026-07-13T08:10:00.000Z');
    const privateNote = 'Ulaz B je zaključan; nazvati dispečera.';

    const deferred = await storage().transaction(async (tx) =>
        recordDeliveryRunStopExceptions(
            {
                driverUserId,
                runId: run.id,
                clientOperationId: 'defer-first-bulk-item',
                occurredAt,
                exceptions: [
                    {
                        stopId: firstStop.id,
                        outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                        reason: DeliveryRunExceptionReasons.ADDRESS_INACCESSIBLE,
                        note: `  ${privateNote}  `,
                    },
                ],
            },
            tx,
        ),
    );
    assert.equal(deferred.replayed, false);
    assert.equal(deferred.result.runCompleted, false);
    assert.equal(deferred.result.reroutePending, true);
    assert.equal(deferred.result.routeRevision, 1);
    assert.deepEqual(deferred.result.outcomes, [
        {
            stopId: firstStop.id,
            deliveryRequestId: firstStop.deliveryRequestId,
            outcome: DeliveryRunExceptionOutcomes.DEFERRED,
            reason: DeliveryRunExceptionReasons.ADDRESS_INACCESSIBLE,
            retryAttempt: 0,
        },
    ]);

    const afterDeferred = await getDeliveryRun(run.id);
    assert.equal(
        afterDeferred?.stops[0]?.state,
        DeliveryRunStopStates.DEFERRED,
    );
    assert.equal(
        afterDeferred?.stops[0]?.exceptionReason,
        DeliveryRunExceptionReasons.ADDRESS_INACCESSIBLE,
    );
    assert.equal(afterDeferred?.stops[0]?.exceptionNote, privateNote);
    assert.deepEqual(
        (await getDeliveryRunExecutionProgress(run.id)).find(
            (step) => step.state === 'current',
        ),
        {
            kind: 'delivery',
            itinerarySequence: firstStop.itinerarySequence,
            stopKey: firstStop.stopKey,
            stopIds: [secondStop.id],
            actionableStopIds: [secondStop.id],
            pickupConfirmed: true,
            state: 'current',
        },
    );
    assert.deepEqual(
        (await getDeliveryRunExecutionProgress(run.id)).find(
            (step) =>
                step.kind === 'delivery' && step.retryLaneRank !== undefined,
        ),
        {
            kind: 'delivery',
            itinerarySequence: firstStop.itinerarySequence,
            stopKey: firstStop.stopKey,
            stopIds: [firstStop.id],
            actionableStopIds: [],
            pickupConfirmed: true,
            retryLaneRank: 1,
            retryAttempt: 1,
            state: 'upcoming',
        },
    );

    const customerRequest = await getDeliveryRequest(
        firstStop.deliveryRequestId,
    );
    assert.equal(customerRequest?.state, DeliveryRunStopStates.DEFERRED);
    assert.equal(
        customerRequest?.deliveryException?.outcome,
        DeliveryRunExceptionOutcomes.DEFERRED,
    );
    assert.equal(customerRequest?.deliveryException?.retryable, true);
    assert.ok(customerRequest?.deliveryException?.recordedAt instanceof Date);
    assert.ok(!JSON.stringify(customerRequest).includes(privateNote));
    assert.ok(
        !JSON.stringify(customerRequest).includes(
            DeliveryRunExceptionReasons.ADDRESS_INACCESSIBLE,
        ),
    );

    const replay = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'defer-first-bulk-item',
        occurredAt,
        exceptions: [
            {
                stopId: firstStop.id,
                outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                reason: DeliveryRunExceptionReasons.ADDRESS_INACCESSIBLE,
                note: privateNote,
            },
        ],
    });
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.result, deferred.result);
    await assertExecutionError(
        recordDeliveryRunStopExceptions({
            driverUserId: randomUUID(),
            runId: run.id,
            clientOperationId: 'defer-first-bulk-item',
            occurredAt,
            exceptions: [
                {
                    stopId: firstStop.id,
                    outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                    reason: DeliveryRunExceptionReasons.ADDRESS_INACCESSIBLE,
                    note: privateNote,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.EXCEPTION_OPERATION_CONFLICT,
    );
    await assertExecutionError(
        recordDeliveryRunStopExceptions({
            driverUserId: randomUUID(),
            runId: run.id,
            clientOperationId: 'foreign-driver-new-operation',
            occurredAt,
            exceptions: [
                {
                    stopId: firstStop.id,
                    outcome: DeliveryRunExceptionOutcomes.FAILED,
                    reason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
    );
    await assertExecutionError(
        recordDeliveryRunStopExceptions({
            driverUserId,
            runId: run.id,
            clientOperationId: 'defer-first-bulk-item',
            occurredAt,
            exceptions: [
                {
                    stopId: firstStop.id,
                    outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                    reason: DeliveryRunExceptionReasons.ADDRESS_WRONG,
                    note: privateNote,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.EXCEPTION_OPERATION_CONFLICT,
    );
    await assertExecutionError(
        recordDeliveryRunStopExceptions({
            driverUserId,
            runId: run.id,
            clientOperationId: 'repeat-deferred-transition',
            occurredAt: new Date('2026-07-13T08:11:00.000Z'),
            exceptions: [
                {
                    stopId: firstStop.id,
                    outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                    reason: DeliveryRunExceptionReasons.CUSTOMER_UNAVAILABLE,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
    );

    await fulfillDeliveryRunStops({
        driverUserId,
        runId: run.id,
        stopIds: [secondStop.id],
    });
    const failed = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'terminal-first-bulk-item',
        occurredAt: new Date('2026-07-13T08:12:00.000Z'),
        exceptions: [
            {
                stopId: firstStop.id,
                outcome: DeliveryRunExceptionOutcomes.FAILED,
                reason: DeliveryRunExceptionReasons.HARVEST_DAMAGED,
            },
        ],
    });
    assert.equal(failed.result.runCompleted, true);
    assert.equal(
        failed.result.routeRevision,
        deferred.result.routeRevision + 2,
    );
    assert.equal(
        (await getDeliveryRequest(firstStop.deliveryRequestId))?.state,
        DeliveryRunStopStates.FAILED,
    );
    await assertExecutionError(
        recordDeliveryRunStopExceptions({
            driverUserId,
            runId: run.id,
            clientOperationId: 'mutate-terminal-first-item',
            occurredAt: new Date('2026-07-13T08:13:00.000Z'),
            exceptions: [
                {
                    stopId: firstStop.id,
                    outcome: DeliveryRunExceptionOutcomes.CANCELLED,
                    reason: DeliveryRunExceptionReasons.CANCELLATION,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
    );
    const completed = await getDeliveryRun(run.id);
    assert.equal(completed?.state, DeliveryRunStates.COMPLETED);
    assert.equal(completed?.rerouteRequiredAt, null);
    assert.deepEqual(
        completed?.stops.map((stop) => stop.state),
        [DeliveryRunStopStates.FAILED, DeliveryRunStopStates.DELIVERED],
    );

    const replayAfterCompletion = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'defer-first-bulk-item',
        occurredAt,
        exceptions: [
            {
                stopId: firstStop.id,
                outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                reason: DeliveryRunExceptionReasons.ADDRESS_INACCESSIBLE,
                note: privateNote,
            },
        ],
    });
    assert.equal(replayAfterCompletion.replayed, true);

    const receipts = await storage()
        .select()
        .from(deliveryRunExceptionOperations)
        .where(eq(deliveryRunExceptionOperations.runId, run.id));
    assert.equal(receipts.length, 2);
    assert.ok(!JSON.stringify(receipts).includes(privateNote));
    const auditEvents = await storage()
        .select()
        .from(events)
        .where(
            and(
                eq(events.aggregateId, firstStop.deliveryRequestId),
                eq(
                    events.type,
                    knownEventTypes.delivery.requestExceptionRecorded,
                ),
            ),
        );
    assert.equal(auditEvents.length, 2);
    assert.ok(JSON.stringify(auditEvents).includes(privateNote));
});

test('cancelled and fulfilled request projections are absorbing for late exception events', async () => {
    const fixture = await createDeliveryRunFixture();
    const [requestId] = fixture.requestIds;
    const [driverUserId] = fixture.driverUserIds;
    assert.ok(requestId);
    assert.ok(driverUserId);
    await createRequestEvents(fixture);
    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: [requestId],
    });
    const [stop] = run.stops;
    assert.ok(stop);
    await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.8,
        longitude: 15.97,
        accuracy: 6,
        heading: 120,
        speed: 7,
        recordedAt: new Date('2026-07-13T08:59:00.000Z'),
    });
    await cancelDeliveryRequest(requestId, 'admin', 'Otkazano tijekom dostave');

    await assertExecutionError(
        recordDeliveryRunStopExceptions({
            driverUserId,
            runId: run.id,
            clientOperationId: 'exception-after-cancellation',
            occurredAt: new Date('2026-07-13T09:00:00.000Z'),
            exceptions: [
                {
                    stopId: stop.id,
                    outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                    reason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
    );
    const cancelledRun = await getDeliveryRun(run.id);
    assert.equal(cancelledRun?.state, DeliveryRunStates.COMPLETED);
    assert.equal(
        cancelledRun?.stops[0]?.state,
        DeliveryRunStopStates.CANCELLED,
    );
    assert.equal(cancelledRun?.currentLatitude, null);
    assert.equal(cancelledRun?.currentLongitude, null);
    assert.equal(cancelledRun?.currentLocationAccuracy, null);
    assert.equal(cancelledRun?.currentLocationHeading, null);
    assert.equal(cancelledRun?.currentLocationSpeed, null);
    assert.equal(cancelledRun?.currentLocationRecordedAt, null);
    assert.equal(cancelledRun?.currentLocationReceivedAt, null);
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunExceptionOperations)
                .where(eq(deliveryRunExceptionOperations.runId, run.id))
        ).length,
        0,
    );

    await createEvent(
        knownEvents.delivery.requestExceptionRecordedV1(requestId, {
            runId: run.id,
            stopId: stop.id,
            clientOperationId: 'forged-late-exception',
            outcome: DeliveryRunExceptionOutcomes.FAILED,
            reason: DeliveryRunExceptionReasons.HARVEST_MISSING,
            retryable: false,
            note: 'Ova bilješka ne smije postati javna.',
            occurredAt: new Date('2026-07-13T09:01:00.000Z').toISOString(),
            recordedByUserId: driverUserId,
            routeRevision: 1,
        }),
    );
    const cancelled = await getDeliveryRequest(requestId);
    assert.equal(cancelled?.state, 'cancelled');
    assert.equal(cancelled?.deliveryException, undefined);
    await createEvent(
        knownEvents.delivery.requestExceptionRecoveredV1(requestId, {
            runId: run.id,
            stopId: stop.id,
            recovery: 'admin-recovery',
            recoveredAt: new Date('2026-07-13T09:01:30.000Z').toISOString(),
            recoveredByUserId: driverUserId,
            routeRevision: 2,
        }),
    );
    assert.equal((await getDeliveryRequest(requestId))?.state, 'cancelled');

    const fulfilledFixture = await createDeliveryRunFixture();
    const fulfilledDriverUserId = fulfilledFixture.driverUserIds[0];
    const fulfilledRequestId = fulfilledFixture.requestIds[0];
    assert.ok(fulfilledDriverUserId);
    assert.ok(fulfilledRequestId);
    const fulfilledRun = await createRun({
        fixture: fulfilledFixture,
        driverUserId: fulfilledDriverUserId,
        requestIds: [fulfilledRequestId],
    });
    const [fulfilledStop] = fulfilledRun.stops;
    assert.ok(fulfilledStop);
    await fulfillDeliveryRunStop({
        driverUserId: fulfilledDriverUserId,
        runId: fulfilledRun.id,
        stopId: fulfilledStop.id,
    });
    await createEvent(
        knownEvents.delivery.requestExceptionRecordedV1(fulfilledRequestId, {
            runId: fulfilledRun.id,
            stopId: fulfilledStop.id,
            clientOperationId: 'forged-after-fulfillment',
            outcome: DeliveryRunExceptionOutcomes.FAILED,
            reason: DeliveryRunExceptionReasons.HARVEST_MISSING,
            retryable: false,
            occurredAt: new Date('2026-07-13T09:02:00.000Z').toISOString(),
            recordedByUserId: fulfilledDriverUserId,
            routeRevision: 1,
        }),
    );
    const fulfilled = await getDeliveryRequest(fulfilledRequestId);
    assert.equal(fulfilled?.state, 'fulfilled');
    assert.equal(fulfilled?.deliveryException, undefined);
    await createEvent(
        knownEvents.delivery.requestExceptionRecoveredV1(fulfilledRequestId, {
            runId: fulfilledRun.id,
            stopId: fulfilledStop.id,
            recovery: 'admin-recovery',
            recoveredAt: new Date('2026-07-13T09:02:30.000Z').toISOString(),
            recoveredByUserId: fulfilledDriverUserId,
            routeRevision: 2,
        }),
    );
    assert.equal(
        (await getDeliveryRequest(fulfilledRequestId))?.state,
        'fulfilled',
    );
});

test('delivery exception reasons and completion semantics are explicit', () => {
    assert.deepEqual(Object.values(DeliveryRunExceptionReasons), [
        'customer-unavailable',
        'address-inaccessible',
        'address-wrong',
        'harvest-damaged',
        'harvest-missing',
        'cancellation',
        'operational-other',
    ]);
    assert.equal(
        deliveryRunStopsAllowCompletion([
            DeliveryRunStopStates.DELIVERED,
            DeliveryRunStopStates.FAILED,
            DeliveryRunStopStates.CANCELLED,
        ]),
        true,
    );
    assert.equal(
        deliveryRunStopsAllowCompletion([
            DeliveryRunStopStates.DELIVERED,
            DeliveryRunStopStates.DEFERRED,
        ]),
        false,
    );
    assert.equal(
        deliveryRunStopsAllowCompletion([
            DeliveryRunStopStates.DELIVERED,
            DeliveryRunStopStates.PENDING,
        ]),
        false,
    );
    assert.equal(
        deliveryRunStopsAllowCompletion([
            DeliveryRunStopStates.DELIVERED,
            DeliveryRunStopStates.ARRIVED,
        ]),
        false,
    );
});

test('all delivery exception reasons follow legal pending, arrived, and deferred transitions', async () => {
    const fixture = await createDeliveryRunFixture({
        accountIndexes: Array.from({ length: 7 }, () => 0),
    });
    const driverUserId = fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: fixture.requestIds,
    });
    const stops = run.stops;
    assert.equal(stops.length, 7);
    const command = async ({
        index,
        operation,
        outcome,
        reason,
    }: {
        index: number;
        operation: string;
        outcome: 'deferred' | 'failed' | 'cancelled';
        reason:
            | 'customer-unavailable'
            | 'address-inaccessible'
            | 'address-wrong'
            | 'harvest-damaged'
            | 'harvest-missing'
            | 'cancellation'
            | 'operational-other';
    }) => {
        const stop = stops[index];
        assert.ok(stop);
        return await recordDeliveryRunStopExceptions({
            driverUserId,
            runId: run.id,
            clientOperationId: operation,
            occurredAt: new Date(
                Date.parse('2026-07-13T10:00:00.000Z') + index * 60_000,
            ),
            exceptions: [{ stopId: stop.id, outcome, reason }],
        });
    };

    await command({
        index: 0,
        operation: 'pending-to-deferred',
        outcome: DeliveryRunExceptionOutcomes.DEFERRED,
        reason: DeliveryRunExceptionReasons.CUSTOMER_UNAVAILABLE,
    });
    const secondStop = stops[1];
    assert.ok(secondStop);
    await markDeliveryRunStopArrived({
        driverUserId,
        runId: run.id,
        stopId: secondStop.id,
    });
    await command({
        index: 1,
        operation: 'arrived-to-deferred',
        outcome: DeliveryRunExceptionOutcomes.DEFERRED,
        reason: DeliveryRunExceptionReasons.ADDRESS_INACCESSIBLE,
    });
    const terminalCases = [
        {
            index: 2,
            outcome: DeliveryRunExceptionOutcomes.FAILED,
            reason: DeliveryRunExceptionReasons.ADDRESS_WRONG,
        },
        {
            index: 3,
            outcome: DeliveryRunExceptionOutcomes.FAILED,
            reason: DeliveryRunExceptionReasons.HARVEST_DAMAGED,
        },
        {
            index: 4,
            outcome: DeliveryRunExceptionOutcomes.FAILED,
            reason: DeliveryRunExceptionReasons.HARVEST_MISSING,
        },
        {
            index: 5,
            outcome: DeliveryRunExceptionOutcomes.CANCELLED,
            reason: DeliveryRunExceptionReasons.CANCELLATION,
        },
        {
            index: 6,
            outcome: DeliveryRunExceptionOutcomes.FAILED,
            reason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
        },
    ];
    for (const terminalCase of terminalCases) {
        await command({
            ...terminalCase,
            operation: `pending-terminal-${terminalCase.index}`,
        });
    }
    await command({
        index: 0,
        operation: 'deferred-to-failed',
        outcome: DeliveryRunExceptionOutcomes.FAILED,
        reason: DeliveryRunExceptionReasons.CUSTOMER_UNAVAILABLE,
    });
    await command({
        index: 1,
        operation: 'deferred-to-cancelled',
        outcome: DeliveryRunExceptionOutcomes.CANCELLED,
        reason: DeliveryRunExceptionReasons.CANCELLATION,
    });

    const completed = await getDeliveryRun(run.id);
    assert.equal(completed?.state, DeliveryRunStates.COMPLETED);
    assert.equal(completed?.rerouteRequiredAt, null);
    assert.ok(
        completed?.stops.every(
            (stop) =>
                stop.state === DeliveryRunStopStates.FAILED ||
                stop.state === DeliveryRunStopStates.CANCELLED,
        ),
    );
    const auditEvents = await storage()
        .select({ data: events.data })
        .from(events)
        .where(
            and(
                eq(
                    events.type,
                    knownEventTypes.delivery.requestExceptionRecorded,
                ),
                inArray(events.aggregateId, fixture.requestIds),
            ),
        );
    const recordedReasons = new Set(
        auditEvents.flatMap(({ data }) => {
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                return [];
            }
            const reason = (data as Record<string, unknown>).reason;
            return typeof reason === 'string' ? [reason] : [];
        }),
    );
    for (const reason of Object.values(DeliveryRunExceptionReasons)) {
        assert.ok(recordedReasons.has(reason));
    }
});

test('execution checkpoints separate same-sequence stops with different physical keys', async () => {
    const { run } = await startPreparedBulkRunWithConfirmedPickup();
    const [firstStop, secondStop] = run.stops;
    assert.ok(firstStop);
    assert.ok(secondStop);
    await storage()
        .update(deliveryRunStops)
        .set({ stopKey: `${secondStop.stopKey}:separate-retry` })
        .where(eq(deliveryRunStops.id, secondStop.id));

    const deliverySteps = (
        await getDeliveryRunExecutionProgress(run.id)
    ).filter((step) => step.kind === 'delivery');
    assert.equal(deliverySteps.length, 2);
    assert.deepEqual(
        deliverySteps.map((step) => ({
            stopIds: step.stopIds,
            actionableStopIds: step.actionableStopIds,
            state: step.state,
        })),
        [
            {
                stopIds: [firstStop.id],
                actionableStopIds: [firstStop.id],
                state: 'current',
            },
            {
                stopIds: [secondStop.id],
                actionableStopIds: [secondStop.id],
                state: 'upcoming',
            },
        ],
    );
});

test('concurrent multi-item exception replay writes one receipt and one event per item', async () => {
    const { run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [firstStop, secondStop] = run.stops;
    assert.ok(firstStop);
    assert.ok(secondStop);
    const input = {
        driverUserId,
        runId: run.id,
        clientOperationId: 'concurrent-terminal-bulk-operation',
        occurredAt: new Date('2026-07-13T10:30:00.000Z'),
        exceptions: [
            {
                stopId: firstStop.id,
                outcome: DeliveryRunExceptionOutcomes.FAILED,
                reason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
            },
            {
                stopId: secondStop.id,
                outcome: DeliveryRunExceptionOutcomes.CANCELLED,
                reason: DeliveryRunExceptionReasons.CANCELLATION,
            },
        ],
    } satisfies RecordDeliveryRunStopExceptionsInput;
    const results = await Promise.all([
        recordDeliveryRunStopExceptions(input),
        recordDeliveryRunStopExceptions(input),
    ]);
    assert.deepEqual(results.map((result) => result.replayed).sort(), [
        false,
        true,
    ]);
    assert.ok(results.every((result) => result.result.runCompleted));
    assert.deepEqual(
        (await getDeliveryRun(run.id))?.stops.map((stop) => stop.state),
        [DeliveryRunStopStates.FAILED, DeliveryRunStopStates.CANCELLED],
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunExceptionOperations)
                .where(eq(deliveryRunExceptionOperations.runId, run.id))
        ).length,
        1,
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(events)
                .where(
                    and(
                        eq(
                            events.type,
                            knownEventTypes.delivery.requestExceptionRecorded,
                        ),
                        inArray(events.aggregateId, [
                            firstStop.deliveryRequestId,
                            secondStop.deliveryRequestId,
                        ]),
                    ),
                )
        ).length,
        2,
    );
});

test('arrival and delivery races cannot overwrite exception outcomes', async () => {
    const arrivalFixture = await createDeliveryRunFixture();
    const arrivalDriverUserId = arrivalFixture.driverUserIds[0];
    assert.ok(arrivalDriverUserId);
    const arrivalRun = await createRun({
        fixture: arrivalFixture,
        driverUserId: arrivalDriverUserId,
        requestIds: arrivalFixture.requestIds,
    });
    const [arrivalStop] = arrivalRun.stops;
    assert.ok(arrivalStop);
    const [arrivalResult, exceptionResult] = await Promise.allSettled([
        markDeliveryRunStopArrived({
            driverUserId: arrivalDriverUserId,
            runId: arrivalRun.id,
            stopId: arrivalStop.id,
        }),
        recordDeliveryRunStopExceptions({
            driverUserId: arrivalDriverUserId,
            runId: arrivalRun.id,
            clientOperationId: 'arrival-race-exception',
            occurredAt: new Date('2026-07-13T10:45:00.000Z'),
            exceptions: [
                {
                    stopId: arrivalStop.id,
                    outcome: DeliveryRunExceptionOutcomes.FAILED,
                    reason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
                },
            ],
        }),
    ]);
    assert.equal(exceptionResult.status, 'fulfilled');
    assert.ok(
        arrivalResult.status === 'fulfilled' ||
            arrivalResult.reason instanceof DeliveryRunExecutionError,
    );
    assert.equal(
        (await getDeliveryRun(arrivalRun.id))?.stops[0]?.state,
        DeliveryRunStopStates.FAILED,
    );

    const deliveryFixture = await createDeliveryRunFixture();
    const deliveryDriverUserId = deliveryFixture.driverUserIds[0];
    const deliveryRequestId = deliveryFixture.requestIds[0];
    assert.ok(deliveryDriverUserId);
    assert.ok(deliveryRequestId);
    const deliveryRun = await createRun({
        fixture: deliveryFixture,
        driverUserId: deliveryDriverUserId,
        requestIds: [deliveryRequestId],
    });
    const [deliveryStop] = deliveryRun.stops;
    assert.ok(deliveryStop);
    const results = await Promise.allSettled([
        fulfillDeliveryRunStop({
            driverUserId: deliveryDriverUserId,
            runId: deliveryRun.id,
            stopId: deliveryStop.id,
        }),
        recordDeliveryRunStopExceptions({
            driverUserId: deliveryDriverUserId,
            runId: deliveryRun.id,
            clientOperationId: 'delivery-race-exception',
            occurredAt: new Date('2026-07-13T10:46:00.000Z'),
            exceptions: [
                {
                    stopId: deliveryStop.id,
                    outcome: DeliveryRunExceptionOutcomes.FAILED,
                    reason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
                },
            ],
        }),
    ]);
    assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
    );
    const persistedStop = (await getDeliveryRun(deliveryRun.id))?.stops[0];
    const projectedRequest = await getDeliveryRequest(deliveryRequestId);
    assert.ok(
        persistedStop?.state === DeliveryRunStopStates.DELIVERED ||
            persistedStop?.state === DeliveryRunStopStates.FAILED,
    );
    assert.equal(
        projectedRequest?.state,
        persistedStop?.state === DeliveryRunStopStates.DELIVERED
            ? 'fulfilled'
            : 'failed',
    );
});

test('delivery exception commands reject invalid shapes and future checkpoints', async () => {
    const fixture = await createDeliveryRunFixture({ accountIndexes: [0, 0] });
    const driverUserId = fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const [currentPlan, futurePlan] = createRunStops(fixture.requestIds);
    assert.ok(currentPlan);
    assert.ok(futurePlan);
    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: fixture.requestIds,
        stops: [
            currentPlan,
            {
                ...futurePlan,
                formattedAddress: 'Druga buduća 2, Zagreb, HR',
            },
        ],
    });
    const [currentStop, futureStop] = run.stops;
    assert.ok(currentStop);
    assert.ok(futureStop);
    const base = {
        driverUserId,
        runId: run.id,
        occurredAt: new Date('2026-07-13T11:00:00.000Z'),
    };

    await assertExecutionError(
        recordDeliveryRunStopExceptions({
            ...base,
            clientOperationId: 'duplicate-stop-shape',
            exceptions: [
                {
                    stopId: currentStop.id,
                    outcome: DeliveryRunExceptionOutcomes.FAILED,
                    reason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
                },
                {
                    stopId: currentStop.id,
                    outcome: DeliveryRunExceptionOutcomes.FAILED,
                    reason: DeliveryRunExceptionReasons.HARVEST_MISSING,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.EXCEPTION_INVALID,
    );
    await assertExecutionError(
        recordDeliveryRunStopExceptions({
            ...base,
            clientOperationId: 'oversized-note-shape',
            exceptions: [
                {
                    stopId: currentStop.id,
                    outcome: DeliveryRunExceptionOutcomes.FAILED,
                    reason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
                    note: 'x'.repeat(1001),
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.EXCEPTION_INVALID,
    );
    await assertExecutionError(
        recordDeliveryRunStopExceptions({
            ...base,
            clientOperationId: 'mismatched-cancellation-shape',
            exceptions: [
                {
                    stopId: currentStop.id,
                    outcome: DeliveryRunExceptionOutcomes.CANCELLED,
                    reason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.EXCEPTION_INVALID,
    );
    await assertExecutionError(
        recordDeliveryRunStopExceptions({
            ...base,
            clientOperationId: 'future-checkpoint',
            exceptions: [
                {
                    stopId: futureStop.id,
                    outcome: DeliveryRunExceptionOutcomes.FAILED,
                    reason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.ROUTE_ORDER,
    );
    assert.deepEqual(
        (await getDeliveryRun(run.id))?.stops.map((stop) => stop.state),
        [DeliveryRunStopStates.PENDING, DeliveryRunStopStates.PENDING],
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunExceptionOperations)
                .where(eq(deliveryRunExceptionOperations.runId, run.id))
        ).length,
        0,
    );
});

test('database constraints reject mismatched cancellation outcomes and reasons', async () => {
    const fixture = await createDeliveryRunFixture();
    const driverUserId = fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: fixture.requestIds,
    });
    const [stop] = run.stops;
    assert.ok(stop);
    const exceptionFields = {
        exceptionOccurredAt: new Date('2026-07-13T09:00:00.000Z'),
        exceptionRecordedByUserId: driverUserId,
    };

    await assert.rejects(
        storage()
            .update(deliveryRunStops)
            .set({
                state: DeliveryRunStopStates.FAILED,
                exceptionReason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
            })
            .where(eq(deliveryRunStops.id, stop.id)),
        (error) =>
            error instanceof Error &&
            error.cause instanceof Error &&
            error.cause.message.includes('outcome_shape_check'),
    );

    for (const invalid of [
        {
            state: DeliveryRunStopStates.CANCELLED,
            exceptionReason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
        },
        {
            state: DeliveryRunStopStates.FAILED,
            exceptionReason: DeliveryRunExceptionReasons.CANCELLATION,
        },
    ]) {
        await assert.rejects(
            storage()
                .update(deliveryRunStops)
                .set({ ...invalid, ...exceptionFields })
                .where(eq(deliveryRunStops.id, stop.id)),
            (error) =>
                error instanceof Error &&
                error.cause instanceof Error &&
                error.cause.message.includes('cancellation_pair_check'),
        );
    }
});

test('active failed-stop recovery clears handoff evidence for the new attempt', async () => {
    const { run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [firstStop] = run.stops;
    assert.ok(firstStop);

    await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: firstStop.id,
        expectedRetryAttempt: 0,
        mutations: [
            {
                clientOperationId: 'handoff-before-failed-recovery',
                occurredAt: new Date(),
                kind: DeliveryRunHandoffOperationKinds.MARK_ITEM,
                stopId: firstStop.id,
                outcome: DeliveryRunHandoffItemStates.SKIPPED,
                reason: DeliveryRunHandoffSkipReasons.MANUAL_VERIFICATION,
            },
        ],
    });
    const beforeFailure = await storage().query.deliveryRunStops.findFirst({
        where: eq(deliveryRunStops.id, firstStop.id),
    });
    assert.equal(
        beforeFailure?.handoffVerificationState,
        DeliveryRunHandoffItemStates.SKIPPED,
    );
    assert.equal(
        beforeFailure?.handoffVerificationReason,
        DeliveryRunHandoffSkipReasons.MANUAL_VERIFICATION,
    );
    assert.ok(beforeFailure?.handoffVerifiedAt instanceof Date);
    assert.equal(beforeFailure?.handoffVerifiedByUserId, driverUserId);

    const failed = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'fail-stop-with-handoff-evidence',
        occurredAt: new Date(),
        exceptions: [
            {
                stopId: firstStop.id,
                outcome: DeliveryRunExceptionOutcomes.FAILED,
                reason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
            },
        ],
    });
    assert.equal(failed.result.runCompleted, false);

    const recovered = await recoverDeliveryRunStop({
        adminUserId: driverUserId,
        runId: run.id,
        stopId: firstStop.id,
        expectedRouteRevision: failed.result.routeRevision,
    });
    assert.equal(recovered.resumedInRun, true);
    const recoveredStop = await storage().query.deliveryRunStops.findFirst({
        where: eq(deliveryRunStops.id, firstStop.id),
    });
    assert.equal(recoveredStop?.state, DeliveryRunStopStates.PENDING);
    assert.equal(recoveredStop?.retryAttempt, 1);
    assert.equal(
        recoveredStop?.handoffVerificationState,
        DeliveryRunHandoffItemStates.UNVERIFIED,
    );
    assert.equal(recoveredStop?.handoffVerificationReason, null);
    assert.equal(recoveredStop?.handoffVerifiedAt, null);
    assert.equal(recoveredStop?.handoffVerifiedByUserId, null);
    assert.deepEqual(
        (
            await getDeliveryLifecycleReconciliationCandidates({
                startedAt: new Date('2026-07-13T00:00:00.000Z'),
                limit: 1000,
            })
        ).candidates
            .filter(
                (candidate) =>
                    candidate.requestId === firstStop.deliveryRequestId &&
                    (candidate.milestone === 'exception' ||
                        candidate.milestone === 'recovery'),
            )
            .map((candidate) => ({
                milestone: candidate.milestone,
                retryAttempt: candidate.retryAttempt,
                sourceKind: candidate.sourceKind,
                stopId: candidate.stopId,
            }))
            .sort((first, second) =>
                first.milestone.localeCompare(second.milestone),
            ),
        [
            {
                milestone: 'exception',
                retryAttempt: firstStop.retryAttempt,
                sourceKind: 'exception-operation',
                stopId: firstStop.id,
            },
            {
                milestone: 'recovery',
                retryAttempt: firstStop.retryAttempt + 1,
                sourceKind: 'retry-state',
                stopId: firstStop.id,
            },
        ],
    );
});

test('completed failed recovery can be reassigned once without reopening newer fulfillment', async () => {
    const { prepared, run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup({ driverCount: 2 });
    const [firstStop, secondStop] = run.stops;
    const secondDriverUserId = prepared.fixture.driverUserIds[1];
    assert.ok(firstStop);
    assert.ok(secondStop);
    assert.ok(secondDriverUserId);

    const failed = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'complete-failed-run-for-recovery',
        occurredAt: new Date('2026-07-13T12:00:00.000Z'),
        exceptions: [firstStop, secondStop].map((stop) => ({
            stopId: stop.id,
            outcome: DeliveryRunExceptionOutcomes.FAILED,
            reason: DeliveryRunExceptionReasons.OPERATIONAL_OTHER,
        })),
    });
    assert.equal(failed.result.runCompleted, true);
    assert.ok(
        (await getDeliveryRun(run.id))?.stops.every(
            (stop) => stop.releasedAt instanceof Date,
        ),
    );

    const recovered = await recoverDeliveryRunStop({
        adminUserId: driverUserId,
        runId: run.id,
        stopId: firstStop.id,
        expectedRouteRevision: failed.result.routeRevision,
    });
    assert.equal(recovered.resumedInRun, false);
    assert.equal(
        (await getDeliveryRequest(firstStop.deliveryRequestId))?.state,
        'ready',
    );

    const nextPreparation = await singleRequestPreparation({
        prepared,
        requestId: firstStop.deliveryRequestId,
        driverUserId: secondDriverUserId,
    });
    const saved = await saveDeliveryRunPreparation(nextPreparation);
    const nextRun = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId: secondDriverUserId,
        deliveryRequestIds: [firstStop.deliveryRequestId],
    });
    assert.notEqual(nextRun.id, run.id);
    assert.equal(
        (
            await getActiveDeliveryRunStopsForRequestIds([
                firstStop.deliveryRequestId,
            ])
        )[0]?.run.id,
        nextRun.id,
    );
    await assertPersistenceError(
        saveDeliveryRunPreparation({
            ...nextPreparation,
            createRunInput: {
                ...nextPreparation.createRunInput,
                driverUserId,
            },
        }),
        DeliveryRunPersistenceErrorCodes.ALREADY_ASSIGNED,
    );

    const [pickup] = nextRun.pickupNodes;
    const [manifest] = nextRun.runSlots;
    const [nextStop] = nextRun.stops;
    const [manifestItem] = nextPreparation.createRunInput.manifestItems;
    assert.ok(pickup);
    assert.ok(manifest);
    assert.ok(nextStop);
    assert.ok(manifestItem);
    const traceToken = manifestItem.traceToken;
    assert.ok(traceToken);
    await applyDeliveryRunPickupMutations({
        driverUserId: secondDriverUserId,
        runId: nextRun.id,
        pickupNodeId: pickup.id,
        mutations: [
            {
                clientOperationId: 'recovered-run-scan',
                occurredAt: new Date('2026-07-13T12:01:00.000Z'),
                kind: DeliveryRunPickupOperationKinds.SCAN,
                traceToken,
            },
            {
                clientOperationId: 'recovered-run-confirm',
                occurredAt: new Date('2026-07-13T12:02:00.000Z'),
                kind: DeliveryRunPickupOperationKinds.CONFIRM_MANIFEST,
                manifestId: manifest.manifestId,
            },
        ],
    });
    await fulfillDeliveryRunStop({
        driverUserId: secondDriverUserId,
        runId: nextRun.id,
        stopId: nextStop.id,
    });
    await assertExecutionError(
        recoverDeliveryRunStop({
            adminUserId: driverUserId,
            runId: run.id,
            stopId: firstStop.id,
            expectedRouteRevision: recovered.routeRevision,
        }),
        DeliveryRunExecutionErrorCodes.EXCEPTION_TRANSITION_INVALID,
    );
    assert.equal(
        (await getDeliveryRequest(firstStop.deliveryRequestId))?.state,
        'fulfilled',
    );
});

test('reroute apply is exact, single-use, and keeps partial bulk retries in one lane', async () => {
    const { run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [firstStop, secondStop] = run.stops;
    assert.ok(firstStop);
    assert.ok(secondStop);
    const deferred = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'partial-bulk-before-reroute',
        occurredAt: new Date('2026-07-13T08:10:00.000Z'),
        exceptions: [
            {
                stopId: firstStop.id,
                outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                reason: DeliveryRunExceptionReasons.CUSTOMER_UNAVAILABLE,
            },
        ],
    });
    const estimate = (stopIds: number[], itinerarySequence: number) => ({
        stopIds,
        itinerarySequence,
        estimatedArrivalAt: new Date(
            Date.parse('2026-07-13T08:20:00.000Z') + itinerarySequence * 60_000,
        ),
        estimatedTravelSeconds: 60,
        estimatedDistanceMeters: 500,
    });
    const baseReroute = {
        runId: run.id,
        expectedRouteRevision: deferred.result.routeRevision,
        rerouteClaimedAt: new Date(),
        estimateSource: 'local' as const,
        totalDistanceMeters: 1_000,
        totalDurationSeconds: 420,
        pickupEstimates: [],
    };
    const claim = await claimDeliveryRunReroute({
        runId: run.id,
        expectedRouteRevision: deferred.result.routeRevision,
        claimedAt: baseReroute.rerouteClaimedAt,
    });
    assert.equal(
        claim?.rerouteClaimedAt.getTime(),
        baseReroute.rerouteClaimedAt.getTime(),
    );
    assert.equal(
        await claimDeliveryRunReroute({
            runId: run.id,
            expectedRouteRevision: deferred.result.routeRevision,
        }),
        null,
    );
    await assertExecutionError(
        applyDeliveryRunReroute({
            ...baseReroute,
            stopEstimates: [estimate([secondStop.id], 2)],
        }),
        DeliveryRunExecutionErrorCodes.RUN_MUTATION_INVALID,
    );
    assert.equal(
        (await getDeliveryRun(run.id))?.routeRevision,
        deferred.result.routeRevision,
    );

    const exactReroute = {
        ...baseReroute,
        stopEstimates: [
            estimate([secondStop.id], 2),
            estimate([firstStop.id], 3),
        ],
    };
    const attempts = await Promise.allSettled([
        applyDeliveryRunReroute(exactReroute),
        applyDeliveryRunReroute(exactReroute),
    ]);
    assert.equal(
        attempts.filter((attempt) => attempt.status === 'fulfilled').length,
        1,
    );
    const rejected = attempts.find(
        (attempt): attempt is PromiseRejectedResult =>
            attempt.status === 'rejected',
    );
    assert.ok(rejected?.reason instanceof DeliveryRunExecutionError);
    assert.equal(
        rejected.reason.code,
        DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
    );
    const appliedRun = await getDeliveryRun(run.id);
    assert.equal(appliedRun?.routeRevision, deferred.result.routeRevision + 1);
    assert.equal(appliedRun?.rerouteRequiredAt, null);

    const replay = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'partial-bulk-before-reroute',
        occurredAt: new Date('2026-07-13T08:10:00.000Z'),
        exceptions: [
            {
                stopId: firstStop.id,
                outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                reason: DeliveryRunExceptionReasons.CUSTOMER_UNAVAILABLE,
            },
        ],
    });
    assert.equal(replay.replayed, true);
    assert.equal(replay.result.routeRevision, deferred.result.routeRevision);
    assert.equal(
        (await getDeliveryRun(run.id))?.routeRevision,
        deferred.result.routeRevision + 1,
    );

    await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'defer-bulk-sibling-after-reroute',
        occurredAt: new Date('2026-07-13T08:30:00.000Z'),
        exceptions: [
            {
                stopId: secondStop.id,
                outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                reason: DeliveryRunExceptionReasons.ADDRESS_INACCESSIBLE,
            },
        ],
    });
    const retrySteps = (await getDeliveryRunExecutionProgress(run.id)).filter(
        isRetryDeliveryStep,
    );
    assert.equal(retrySteps.length, 1);
    assert.deepEqual(
        retrySteps[0]?.stopIds.sort((a, b) => a - b),
        [firstStop.id, secondStop.id],
    );
});

test('arrival and a newer lease invalidate stale reroute calculations', async () => {
    const arrivalFixture = await startPreparedBulkRunWithConfirmedPickup();
    const [deferredStop, currentStop] = arrivalFixture.run.stops;
    assert.ok(deferredStop);
    assert.ok(currentStop);
    const deferred = await recordDeliveryRunStopExceptions({
        driverUserId: arrivalFixture.driverUserId,
        runId: arrivalFixture.run.id,
        clientOperationId: 'defer-before-arrival-reroute-race',
        occurredAt: new Date('2026-07-13T08:40:00.000Z'),
        exceptions: [
            {
                stopId: deferredStop.id,
                outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                reason: DeliveryRunExceptionReasons.CUSTOMER_UNAVAILABLE,
            },
        ],
    });
    const claimedAt = new Date();
    const claim = await claimDeliveryRunReroute({
        runId: arrivalFixture.run.id,
        expectedRouteRevision: deferred.result.routeRevision,
        claimedAt,
    });
    assert.ok(claim);
    const originalSequences = arrivalFixture.run.stops.map(
        (stop) => stop.itinerarySequence,
    );
    await markDeliveryRunStopArrived({
        driverUserId: arrivalFixture.driverUserId,
        runId: arrivalFixture.run.id,
        stopId: currentStop.id,
        expectedRouteRevision: deferred.result.routeRevision,
    });
    const arrived = await getDeliveryRun(arrivalFixture.run.id);
    assert.equal(arrived?.routeRevision, deferred.result.routeRevision + 1);
    assert.equal(arrived?.rerouteAttemptedAt, null);
    assert.equal(arrived?.stops[1]?.state, DeliveryRunStopStates.ARRIVED);
    await assertExecutionError(
        applyDeliveryRunReroute({
            runId: arrivalFixture.run.id,
            expectedRouteRevision: deferred.result.routeRevision,
            rerouteClaimedAt: claimedAt,
            estimateSource: 'local',
            totalDistanceMeters: 1_000,
            totalDurationSeconds: 600,
            pickupEstimates: [],
            stopEstimates: [
                {
                    stopIds: [currentStop.id],
                    itinerarySequence: 2,
                    estimatedArrivalAt: new Date('2026-07-13T08:50:00.000Z'),
                    estimatedTravelSeconds: 60,
                    estimatedDistanceMeters: 500,
                },
                {
                    stopIds: [deferredStop.id],
                    itinerarySequence: 3,
                    estimatedArrivalAt: new Date('2026-07-13T09:00:00.000Z'),
                    estimatedTravelSeconds: 60,
                    estimatedDistanceMeters: 500,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
    );
    assert.deepEqual(
        (await getDeliveryRun(arrivalFixture.run.id))?.stops.map(
            (stop) => stop.itinerarySequence,
        ),
        originalSequences,
    );

    const leaseFixture = await startPreparedBulkRunWithConfirmedPickup();
    const [leaseDeferredStop] = leaseFixture.run.stops;
    assert.ok(leaseDeferredStop);
    const leaseDeferred = await recordDeliveryRunStopExceptions({
        driverUserId: leaseFixture.driverUserId,
        runId: leaseFixture.run.id,
        clientOperationId: 'defer-before-expired-lease',
        occurredAt: new Date('2026-07-13T09:10:00.000Z'),
        exceptions: [
            {
                stopId: leaseDeferredStop.id,
                outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                reason: DeliveryRunExceptionReasons.ADDRESS_INACCESSIBLE,
            },
        ],
    });
    const oldClaimedAt = new Date();
    assert.ok(
        await claimDeliveryRunReroute({
            runId: leaseFixture.run.id,
            expectedRouteRevision: leaseDeferred.result.routeRevision,
            claimedAt: oldClaimedAt,
        }),
    );
    const newerClaim = await claimDeliveryRunReroute({
        runId: leaseFixture.run.id,
        expectedRouteRevision: leaseDeferred.result.routeRevision,
        claimedAt: new Date(
            oldClaimedAt.getTime() + deliveryRunRerouteLeaseMs + 1,
        ),
    });
    assert.ok(newerClaim);
    await assertExecutionError(
        applyDeliveryRunReroute({
            runId: leaseFixture.run.id,
            expectedRouteRevision: leaseDeferred.result.routeRevision,
            rerouteClaimedAt: oldClaimedAt,
            estimateSource: 'local',
            totalDistanceMeters: 1_000,
            totalDurationSeconds: 600,
            pickupEstimates: [],
            stopEstimates: [],
        }),
        DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
    );
});

test('retry anchor must itself be deferred in a mixed terminal checkpoint', async () => {
    const { run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [firstStop, secondStop] = run.stops;
    assert.ok(firstStop);
    assert.ok(secondStop);
    const deferred = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'defer-entire-bulk-checkpoint',
        occurredAt: new Date('2026-07-13T09:00:00.000Z'),
        exceptions: [firstStop, secondStop].map((stop) => ({
            stopId: stop.id,
            outcome: DeliveryRunExceptionOutcomes.DEFERRED,
            reason: DeliveryRunExceptionReasons.CUSTOMER_UNAVAILABLE,
        })),
    });
    await cancelDeliveryRequest(
        firstStop.deliveryRequestId,
        'admin',
        'Kupac je otkazao jedan dio skupne dostave',
    );
    const cancelledRun = await getDeliveryRun(run.id);
    assert.ok(cancelledRun);
    assert.equal(cancelledRun.stops[0]?.state, DeliveryRunStopStates.CANCELLED);
    await assertExecutionError(
        retryDeliveryRunStop({
            driverUserId,
            runId: run.id,
            stopId: firstStop.id,
            expectedRouteRevision: cancelledRun.routeRevision,
        }),
        DeliveryRunExecutionErrorCodes.EXCEPTION_TRANSITION_INVALID,
    );
    const retried = await retryDeliveryRunStop({
        driverUserId,
        runId: run.id,
        stopId: secondStop.id,
        expectedRouteRevision: cancelledRun.routeRevision,
    });
    assert.deepEqual(retried.stopIds, [secondStop.id]);
    assert.equal(
        (await getDeliveryRun(run.id))?.stops[1]?.state,
        DeliveryRunStopStates.PENDING,
    );
    assert.ok(retried.routeRevision > deferred.result.routeRevision);
});

test('foreign-account address mutations preserve not-found semantics for assigned addresses', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    const addressId = prepared.addressIds[0];
    assert.ok(driverUserId);
    assert.ok(addressId);
    const saved = await saveDeliveryRunPreparation(prepared);
    await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    const foreignAccountId = await createTestAccount();
    await assert.rejects(
        updateDeliveryAddress(
            { id: addressId, street1: 'Neovlaštena promjena' },
            foreignAccountId,
        ),
        (error) =>
            error instanceof DeliveryAddressMutationError &&
            !(error instanceof DeliveryRunAssignmentError) &&
            error.message ===
                'Failed to update delivery address - address not found or access denied',
    );
    await assert.rejects(
        deleteDeliveryAddress(addressId, foreignAccountId),
        (error) =>
            error instanceof DeliveryAddressMutationError &&
            !(error instanceof DeliveryRunAssignmentError) &&
            error.message ===
                'Failed to delete delivery address - address not found or access denied',
    );
});

test('whole-run reassignment clears stale GPS and requires the current route revision', async () => {
    const { prepared, run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup({ driverCount: 2 });
    const nextDriverUserId = prepared.fixture.driverUserIds[1];
    assert.ok(nextDriverUserId);
    await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.8,
        longitude: 15.97,
        accuracy: 4,
        heading: 180,
        speed: 8,
        recordedAt: new Date('2026-07-13T12:00:00.000Z'),
    });
    await markDeliveryRunStopsArrived({
        driverUserId,
        runId: run.id,
        stopIds: run.stops.map((stop) => stop.id),
        expectedRouteRevision: run.routeRevision,
    });
    const arrivedRun = await getDeliveryRun(run.id);
    assert.equal(arrivedRun?.routeRevision, run.routeRevision + 1);
    assert.equal(arrivedRun?.stops[0]?.state, DeliveryRunStopStates.ARRIVED);

    const reassigned = await reassignDeliveryRun({
        adminUserId: driverUserId,
        runId: run.id,
        newDriverUserId: nextDriverUserId,
        expectedRouteRevision: arrivedRun?.routeRevision ?? -1,
        occurredAt: new Date('2026-07-13T12:01:00.000Z'),
    });
    assert.equal(reassigned.driverUserId, nextDriverUserId);
    assert.equal(
        reassigned.routeRevision,
        (arrivedRun?.routeRevision ?? 0) + 1,
    );
    assert.equal(reassigned.reroutePending, true);

    const persisted = await getDeliveryRun(run.id);
    assert.equal(persisted?.driverUserId, nextDriverUserId);
    assert.equal(persisted?.currentLatitude, null);
    assert.equal(persisted?.currentLongitude, null);
    assert.equal(persisted?.currentLocationAccuracy, null);
    assert.equal(persisted?.currentLocationHeading, null);
    assert.equal(persisted?.currentLocationSpeed, null);
    assert.equal(persisted?.currentLocationRecordedAt, null);
    assert.equal(persisted?.currentLocationReceivedAt, null);
    assert.ok(
        persisted?.stops.every(
            (stop) =>
                stop.state === DeliveryRunStopStates.PENDING &&
                stop.arrivedAt === null,
        ),
    );
    assert.ok(persisted?.rerouteRequiredAt instanceof Date);
    await assertExecutionError(
        reassignDeliveryRun({
            adminUserId: driverUserId,
            runId: run.id,
            newDriverUserId: driverUserId,
            expectedRouteRevision: run.routeRevision,
        }),
        DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
    );
});

test('route abandonment releases requests but preserves a failed stop audit outcome', async () => {
    const { run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [failedStop, pendingStop] = run.stops;
    assert.ok(failedStop);
    assert.ok(pendingStop);
    await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.8,
        longitude: 15.97,
        accuracy: 4,
        heading: 180,
        speed: 8,
        recordedAt: new Date('2026-07-13T12:09:00.000Z'),
    });
    const failure = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'failure-before-abandonment',
        occurredAt: new Date('2026-07-13T12:10:00.000Z'),
        exceptions: [
            {
                stopId: failedStop.id,
                outcome: DeliveryRunExceptionOutcomes.FAILED,
                reason: DeliveryRunExceptionReasons.HARVEST_DAMAGED,
                note: 'Oštećenje potvrđeno pri dostavi',
            },
        ],
    });

    const abandoned = await abandonDeliveryRun({
        adminUserId: driverUserId,
        runId: run.id,
        expectedRouteRevision: failure.result.routeRevision,
        reason: 'Vozilo više nije dostupno',
        occurredAt: new Date('2026-07-13T12:11:00.000Z'),
    });
    assert.deepEqual(
        new Set(abandoned.releasedRequestIds),
        new Set([failedStop.deliveryRequestId, pendingStop.deliveryRequestId]),
    );

    const persisted = await getDeliveryRun(run.id);
    assert.equal(persisted?.state, DeliveryRunStates.CANCELLED);
    assert.equal(persisted?.currentLatitude, null);
    assert.equal(persisted?.currentLongitude, null);
    assert.equal(persisted?.currentLocationAccuracy, null);
    assert.equal(persisted?.currentLocationHeading, null);
    assert.equal(persisted?.currentLocationSpeed, null);
    assert.equal(persisted?.currentLocationRecordedAt, null);
    assert.equal(persisted?.currentLocationReceivedAt, null);
    const persistedFailed = persisted?.stops.find(
        (stop) => stop.id === failedStop.id,
    );
    const persistedPending = persisted?.stops.find(
        (stop) => stop.id === pendingStop.id,
    );
    assert.equal(persistedFailed?.state, DeliveryRunStopStates.FAILED);
    assert.equal(
        persistedFailed?.exceptionReason,
        DeliveryRunExceptionReasons.HARVEST_DAMAGED,
    );
    assert.equal(
        persistedFailed?.exceptionNote,
        'Oštećenje potvrđeno pri dostavi',
    );
    assert.ok(persistedFailed?.releasedAt instanceof Date);
    assert.equal(persistedPending?.state, DeliveryRunStopStates.CANCELLED);
    assert.ok(persistedPending?.releasedAt instanceof Date);
    assert.equal(
        (await getDeliveryRequest(failedStop.deliveryRequestId))?.state,
        'ready',
    );
    assert.equal(
        (await getDeliveryRequest(pendingStop.deliveryRequestId))?.state,
        'ready',
    );
    assert.equal(
        (
            await getActiveDeliveryRunStopsForRequestIds([
                failedStop.deliveryRequestId,
                pendingStop.deliveryRequestId,
            ])
        ).length,
        0,
    );
    assert.equal(
        (
            await getDeliveryLifecycleReconciliationCandidates({
                startedAt: new Date('2026-07-13T12:10:00.000Z'),
                limit: 1000,
            })
        ).candidates.filter(
            (candidate) =>
                candidate.runId === run.id &&
                candidate.milestone === 'recovery',
        ).length,
        0,
    );
});

test('bulk siblings reuse one deterministic lane on a later retry attempt', async () => {
    const { run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [firstStop, secondStop] = run.stops;
    assert.ok(firstStop);
    assert.ok(secondStop);
    const firstDeferral = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'bulk-first-attempt-deferred',
        occurredAt: new Date('2026-07-13T12:20:00.000Z'),
        exceptions: [firstStop, secondStop].map((stop) => ({
            stopId: stop.id,
            outcome: DeliveryRunExceptionOutcomes.DEFERRED,
            reason: DeliveryRunExceptionReasons.CUSTOMER_UNAVAILABLE,
        })),
    });
    const retried = await retryDeliveryRunStop({
        driverUserId,
        runId: run.id,
        stopId: firstStop.id,
        expectedRouteRevision: firstDeferral.result.routeRevision,
    });
    assert.deepEqual(
        (
            await getDeliveryLifecycleReconciliationCandidates({
                startedAt: new Date('2026-07-13T00:00:00.000Z'),
                limit: 1000,
            })
        ).candidates
            .filter(
                (candidate) =>
                    candidate.requestId === firstStop.deliveryRequestId &&
                    (candidate.milestone === 'exception' ||
                        candidate.milestone === 'recovery'),
            )
            .map((candidate) => ({
                milestone: candidate.milestone,
                retryAttempt: candidate.retryAttempt,
                sourceKind: candidate.sourceKind,
                stopId: candidate.stopId,
            }))
            .sort((first, second) =>
                first.milestone.localeCompare(second.milestone),
            ),
        [
            {
                milestone: 'exception',
                retryAttempt: firstStop.retryAttempt,
                sourceKind: 'exception-operation',
                stopId: firstStop.id,
            },
            {
                milestone: 'recovery',
                retryAttempt: firstStop.retryAttempt + 1,
                sourceKind: 'retry-state',
                stopId: firstStop.id,
            },
        ],
    );
    const secondAttemptFirst = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'bulk-second-attempt-first-item',
        occurredAt: new Date('2026-07-13T12:21:00.000Z'),
        exceptions: [
            {
                stopId: firstStop.id,
                outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                reason: DeliveryRunExceptionReasons.ADDRESS_INACCESSIBLE,
            },
        ],
    });
    await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'bulk-second-attempt-second-item',
        occurredAt: new Date('2026-07-13T12:22:00.000Z'),
        exceptions: [
            {
                stopId: secondStop.id,
                outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                reason: DeliveryRunExceptionReasons.ADDRESS_INACCESSIBLE,
            },
        ],
    });
    assert.ok(secondAttemptFirst.result.routeRevision > retried.routeRevision);

    const retrySteps = (await getDeliveryRunExecutionProgress(run.id)).filter(
        isRetryDeliveryStep,
    );
    assert.equal(retrySteps.length, 1);
    assert.equal(retrySteps[0]?.retryAttempt, 2);
    assert.deepEqual(
        retrySteps[0]?.stopIds.sort((a, b) => a - b),
        [firstStop.id, secondStop.id],
    );
    const persisted = await getDeliveryRun(run.id);
    assert.equal(persisted?.stops[0]?.retryLaneRank, 2);
    assert.equal(persisted?.stops[1]?.retryLaneRank, 2);
    assert.equal(persisted?.stops[0]?.retryAttempt, 2);
    assert.equal(persisted?.stops[1]?.retryAttempt, 2);
});

test('active assignment lookup ignores an unreleased stale stop in a terminal run', async () => {
    const fixture = await createDeliveryRunFixture();
    const driverUserId = fixture.driverUserIds[0];
    const requestId = fixture.requestIds[0];
    assert.ok(driverUserId);
    assert.ok(requestId);
    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: [requestId],
    });
    await storage()
        .update(deliveryRuns)
        .set({
            state: DeliveryRunStates.COMPLETED,
            completedAt: new Date('2026-07-13T12:30:00.000Z'),
        })
        .where(eq(deliveryRuns.id, run.id));

    assert.equal(
        (await getActiveDeliveryRunStopsForRequestIds([requestId])).length,
        0,
    );
    assert.equal(
        (await getDeliveryRunStopsForRequestIds([requestId]))[0]?.run.id,
        run.id,
    );
});

test('legacy reroute keeps completed bulk sequences and legacy estimate provenance', async () => {
    const fixture = await createDeliveryRunFixture({
        accountIndexes: [0, 0, 0, 0],
    });
    const driverUserId = fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: fixture.requestIds,
    });
    const [firstStop, secondStop, deferredStop, currentStop] = run.stops;
    assert.ok(firstStop);
    assert.ok(secondStop);
    assert.ok(deferredStop);
    assert.ok(currentStop);
    await fulfillDeliveryRunStops({
        driverUserId,
        runId: run.id,
        stopIds: [firstStop.id, secondStop.id],
        expectedRouteRevision: run.routeRevision,
    });
    const progressed = await getDeliveryRun(run.id);
    assert.ok(progressed);
    const deferred = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        expectedRouteRevision: progressed.routeRevision,
        clientOperationId: 'legacy-deferred-before-reroute',
        occurredAt: new Date('2026-07-13T13:00:00.000Z'),
        exceptions: [
            {
                stopId: deferredStop.id,
                outcome: DeliveryRunExceptionOutcomes.DEFERRED,
                reason: DeliveryRunExceptionReasons.CUSTOMER_UNAVAILABLE,
            },
        ],
    });
    const claimedAt = new Date();
    assert.ok(
        await claimDeliveryRunReroute({
            runId: run.id,
            expectedRouteRevision: deferred.result.routeRevision,
            claimedAt,
        }),
    );
    await applyDeliveryRunReroute({
        runId: run.id,
        expectedRouteRevision: deferred.result.routeRevision,
        rerouteClaimedAt: claimedAt,
        estimateSource: DeliveryRunEstimateSources.GOOGLE,
        encodedPolyline: 'rerouted-google-route',
        totalDistanceMeters: 2_000,
        totalDurationSeconds: 900,
        pickupEstimates: [],
        stopEstimates: [
            {
                stopIds: [currentStop.id],
                itinerarySequence: 3,
                estimatedArrivalAt: new Date('2026-07-13T13:10:00.000Z'),
                estimatedTravelSeconds: 120,
                estimatedDistanceMeters: 1_000,
            },
            {
                stopIds: [deferredStop.id],
                itinerarySequence: 4,
                estimatedArrivalAt: new Date('2026-07-13T13:20:00.000Z'),
                estimatedTravelSeconds: 120,
                estimatedDistanceMeters: 1_000,
            },
        ],
    });

    const rerouted = await getDeliveryRun(run.id);
    assert.equal(rerouted?.routePlanVersion, 1);
    assert.equal(rerouted?.estimateSource, DeliveryRunEstimateSources.LEGACY);
    assert.equal(hasLegacyGoogleRouteArtifact(rerouted?.encodedPolyline), true);
    assert.equal(
        deliveryRunRoutePolyline(rerouted?.encodedPolyline),
        'rerouted-google-route',
    );
    assert.equal(
        rerouted?.stops.find((stop) => stop.id === currentStop.id)?.sequence,
        3,
    );
    assert.equal(
        rerouted?.stops.find((stop) => stop.id === deferredStop.id)?.sequence,
        4,
    );
    assert.deepEqual(
        rerouted?.stops.slice(0, 2).map((stop) => stop.state),
        [DeliveryRunStopStates.DELIVERED, DeliveryRunStopStates.DELIVERED],
    );
});

test('reroute swaps pending pickup itinerary positions without uniqueness collisions', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    const [firstPickup, secondPickup] = run.pickupNodes;
    assert.ok(firstPickup);
    assert.ok(secondPickup);
    const rerouteRequiredAt = new Date('2026-07-13T13:30:00.000Z');
    await storage()
        .update(deliveryRuns)
        .set({ rerouteRequiredAt })
        .where(eq(deliveryRuns.id, run.id));
    const claimedAt = new Date();
    assert.ok(
        await claimDeliveryRunReroute({
            runId: run.id,
            expectedRouteRevision: run.routeRevision,
            claimedAt,
        }),
    );
    await applyDeliveryRunReroute({
        runId: run.id,
        expectedRouteRevision: run.routeRevision,
        rerouteClaimedAt: claimedAt,
        estimateSource: DeliveryRunEstimateSources.LOCAL,
        totalDistanceMeters: 3_000,
        totalDurationSeconds: 1_200,
        pickupEstimates: [
            {
                pickupNodeId: firstPickup.id,
                itinerarySequence: secondPickup.itinerarySequence ?? 2,
                estimatedArrivalAt: new Date('2026-07-13T13:35:00.000Z'),
                incomingTravelSeconds: 60,
                incomingDistanceMeters: 500,
            },
            {
                pickupNodeId: secondPickup.id,
                itinerarySequence: firstPickup.itinerarySequence ?? 1,
                estimatedArrivalAt: new Date('2026-07-13T13:40:00.000Z'),
                incomingTravelSeconds: 60,
                incomingDistanceMeters: 500,
            },
        ],
        stopEstimates: run.stops.map((stop, index) => ({
            stopIds: [stop.id],
            itinerarySequence: stop.itinerarySequence ?? index + 3,
            estimatedArrivalAt: new Date(
                Date.parse('2026-07-13T13:45:00.000Z') + index * 60_000,
            ),
            estimatedTravelSeconds: 60,
            estimatedDistanceMeters: 500,
        })),
    });

    const rerouted = await getDeliveryRun(run.id);
    assert.deepEqual(
        rerouted?.pickupNodes.map((pickup) => pickup.itinerarySequence),
        [secondPickup.itinerarySequence, firstPickup.itinerarySequence],
    );
});

test('a partially cancelled stop is released for explicit admin reactivation', async () => {
    const { prepared, run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup({ driverCount: 2 });
    const [cancelledStop, remainingStop] = run.stops;
    const nextDriverUserId = prepared.fixture.driverUserIds[1];
    assert.ok(cancelledStop);
    assert.ok(remainingStop);
    assert.ok(nextDriverUserId);
    await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'partial-cancel-before-reactivation',
        occurredAt: new Date('2026-07-13T14:00:00.000Z'),
        exceptions: [
            {
                stopId: cancelledStop.id,
                outcome: DeliveryRunExceptionOutcomes.CANCELLED,
                reason: DeliveryRunExceptionReasons.CANCELLATION,
            },
        ],
    });
    const activeRun = await getDeliveryRun(run.id);
    assert.equal(activeRun?.state, DeliveryRunStates.ACTIVE);
    assert.equal(
        activeRun?.stops.find((stop) => stop.id === cancelledStop.id)?.state,
        DeliveryRunStopStates.CANCELLED,
    );
    assert.ok(
        activeRun?.stops.find((stop) => stop.id === cancelledStop.id)
            ?.releasedAt,
    );
    assert.equal(
        activeRun?.stops.find((stop) => stop.id === remainingStop.id)?.state,
        DeliveryRunStopStates.PENDING,
    );

    await uncancelDeliveryRequest(cancelledStop.deliveryRequestId);
    await readyDeliveryRequest(cancelledStop.deliveryRequestId);
    const nextPreparation = await singleRequestPreparation({
        prepared,
        requestId: cancelledStop.deliveryRequestId,
        driverUserId: nextDriverUserId,
    });
    const saved = await saveDeliveryRunPreparation(nextPreparation);
    const nextRun = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId: nextDriverUserId,
        deliveryRequestIds: [cancelledStop.deliveryRequestId],
    });
    assert.notEqual(nextRun.id, run.id);
    assert.equal(
        (
            await getActiveDeliveryRunStopsForRequestIds([
                cancelledStop.deliveryRequestId,
            ])
        )[0]?.run.id,
        nextRun.id,
    );
});

test('a legacy no-override delivery receipt keeps its exact replay hash', async () => {
    const { run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [targetStop] = run.stops;
    assert.ok(targetStop);
    const input = {
        kind: DeliveryRunStopOperationKinds.DELIVER,
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRouteRevision: run.routeRevision,
        clientOperationId: 'legacy-no-override-delivery',
        occurredAt: new Date(Date.now() - 1_000),
        deliveryNotes: 'Legacy receipt replay',
    } as const;
    const legacyPayloadHash = createHash('sha256')
        .update(
            JSON.stringify({
                clientOperationId: input.clientOperationId,
                kind: input.kind,
                targetStopId: input.targetStopId,
                expectedRouteRevision: input.expectedRouteRevision,
                occurredAt: input.occurredAt.toISOString(),
                deliveryNotes: input.deliveryNotes,
            }),
        )
        .digest('hex');
    const legacyResult = {
        kind: DeliveryRunStopOperationKinds.DELIVER,
        targetStopId: targetStop.id,
        affectedStopIds: run.stops.map((stop) => stop.id),
        routeRevision: run.routeRevision + 1,
        reroutePending: false,
        runCompleted: true,
    } as const;
    await storage().insert(deliveryRunStopOperations).values({
        runId: run.id,
        targetStopId: targetStop.id,
        driverUserId,
        clientOperationId: input.clientOperationId,
        kind: input.kind,
        payloadHash: legacyPayloadHash,
        result: legacyResult,
        occurredAt: input.occurredAt,
        appliedAt: new Date(),
    });

    const replayed = await recordDeliveryRunStopOperation(input);

    assert.equal(replayed.replayed, true);
    assert.deepEqual(replayed.result, legacyResult);
    assert.deepEqual(replayed.newlyFulfilledRequestIds, []);
});

test('arrived and reviewed bulk completion does not require an override', async () => {
    const { prepared, run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [targetStop] = run.stops;
    const [accountId] = prepared.fixture.accountIds;
    assert.ok(targetStop);
    assert.ok(accountId);
    const recipientUserId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: recipientUserId,
            userName: `delivery-lifecycle-${recipientUserId}@example.test`,
            displayName: 'Delivery lifecycle recipient',
            role: 'user',
        });
    await storage()
        .insert(accountUsers)
        .values({ accountId, userId: recipientUserId });

    const arrival = await recordDeliveryRunStopOperation({
        kind: DeliveryRunStopOperationKinds.ARRIVE,
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRouteRevision: run.routeRevision,
        clientOperationId: 'reviewed-bulk-arrival',
        occurredAt: new Date(Date.now() - 2_000),
    });
    await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRetryAttempt: 0,
        mutations: run.stops.map((stop, index) => ({
            clientOperationId: `reviewed-bulk-handoff-${index}`,
            occurredAt: new Date(Date.now() - 1_500 + index),
            kind: DeliveryRunHandoffOperationKinds.MARK_ITEM,
            stopId: stop.id,
            outcome: DeliveryRunHandoffItemStates.SKIPPED,
            reason: DeliveryRunHandoffSkipReasons.MANUAL_VERIFICATION,
        })),
    });

    const completion = await recordDeliveryRunStopOperation({
        kind: DeliveryRunStopOperationKinds.DELIVER,
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRouteRevision: arrival.result.routeRevision,
        clientOperationId: 'reviewed-bulk-delivery',
        occurredAt: new Date(Date.now() - 500),
    });

    assert.equal(completion.replayed, false);
    assert.equal(completion.result.override, undefined);
    assert.equal(completion.result.handoff?.unverifiedCount, 0);
    assert.equal(completion.result.handoff?.skippedCount, run.stops.length);
    const lifecycleCandidates = (
        await getDeliveryLifecycleReconciliationCandidates({
            startedAt: new Date(Date.now() - 60_000),
            limit: 1000,
        })
    ).candidates.filter(
        (candidate) =>
            candidate.runId === run.id &&
            (candidate.milestone === 'arrived' ||
                candidate.milestone === 'delivered'),
    );
    assert.deepEqual(
        lifecycleCandidates
            .map((candidate) => ({
                milestone: candidate.milestone,
                requestId: candidate.requestId,
                retryAttempt: candidate.retryAttempt,
                stopId: candidate.stopId,
            }))
            .sort((first, second) =>
                `${first.requestId}:${first.milestone}`.localeCompare(
                    `${second.requestId}:${second.milestone}`,
                ),
            ),
        run.stops
            .flatMap((stop) =>
                ['arrived', 'delivered'].map((milestone) => ({
                    milestone,
                    requestId: stop.deliveryRequestId,
                    retryAttempt: 0,
                    stopId: stop.id,
                })),
            )
            .sort((first, second) =>
                `${first.requestId}:${first.milestone}`.localeCompare(
                    `${second.requestId}:${second.milestone}`,
                ),
            ),
    );
    assert.equal(
        (await filterMissingDeliveryLifecycleNotifications(lifecycleCandidates))
            .length,
        lifecycleCandidates.length,
    );
    await storage()
        .delete(deliveryRunHandoffOperations)
        .where(eq(deliveryRunHandoffOperations.runId, run.id));
});

test('an explicit completion override persists the server-computed empty bypass list', async () => {
    const { run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [targetStop] = run.stops;
    assert.ok(targetStop);

    const arrival = await recordDeliveryRunStopOperation({
        kind: DeliveryRunStopOperationKinds.ARRIVE,
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRouteRevision: run.routeRevision,
        clientOperationId: 'concurrent-review-arrival',
        occurredAt: new Date(Date.now() - 2_000),
    });
    await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRetryAttempt: 0,
        mutations: run.stops.map((stop, index) => ({
            clientOperationId: `concurrent-review-handoff-${index}`,
            occurredAt: new Date(Date.now() - 1_500 + index),
            kind: DeliveryRunHandoffOperationKinds.MARK_ITEM,
            stopId: stop.id,
            outcome: DeliveryRunHandoffItemStates.SKIPPED,
            reason: DeliveryRunHandoffSkipReasons.MANUAL_VERIFICATION,
        })),
    });

    const completion = await recordDeliveryRunStopOperation({
        kind: DeliveryRunStopOperationKinds.DELIVER,
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRouteRevision: arrival.result.routeRevision,
        clientOperationId: 'concurrent-review-delivery',
        occurredAt: new Date(Date.now() - 500),
        completionOverride: {
            reason: DeliveryRunCompletionOverrideReasons.WORKFLOW_RECOVERY,
        },
    });

    assert.deepEqual(completion.result.override, {
        reason: DeliveryRunCompletionOverrideReasons.WORKFLOW_RECOVERY,
        bypassed: [],
    });
    await storage()
        .delete(deliveryRunHandoffOperations)
        .where(eq(deliveryRunHandoffOperations.runId, run.id));
});

test('missing arrival and handoff review require an auditable completion override', async () => {
    const { run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [targetStop] = run.stops;
    assert.ok(targetStop);
    const occurredAt = new Date(Date.now() - 1_000);

    await assertExecutionError(
        recordDeliveryRunStopOperation({
            kind: DeliveryRunStopOperationKinds.DELIVER,
            driverUserId,
            runId: run.id,
            targetStopId: targetStop.id,
            expectedRouteRevision: run.routeRevision,
            clientOperationId: 'unguarded-bulk-delivery',
            occurredAt,
        }),
        DeliveryRunExecutionErrorCodes.COMPLETION_OVERRIDE_REQUIRED,
    );
    const unchangedRun = await getDeliveryRun(run.id);
    assert.ok(
        unchangedRun?.stops.every(
            (stop) => stop.state === DeliveryRunStopStates.PENDING,
        ),
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunStopOperations)
                .where(eq(deliveryRunStopOperations.runId, run.id))
        ).length,
        0,
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(events)
                .where(
                    and(
                        eq(
                            events.type,
                            knownEventTypes.delivery.requestFulfilled,
                        ),
                        inArray(
                            events.aggregateId,
                            run.stops.map((stop) => stop.deliveryRequestId),
                        ),
                    ),
                )
        ).length,
        0,
    );

    const overrideInput = {
        kind: DeliveryRunStopOperationKinds.DELIVER,
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRouteRevision: run.routeRevision,
        clientOperationId: 'overridden-bulk-delivery',
        occurredAt,
        completionOverride: {
            reason: DeliveryRunCompletionOverrideReasons.MANUAL_HANDOFF,
        },
    } as const;
    const applied = await recordDeliveryRunStopOperation(overrideInput);
    assert.equal(applied.replayed, false);
    assert.deepEqual(applied.result.override, {
        reason: DeliveryRunCompletionOverrideReasons.MANUAL_HANDOFF,
        bypassed: ['arrival', 'handoff-review'],
    });

    const replayed = await recordDeliveryRunStopOperation(overrideInput);
    assert.equal(replayed.replayed, true);
    assert.deepEqual(replayed.result, applied.result);
    await assertExecutionError(
        recordDeliveryRunStopOperation({
            ...overrideInput,
            completionOverride: {
                reason: DeliveryRunCompletionOverrideReasons.DEVICE_UNAVAILABLE,
            },
        }),
        DeliveryRunExecutionErrorCodes.STOP_OPERATION_CONFLICT,
    );
    const [receipt] = await storage()
        .select({ result: deliveryRunStopOperations.result })
        .from(deliveryRunStopOperations)
        .where(eq(deliveryRunStopOperations.runId, run.id));
    assert.deepEqual(receipt?.result.override, applied.result.override);
});

test('stop operation receipts replay exact bulk arrival and delivery results after completion', async () => {
    const { run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const initialRun = await getDeliveryRun(run.id);
    const [firstStop, secondStop] = run.stops;
    assert.ok(initialRun);
    assert.ok(firstStop);
    assert.ok(secondStop);

    const arrivalOccurredAt = new Date(Date.now() - 2_000);
    const arrivalInput = {
        kind: DeliveryRunStopOperationKinds.ARRIVE,
        driverUserId,
        runId: run.id,
        targetStopId: firstStop.id,
        expectedRouteRevision: initialRun.routeRevision,
        clientOperationId: 'offline-bulk-arrival',
        occurredAt: arrivalOccurredAt,
    } as const;
    const arrival = await recordDeliveryRunStopOperation(arrivalInput);
    assert.equal(arrival.replayed, false);
    assert.deepEqual(arrival.result, {
        kind: DeliveryRunStopOperationKinds.ARRIVE,
        targetStopId: firstStop.id,
        affectedStopIds: [firstStop.id, secondStop.id],
        routeRevision: initialRun.routeRevision + 1,
        reroutePending: false,
        runCompleted: false,
    });
    const arrivedRun = await getDeliveryRun(run.id);
    assert.deepEqual(
        arrivedRun?.stops.map((stop) => stop.state),
        [DeliveryRunStopStates.ARRIVED, DeliveryRunStopStates.ARRIVED],
    );
    assert.ok(
        arrivedRun?.stops.every(
            (stop) => stop.arrivedAt?.getTime() === arrivalOccurredAt.getTime(),
        ),
    );
    const {
        runId: handoffRunId,
        targetStopId: handoffTargetStopId,
        ...expectedHandoff
    } = await getDeliveryRunHandoffManifest({
        readerUserId: driverUserId,
        runId: run.id,
        targetStopId: secondStop.id,
    });
    assert.equal(handoffRunId, run.id);
    assert.equal(handoffTargetStopId, secondStop.id);

    const deliveryOccurredAt = new Date(Date.now() - 1_000);
    const privateNote = 'Kupac je preuzeo obje gredice na stražnjem ulazu.';
    const deliveryInput = {
        kind: DeliveryRunStopOperationKinds.DELIVER,
        driverUserId,
        runId: run.id,
        targetStopId: secondStop.id,
        expectedRouteRevision: arrival.result.routeRevision,
        clientOperationId: 'offline-bulk-delivery',
        occurredAt: deliveryOccurredAt,
        deliveryNotes: privateNote,
        completionOverride: {
            reason: DeliveryRunCompletionOverrideReasons.WORKFLOW_RECOVERY,
        },
    } as const;
    const deliveryAttempts = await Promise.all([
        recordDeliveryRunStopOperation(deliveryInput),
        recordDeliveryRunStopOperation(deliveryInput),
    ]);
    assert.deepEqual(
        deliveryAttempts.map((attempt) => attempt.replayed).sort(),
        [false, true],
    );
    const appliedDelivery = deliveryAttempts.find(
        (attempt) => !attempt.replayed,
    );
    const concurrentReplay = deliveryAttempts.find(
        (attempt) => attempt.replayed,
    );
    assert.ok(appliedDelivery);
    assert.ok(concurrentReplay);
    assert.deepEqual(concurrentReplay.result, appliedDelivery.result);
    assert.deepEqual(
        [...appliedDelivery.newlyFulfilledRequestIds].sort(),
        [firstStop.deliveryRequestId, secondStop.deliveryRequestId].sort(),
    );
    assert.deepEqual(concurrentReplay.newlyFulfilledRequestIds, []);
    assert.deepEqual(appliedDelivery.result, {
        kind: DeliveryRunStopOperationKinds.DELIVER,
        targetStopId: secondStop.id,
        affectedStopIds: [firstStop.id, secondStop.id],
        routeRevision: arrival.result.routeRevision + 1,
        reroutePending: false,
        runCompleted: true,
        handoff: expectedHandoff,
        override: {
            reason: DeliveryRunCompletionOverrideReasons.WORKFLOW_RECOVERY,
            bypassed: ['handoff-review'],
        },
    });

    const completedRun = await getDeliveryRun(run.id);
    assert.equal(completedRun?.state, DeliveryRunStates.COMPLETED);
    assert.ok(
        completedRun?.stops.every(
            (stop) =>
                stop.state === DeliveryRunStopStates.DELIVERED &&
                stop.deliveredAt?.getTime() === deliveryOccurredAt.getTime(),
        ),
    );
    assert.ok(
        completedRun?.completedAt &&
            completedRun.completedAt.getTime() >= deliveryOccurredAt.getTime(),
    );

    const fulfillmentEventsBeforeReplay = await storage()
        .select({
            aggregateId: events.aggregateId,
            version: events.version,
            data: events.data,
        })
        .from(events)
        .where(
            and(
                eq(events.type, knownEventTypes.delivery.requestFulfilled),
                inArray(events.aggregateId, [
                    firstStop.deliveryRequestId,
                    secondStop.deliveryRequestId,
                ]),
            ),
        );
    assert.equal(fulfillmentEventsBeforeReplay.length, 2);
    for (const stop of [firstStop, secondStop]) {
        const fulfillmentEvent = fulfillmentEventsBeforeReplay.find(
            ({ aggregateId }) => aggregateId === stop.deliveryRequestId,
        );
        assert.equal(fulfillmentEvent?.version, 2);
        assert.deepEqual(fulfillmentEvent?.data, {
            status: DeliveryRequestStates.FULFILLED,
            deliveryNotes: privateNote,
            fulfilledAt: deliveryOccurredAt.toISOString(),
            handoffVerification: {
                version: 1,
                runId: run.id,
                stopId: stop.id,
                retryAttempt: stop.retryAttempt,
                clientOperationId: deliveryInput.clientOperationId,
                traceLinkId: stop.pickupTraceLinkId,
                qrAvailable: true,
                result: DeliveryRunHandoffItemStates.UNVERIFIED,
            },
        });
        assert.ok(
            !JSON.stringify(fulfillmentEvent).includes(
                stop.pickupTraceToken ?? 'unexpected-missing-trace-token',
            ),
        );
    }

    const arrivalReplay = await recordDeliveryRunStopOperation(arrivalInput);
    const deliveryReplay = await recordDeliveryRunStopOperation(deliveryInput);
    assert.equal(arrivalReplay.replayed, true);
    assert.equal(deliveryReplay.replayed, true);
    assert.deepEqual(arrivalReplay.result, arrival.result);
    assert.deepEqual(deliveryReplay.result, appliedDelivery.result);
    assert.deepEqual(deliveryReplay.newlyFulfilledRequestIds, []);
    await assertExecutionError(
        recordDeliveryRunStopOperation({
            ...deliveryInput,
            completionOverride: {
                reason: DeliveryRunCompletionOverrideReasons.DEVICE_UNAVAILABLE,
            },
        }),
        DeliveryRunExecutionErrorCodes.STOP_OPERATION_CONFLICT,
    );

    const fulfillmentEventsAfterReplay = await storage()
        .select({
            aggregateId: events.aggregateId,
            version: events.version,
            data: events.data,
        })
        .from(events)
        .where(
            and(
                eq(events.type, knownEventTypes.delivery.requestFulfilled),
                inArray(events.aggregateId, [
                    firstStop.deliveryRequestId,
                    secondStop.deliveryRequestId,
                ]),
            ),
        );
    assert.deepEqual(
        fulfillmentEventsAfterReplay,
        fulfillmentEventsBeforeReplay,
    );
    const receipts = await storage()
        .select()
        .from(deliveryRunStopOperations)
        .where(eq(deliveryRunStopOperations.runId, run.id));
    assert.equal(receipts.length, 2);
    assert.ok(!JSON.stringify(receipts).includes(privateNote));
});

test('stop operation IDs reject changed payloads and stale new commands without side effects', async () => {
    const { prepared, run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup({ driverCount: 2 });
    const [targetStop] = run.stops;
    const otherDriverUserId = prepared.fixture.driverUserIds[1];
    assert.ok(targetStop);
    assert.ok(otherDriverUserId);
    const occurredAt = new Date(Date.now() - 1_000);
    const input = {
        kind: DeliveryRunStopOperationKinds.ARRIVE,
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRouteRevision: run.routeRevision,
        clientOperationId: 'conflict-checked-arrival',
        occurredAt,
    } as const;
    const applied = await recordDeliveryRunStopOperation(input);
    assert.equal(applied.replayed, false);

    await assertExecutionError(
        recordDeliveryRunStopOperation({
            ...input,
            occurredAt: new Date(occurredAt.getTime() + 1),
        }),
        DeliveryRunExecutionErrorCodes.STOP_OPERATION_CONFLICT,
    );
    await assertExecutionError(
        recordDeliveryRunStopOperation({
            ...input,
            kind: DeliveryRunStopOperationKinds.DELIVER,
            deliveryNotes: 'Promijenjen sadržaj',
        }),
        DeliveryRunExecutionErrorCodes.STOP_OPERATION_CONFLICT,
    );
    await assertExecutionError(
        recordDeliveryRunStopOperation({
            ...input,
            driverUserId: otherDriverUserId,
        }),
        DeliveryRunExecutionErrorCodes.STOP_OPERATION_CONFLICT,
    );
    await assertExecutionError(
        recordDeliveryRunStopOperation({
            ...input,
            clientOperationId: 'stale-new-arrival',
        }),
        DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
    );
    await assertExecutionError(
        recordDeliveryRunStopOperation({
            ...input,
            clientOperationId: 'future-new-arrival',
            expectedRouteRevision: applied.result.routeRevision,
            occurredAt: new Date(Date.now() + 5 * 60 * 1_000 + 1_000),
        }),
        DeliveryRunExecutionErrorCodes.STOP_OPERATION_INVALID,
    );
    await assertExecutionError(
        recordDeliveryRunStopOperation({
            ...input,
            kind: DeliveryRunStopOperationKinds.DELIVER,
            clientOperationId: 'delivery-before-arrival',
            expectedRouteRevision: applied.result.routeRevision,
            occurredAt: new Date(occurredAt.getTime() - 1),
        }),
        DeliveryRunExecutionErrorCodes.STOP_OPERATION_INVALID,
    );

    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunStopOperations)
                .where(eq(deliveryRunStopOperations.runId, run.id))
        ).length,
        1,
    );
    const persisted = await getDeliveryRun(run.id);
    assert.equal(persisted?.routeRevision, applied.result.routeRevision);
    assert.ok(
        persisted?.stops.every(
            (stop) => stop.state === DeliveryRunStopStates.ARRIVED,
        ),
    );
});

test('bulk delivery command rolls back fulfillment events, stop state, and receipt together', async () => {
    const fixture = await createDeliveryRunFixture({
        accountIndexes: [0, 0, 0],
    });
    await createRequestEvents(fixture);
    const [driverUserId] = fixture.driverUserIds;
    const [firstRequestId, secondRequestId] = fixture.requestIds;
    assert.ok(driverUserId);
    assert.ok(firstRequestId);
    assert.ok(secondRequestId);
    await cancelDeliveryRequest(
        secondRequestId,
        'admin',
        'Otkazano prije skupne dostave',
    );
    const run = await createRun({
        fixture,
        driverUserId,
        requestIds: fixture.requestIds,
    });
    const [firstStop] = run.stops;
    assert.ok(firstStop);

    await assertExecutionError(
        recordDeliveryRunStopOperation({
            kind: DeliveryRunStopOperationKinds.DELIVER,
            driverUserId,
            runId: run.id,
            targetStopId: firstStop.id,
            expectedRouteRevision: run.routeRevision,
            clientOperationId: 'rollback-bulk-delivery',
            occurredAt: new Date(),
            completionOverride: {
                reason: DeliveryRunCompletionOverrideReasons.WORKFLOW_RECOVERY,
            },
        }),
        DeliveryRunExecutionErrorCodes.STOP_OPERATION_STATE_CONFLICT,
    );

    const unchangedRun = await getDeliveryRun(run.id);
    assert.deepEqual(
        unchangedRun?.stops.map((stop) => stop.state),
        [
            DeliveryRunStopStates.PENDING,
            DeliveryRunStopStates.PENDING,
            DeliveryRunStopStates.PENDING,
        ],
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunStopOperations)
                .where(eq(deliveryRunStopOperations.runId, run.id))
        ).length,
        0,
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(events)
                .where(
                    and(
                        eq(
                            events.type,
                            knownEventTypes.delivery.requestFulfilled,
                        ),
                        eq(events.aggregateId, firstRequestId),
                    ),
                )
        ).length,
        0,
    );
    assert.notEqual(
        (await getDeliveryRequest(firstRequestId))?.state,
        'fulfilled',
    );
});

test('bulk delivery command treats deferred and failed request races as state conflicts', async () => {
    for (const outcome of [
        DeliveryRunExceptionOutcomes.DEFERRED,
        DeliveryRunExceptionOutcomes.FAILED,
    ]) {
        const fixture = await createDeliveryRunFixture({
            accountIndexes: [0, 0, 0],
        });
        await createRequestEvents(fixture);
        const [driverUserId] = fixture.driverUserIds;
        const [firstRequestId, secondRequestId] = fixture.requestIds;
        assert.ok(driverUserId);
        assert.ok(firstRequestId);
        assert.ok(secondRequestId);
        const run = await createRun({
            fixture,
            driverUserId,
            requestIds: fixture.requestIds,
        });
        const [firstStop, secondStop] = run.stops;
        assert.ok(firstStop);
        assert.ok(secondStop);
        await createEvent(
            knownEvents.delivery.requestExceptionRecordedV1(secondRequestId, {
                runId: run.id,
                stopId: secondStop.id,
                clientOperationId: `external-${outcome}`,
                outcome,
                reason:
                    outcome === DeliveryRunExceptionOutcomes.DEFERRED
                        ? DeliveryRunExceptionReasons.CUSTOMER_UNAVAILABLE
                        : DeliveryRunExceptionReasons.HARVEST_MISSING,
                retryable: outcome === DeliveryRunExceptionOutcomes.DEFERRED,
                occurredAt: new Date().toISOString(),
                recordedByUserId: driverUserId,
                routeRevision: run.routeRevision,
            }),
        );

        await assertExecutionError(
            recordDeliveryRunStopOperation({
                kind: DeliveryRunStopOperationKinds.DELIVER,
                driverUserId,
                runId: run.id,
                targetStopId: firstStop.id,
                expectedRouteRevision: run.routeRevision,
                clientOperationId: `rollback-bulk-${outcome}`,
                occurredAt: new Date(),
                completionOverride: {
                    reason: DeliveryRunCompletionOverrideReasons.WORKFLOW_RECOVERY,
                },
            }),
            DeliveryRunExecutionErrorCodes.STOP_OPERATION_STATE_CONFLICT,
        );

        const unchangedRun = await getDeliveryRun(run.id);
        assert.ok(
            unchangedRun?.stops.every(
                (stop) => stop.state === DeliveryRunStopStates.PENDING,
            ),
        );
        assert.equal(
            (
                await storage()
                    .select()
                    .from(deliveryRunStopOperations)
                    .where(eq(deliveryRunStopOperations.runId, run.id))
            ).length,
            0,
        );
        assert.equal(
            (
                await storage()
                    .select()
                    .from(events)
                    .where(
                        and(
                            eq(
                                events.type,
                                knownEventTypes.delivery.requestFulfilled,
                            ),
                            eq(events.aggregateId, firstRequestId),
                        ),
                    )
            ).length,
            0,
        );
    }
});

test('stop operation occurrence bounds and run-target integrity are enforced', async () => {
    const appliedAt = new Date('2026-07-15T12:00:00.000Z');
    assert.equal(
        deliveryRunStopOperationOccurredAtIsAcceptable(
            new Date(appliedAt.getTime() - 36 * 60 * 60 * 1_000),
            appliedAt,
        ),
        true,
    );
    assert.equal(
        deliveryRunStopOperationOccurredAtIsAcceptable(
            new Date(appliedAt.getTime() - 36 * 60 * 60 * 1_000 - 1),
            appliedAt,
        ),
        false,
    );
    assert.equal(
        deliveryRunStopOperationOccurredAtIsAcceptable(
            new Date(appliedAt.getTime() + 5 * 60 * 1_000),
            appliedAt,
        ),
        true,
    );
    assert.equal(
        deliveryRunStopOperationOccurredAtIsAcceptable(
            new Date(appliedAt.getTime() + 5 * 60 * 1_000 + 1),
            appliedAt,
        ),
        false,
    );

    const fixture = await createDeliveryRunFixture({
        accountIndexes: [0, 0],
        driverCount: 2,
    });
    const [firstDriverUserId, secondDriverUserId] = fixture.driverUserIds;
    const [firstRequestId, secondRequestId] = fixture.requestIds;
    assert.ok(firstDriverUserId);
    assert.ok(secondDriverUserId);
    assert.ok(firstRequestId);
    assert.ok(secondRequestId);
    const firstRun = await createRun({
        fixture,
        driverUserId: firstDriverUserId,
        requestIds: [firstRequestId],
    });
    const secondRun = await createRun({
        fixture,
        driverUserId: secondDriverUserId,
        requestIds: [secondRequestId],
    });
    const [foreignTargetStop] = secondRun.stops;
    assert.ok(foreignTargetStop);
    await assert.rejects(
        storage()
            .insert(deliveryRunStopOperations)
            .values({
                runId: firstRun.id,
                targetStopId: foreignTargetStop.id,
                driverUserId: firstDriverUserId,
                clientOperationId: 'cross-run-target',
                kind: DeliveryRunStopOperationKinds.ARRIVE,
                payloadHash: '0'.repeat(64),
                result: {
                    kind: DeliveryRunStopOperationKinds.ARRIVE,
                    targetStopId: foreignTargetStop.id,
                    affectedStopIds: [foreignTargetStop.id],
                    routeRevision: 0,
                    reroutePending: false,
                    runCompleted: false,
                },
                occurredAt: new Date(),
            }),
        (error) =>
            error instanceof Error &&
            `${error.message} ${
                error.cause instanceof Error ? error.cause.message : ''
            }`.includes('delivery_run_stop_operations_run_target_stop_fk'),
    );
});

test('handoff scans persist, replay idempotently, and retain one receipt per operation', async () => {
    const { prepared, run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [targetStop] = run.stops;
    const [trace, otherTrace] = prepared.traceLinks;
    assert.ok(targetStop);
    assert.ok(trace);
    assert.ok(otherTrace);
    const occurredAt = new Date();
    const mutation = {
        clientOperationId: 'handoff-scan-persist',
        occurredAt,
        kind: DeliveryRunHandoffOperationKinds.SCAN,
        tracePath: `/trag/${trace.publicToken}`,
    } as const;

    const [applied] = await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRetryAttempt: 0,
        mutations: [mutation],
    });
    assert.equal(applied?.replayed, false);
    assert.equal(applied?.retryAttempt, 0);
    assert.deepEqual(applied?.result, {
        kind: DeliveryRunHandoffOperationKinds.SCAN,
        outcome: 'applied',
        affectedStopIds: [targetStop.id],
        itemState: DeliveryRunHandoffItemStates.SCANNED,
    });

    const persisted = await getDeliveryRunHandoffManifest({
        readerUserId: driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
    });
    assert.equal(persisted.expectedCount, 2);
    assert.equal(persisted.scannedCount, 1);
    assert.equal(persisted.unverifiedCount, 1);
    assert.equal(
        persisted.items.find((item) => item.stopId === targetStop.id)?.state,
        DeliveryRunHandoffItemStates.SCANNED,
    );

    const [replay] = await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRetryAttempt: 0,
        mutations: [mutation],
    });
    assert.equal(replay?.replayed, true);
    assert.equal(replay?.retryAttempt, 0);
    assert.deepEqual(replay?.result, applied?.result);

    const [semanticReplay] = await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRetryAttempt: 0,
        mutations: [
            {
                ...mutation,
                clientOperationId: 'handoff-scan-second-id',
            },
        ],
    });
    assert.equal(semanticReplay?.replayed, false);
    assert.equal(semanticReplay?.result.outcome, 'already-applied');
    assert.deepEqual(semanticReplay?.result.affectedStopIds, [targetStop.id]);

    await assertExecutionError(
        applyDeliveryRunHandoffMutations({
            driverUserId,
            runId: run.id,
            targetStopId: targetStop.id,
            expectedRetryAttempt: 0,
            mutations: [
                {
                    ...mutation,
                    tracePath: `/trag/${otherTrace.publicToken}`,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.HANDOFF_OPERATION_CONFLICT,
    );

    const receipts = await storage()
        .select()
        .from(deliveryRunHandoffOperations)
        .where(eq(deliveryRunHandoffOperations.runId, run.id));
    assert.equal(receipts.length, 2);
    assert.ok(
        receipts.every((receipt) => /^[a-f0-9]{64}$/.test(receipt.payloadHash)),
    );
    assert.ok(!JSON.stringify(receipts).includes(trace.publicToken));
    const reread = await getDeliveryRunHandoffManifest({
        readerUserId: driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
    });
    assert.deepEqual(reread, persisted);
});

test('handoff scan receipts record invalid and wrong-stop attempts without mutating items', async () => {
    const invalidFixture = await startPreparedBulkRunWithConfirmedPickup();
    const [invalidTarget] = invalidFixture.run.stops;
    assert.ok(invalidTarget);
    const beforeInvalid = await getDeliveryRunHandoffManifest({
        readerUserId: invalidFixture.driverUserId,
        runId: invalidFixture.run.id,
        targetStopId: invalidTarget.id,
    });
    const invalidPayload = 'not a trace QR payload';
    const [invalid] = await applyDeliveryRunHandoffMutations({
        driverUserId: invalidFixture.driverUserId,
        runId: invalidFixture.run.id,
        targetStopId: invalidTarget.id,
        expectedRetryAttempt: 0,
        mutations: [
            {
                clientOperationId: 'handoff-invalid-scan',
                occurredAt: new Date(),
                kind: DeliveryRunHandoffOperationKinds.SCAN,
                tracePath: invalidPayload,
            },
        ],
    });
    assert.equal(invalid?.result.outcome, 'invalid');
    assert.deepEqual(invalid?.result.affectedStopIds, []);
    assert.deepEqual(
        await getDeliveryRunHandoffManifest({
            readerUserId: invalidFixture.driverUserId,
            runId: invalidFixture.run.id,
            targetStopId: invalidTarget.id,
        }),
        beforeInvalid,
    );
    const invalidReceipts = await storage()
        .select()
        .from(deliveryRunHandoffOperations)
        .where(eq(deliveryRunHandoffOperations.runId, invalidFixture.run.id));
    assert.equal(invalidReceipts.length, 1);
    assert.ok(!JSON.stringify(invalidReceipts).includes(invalidPayload));

    const [missingItem] = await applyDeliveryRunHandoffMutations({
        driverUserId: invalidFixture.driverUserId,
        runId: invalidFixture.run.id,
        targetStopId: invalidTarget.id,
        expectedRetryAttempt: 0,
        mutations: [
            {
                clientOperationId: 'handoff-item-not-found',
                occurredAt: new Date(),
                kind: DeliveryRunHandoffOperationKinds.MARK_ITEM,
                stopId: 2_147_483_647,
                outcome: DeliveryRunHandoffItemStates.MISSING,
            },
        ],
    });
    assert.equal(missingItem?.result.outcome, 'item-not-found');
    assert.deepEqual(missingItem?.result.affectedStopIds, []);

    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    const [firstPickup] = run.pickupNodes;
    const [firstManifest] = run.runSlots;
    const [firstStop] = run.stops;
    const [firstTrace, futureTrace] = prepared.traceLinks;
    assert.ok(firstPickup);
    assert.ok(firstManifest);
    assert.ok(firstStop);
    assert.ok(firstTrace);
    assert.ok(futureTrace);
    await applyDeliveryRunPickupMutations({
        driverUserId,
        runId: run.id,
        pickupNodeId: firstPickup.id,
        mutations: [
            {
                clientOperationId: 'handoff-wrong-stop-pickup-scan',
                occurredAt: new Date('2026-07-13T08:01:00.000Z'),
                kind: DeliveryRunPickupOperationKinds.SCAN,
                traceToken: firstTrace.publicToken,
            },
            {
                clientOperationId: 'handoff-wrong-stop-pickup-confirm',
                occurredAt: new Date('2026-07-13T08:02:00.000Z'),
                kind: DeliveryRunPickupOperationKinds.CONFIRM_MANIFEST,
                manifestId: firstManifest.manifestId,
            },
        ],
    });
    const beforeWrongStop = await getDeliveryRunHandoffManifest({
        readerUserId: driverUserId,
        runId: run.id,
        targetStopId: firstStop.id,
    });
    const [wrongStop] = await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: firstStop.id,
        expectedRetryAttempt: 0,
        mutations: [
            {
                clientOperationId: 'handoff-wrong-stop-scan',
                occurredAt: new Date(),
                kind: DeliveryRunHandoffOperationKinds.SCAN,
                tracePath: `/trag/${futureTrace.publicToken}`,
            },
        ],
    });
    assert.equal(wrongStop?.result.outcome, 'wrong-stop');
    assert.deepEqual(wrongStop?.result.affectedStopIds, []);
    assert.deepEqual(
        await getDeliveryRunHandoffManifest({
            readerUserId: driverUserId,
            runId: run.id,
            targetStopId: firstStop.id,
        }),
        beforeWrongStop,
    );
});

test('bulk handoff item outcomes persist independently with a required skip reason', async () => {
    const { run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [firstStop, secondStop] = run.stops;
    assert.ok(firstStop);
    assert.ok(secondStop);

    const initial = await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: firstStop.id,
        expectedRetryAttempt: 0,
        mutations: [
            {
                clientOperationId: 'handoff-mark-no-label',
                occurredAt: new Date(),
                kind: DeliveryRunHandoffOperationKinds.MARK_ITEM,
                stopId: firstStop.id,
                outcome: DeliveryRunHandoffItemStates.NO_LABEL,
            },
            {
                clientOperationId: 'handoff-mark-missing',
                occurredAt: new Date(),
                kind: DeliveryRunHandoffOperationKinds.MARK_ITEM,
                stopId: secondStop.id,
                outcome: DeliveryRunHandoffItemStates.MISSING,
            },
        ],
    });
    assert.deepEqual(
        initial.map(({ result }) => ({
            outcome: result.outcome,
            affectedStopIds: result.affectedStopIds,
            itemState: result.itemState,
        })),
        [
            {
                outcome: 'applied',
                affectedStopIds: [firstStop.id],
                itemState: DeliveryRunHandoffItemStates.NO_LABEL,
            },
            {
                outcome: 'applied',
                affectedStopIds: [secondStop.id],
                itemState: DeliveryRunHandoffItemStates.MISSING,
            },
        ],
    );
    const afterInitial = await getDeliveryRunHandoffManifest({
        readerUserId: driverUserId,
        runId: run.id,
        targetStopId: firstStop.id,
    });
    assert.equal(afterInitial.noLabelCount, 1);
    assert.equal(afterInitial.missingCount, 1);

    const [skipped] = await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: firstStop.id,
        expectedRetryAttempt: 0,
        mutations: [
            {
                clientOperationId: 'handoff-mark-skipped',
                occurredAt: new Date(),
                kind: DeliveryRunHandoffOperationKinds.MARK_ITEM,
                stopId: firstStop.id,
                outcome: DeliveryRunHandoffItemStates.SKIPPED,
                reason: DeliveryRunHandoffSkipReasons.MANUAL_VERIFICATION,
            },
        ],
    });
    assert.deepEqual(skipped?.result, {
        kind: DeliveryRunHandoffOperationKinds.MARK_ITEM,
        outcome: 'applied',
        affectedStopIds: [firstStop.id],
        itemState: DeliveryRunHandoffItemStates.SKIPPED,
        reason: DeliveryRunHandoffSkipReasons.MANUAL_VERIFICATION,
    });
    const persisted = await getDeliveryRunHandoffManifest({
        readerUserId: driverUserId,
        runId: run.id,
        targetStopId: firstStop.id,
    });
    assert.equal(persisted.skippedCount, 1);
    assert.equal(persisted.missingCount, 1);
    assert.equal(persisted.noLabelCount, 0);
    assert.equal(
        persisted.items.find((item) => item.stopId === firstStop.id)?.reason,
        DeliveryRunHandoffSkipReasons.MANUAL_VERIFICATION,
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunHandoffOperations)
                .where(eq(deliveryRunHandoffOperations.runId, run.id))
        ).length,
        3,
    );
});

test('handoff access is owner-scoped, privileged reads are explicit, and zero scans do not block fulfillment', async () => {
    const { prepared, run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup({ driverCount: 3 });
    const regularReaderUserId = prepared.fixture.driverUserIds[1];
    const adminReaderUserId = prepared.fixture.driverUserIds[2];
    const [targetStop] = run.stops;
    assert.ok(regularReaderUserId);
    assert.ok(adminReaderUserId);
    assert.ok(targetStop);
    await storage()
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.id, adminReaderUserId));

    await assertExecutionError(
        getDeliveryRunHandoffManifest({
            readerUserId: regularReaderUserId,
            runId: run.id,
            targetStopId: targetStop.id,
        }),
        DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
    );
    const adminManifest = await getDeliveryRunHandoffManifest({
        readerUserId: adminReaderUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        allowAnyRun: true,
    });
    assert.equal(adminManifest.expectedCount, run.stops.length);
    assert.equal(adminManifest.unverifiedCount, run.stops.length);
    await assertExecutionError(
        applyDeliveryRunHandoffMutations({
            driverUserId: regularReaderUserId,
            runId: run.id,
            targetStopId: targetStop.id,
            expectedRetryAttempt: 0,
            mutations: [
                {
                    clientOperationId: 'handoff-wrong-owner',
                    occurredAt: new Date(),
                    kind: DeliveryRunHandoffOperationKinds.SCAN,
                    tracePath: 'not a trace QR payload',
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.ACTIVE_RUN_NOT_FOUND,
    );

    await fulfillDeliveryRunStops({
        driverUserId,
        runId: run.id,
        stopIds: run.stops.map((stop) => stop.id),
    });
    const completed = await getDeliveryRun(run.id);
    assert.equal(completed?.state, DeliveryRunStates.COMPLETED);
    assert.ok(
        completed?.stops.every(
            (stop) => stop.state === DeliveryRunStopStates.DELIVERED,
        ),
    );
    const completedAdminManifest = await getDeliveryRunHandoffManifest({
        readerUserId: adminReaderUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        allowAnyRun: true,
    });
    assert.deepEqual(completedAdminManifest, adminManifest);
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunHandoffOperations)
                .where(eq(deliveryRunHandoffOperations.runId, run.id))
        ).length,
        0,
    );
});

test('handoff receipt retention includes the 90-day boundary and deletes in bounded batches', async () => {
    const fixture = await createDeliveryRunFixture({
        accountIndexes: [0, 0],
        driverCount: 2,
    });
    const [firstDriverUserId, secondDriverUserId] = fixture.driverUserIds;
    const [firstRequestId, secondRequestId] = fixture.requestIds;
    assert.ok(firstDriverUserId);
    assert.ok(secondDriverUserId);
    assert.ok(firstRequestId);
    assert.ok(secondRequestId);
    const firstRun = await createRun({
        fixture,
        driverUserId: firstDriverUserId,
        requestIds: [firstRequestId],
    });
    const secondRun = await createRun({
        fixture,
        driverUserId: secondDriverUserId,
        requestIds: [secondRequestId],
    });
    const [firstStop] = firstRun.stops;
    const [secondStop] = secondRun.stops;
    assert.ok(firstStop);
    assert.ok(secondStop);
    const occurredAt = new Date();
    await applyDeliveryRunHandoffMutations({
        driverUserId: firstDriverUserId,
        runId: firstRun.id,
        targetStopId: firstStop.id,
        expectedRetryAttempt: 0,
        mutations: [1, 2, 3].map((index) => ({
            clientOperationId: `handoff-retention-old-${index}`,
            occurredAt,
            kind: DeliveryRunHandoffOperationKinds.SCAN,
            tracePath: `invalid handoff payload ${index}`,
        })),
    });
    await applyDeliveryRunHandoffMutations({
        driverUserId: secondDriverUserId,
        runId: secondRun.id,
        targetStopId: secondStop.id,
        expectedRetryAttempt: 0,
        mutations: [
            {
                clientOperationId: 'handoff-retention-new',
                occurredAt,
                kind: DeliveryRunHandoffOperationKinds.SCAN,
                tracePath: 'invalid handoff payload newer',
            },
        ],
    });
    await fulfillDeliveryRunStops({
        driverUserId: firstDriverUserId,
        runId: firstRun.id,
        stopIds: [firstStop.id],
    });
    await fulfillDeliveryRunStops({
        driverUserId: secondDriverUserId,
        runId: secondRun.id,
        stopIds: [secondStop.id],
    });

    const boundary = new Date();
    const retentionNow = new Date(
        boundary.getTime() + deliveryRunHandoffOperationRetentionMs,
    );
    await storage()
        .update(deliveryRuns)
        .set({ completedAt: boundary })
        .where(eq(deliveryRuns.id, firstRun.id));
    await storage()
        .update(deliveryRuns)
        .set({ completedAt: new Date(boundary.getTime() + 1) })
        .where(eq(deliveryRuns.id, secondRun.id));

    assert.equal(
        await pruneExpiredDeliveryRunHandoffOperations(retentionNow, 2),
        2,
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunHandoffOperations)
                .where(eq(deliveryRunHandoffOperations.runId, firstRun.id))
        ).length,
        1,
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunHandoffOperations)
                .where(eq(deliveryRunHandoffOperations.runId, secondRun.id))
        ).length,
        1,
    );
    assert.equal(
        await pruneExpiredDeliveryRunHandoffOperations(retentionNow, 0),
        1,
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunHandoffOperations)
                .where(eq(deliveryRunHandoffOperations.runId, firstRun.id))
        ).length,
        0,
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunHandoffOperations)
                .where(eq(deliveryRunHandoffOperations.runId, secondRun.id))
        ).length,
        1,
    );
});

test('handoff evidence follows occurrence time when offline mutations arrive out of order', async () => {
    const { prepared, run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [targetStop] = run.stops;
    const [trace] = prepared.traceLinks;
    assert.ok(targetStop);
    assert.ok(trace);
    const newerOccurredAt = new Date(Date.now() - 1_000);
    const olderOccurredAt = new Date(newerOccurredAt.getTime() - 1_000);

    const [newerMissing] = await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRetryAttempt: 0,
        mutations: [
            {
                clientOperationId: 'handoff-newer-missing',
                occurredAt: newerOccurredAt,
                kind: DeliveryRunHandoffOperationKinds.MARK_ITEM,
                stopId: targetStop.id,
                outcome: DeliveryRunHandoffItemStates.MISSING,
            },
        ],
    });
    assert.equal(newerMissing?.result.outcome, 'applied');

    const [staleScan] = await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRetryAttempt: 0,
        mutations: [
            {
                clientOperationId: 'handoff-older-offline-scan',
                occurredAt: olderOccurredAt,
                kind: DeliveryRunHandoffOperationKinds.SCAN,
                tracePath: trace.tracePath,
            },
        ],
    });
    assert.equal(staleScan?.result.outcome, 'stale');
    const afterStaleScan = await getDeliveryRunHandoffManifest({
        readerUserId: driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
    });
    const targetItem = afterStaleScan.items.find(
        ({ stopId }) => stopId === targetStop.id,
    );
    assert.equal(targetItem?.state, DeliveryRunHandoffItemStates.MISSING);
    assert.equal(targetItem?.verifiedAt, newerOccurredAt.toISOString());
});

test('handoff scan trusts the immutable picked-up trace after its public link is revoked', async () => {
    const { prepared, run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [targetStop] = run.stops;
    const [trace] = prepared.traceLinks;
    assert.ok(targetStop);
    assert.ok(trace);
    await storage()
        .update(harvestTraceLinks)
        .set({ status: 'revoked', revokedAt: new Date() })
        .where(eq(harvestTraceLinks.id, trace.id));

    const [scan] = await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRetryAttempt: 0,
        mutations: [
            {
                clientOperationId: 'handoff-revoked-frozen-trace',
                occurredAt: new Date(),
                kind: DeliveryRunHandoffOperationKinds.SCAN,
                tracePath: trace.tracePath,
            },
        ],
    });
    assert.equal(scan?.result.outcome, 'applied');
    assert.deepEqual(scan?.result.affectedStopIds, [targetStop.id]);
});

test('a late handoff mutation from the first visit cannot repopulate a retry manifest', async () => {
    const { prepared, run, driverUserId } =
        await startPreparedBulkRunWithConfirmedPickup();
    const [targetStop] = run.stops;
    const [trace] = prepared.traceLinks;
    assert.ok(targetStop);
    assert.ok(trace);

    const [firstVisitEvidence] = await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRetryAttempt: 0,
        mutations: [
            {
                clientOperationId: 'handoff-first-visit-evidence',
                occurredAt: new Date(Date.now() - 3_000),
                kind: DeliveryRunHandoffOperationKinds.MARK_ITEM,
                stopId: targetStop.id,
                outcome: DeliveryRunHandoffItemStates.SKIPPED,
                reason: DeliveryRunHandoffSkipReasons.MANUAL_VERIFICATION,
            },
        ],
    });
    assert.equal(firstVisitEvidence?.result.outcome, 'applied');
    const firstVisitStop = await storage().query.deliveryRunStops.findFirst({
        where: eq(deliveryRunStops.id, targetStop.id),
    });
    assert.equal(
        firstVisitStop?.handoffVerificationState,
        DeliveryRunHandoffItemStates.SKIPPED,
    );
    assert.equal(
        firstVisitStop?.handoffVerificationReason,
        DeliveryRunHandoffSkipReasons.MANUAL_VERIFICATION,
    );
    assert.ok(firstVisitStop?.handoffVerifiedAt instanceof Date);
    assert.equal(firstVisitStop?.handoffVerifiedByUserId, driverUserId);

    const deferred = await recordDeliveryRunStopExceptions({
        driverUserId,
        runId: run.id,
        clientOperationId: 'handoff-defer-first-visit',
        occurredAt: new Date(Date.now() - 2_000),
        exceptions: run.stops.map((stop) => ({
            stopId: stop.id,
            outcome: DeliveryRunExceptionOutcomes.DEFERRED,
            reason: DeliveryRunExceptionReasons.CUSTOMER_UNAVAILABLE,
        })),
    });
    const deferredStop = await storage().query.deliveryRunStops.findFirst({
        where: eq(deliveryRunStops.id, targetStop.id),
    });
    assert.equal(deferredStop?.retryAttempt, 1);
    assert.equal(
        deferredStop?.handoffVerificationState,
        DeliveryRunHandoffItemStates.UNVERIFIED,
    );
    assert.equal(deferredStop?.handoffVerificationReason, null);
    assert.equal(deferredStop?.handoffVerifiedAt, null);
    assert.equal(deferredStop?.handoffVerifiedByUserId, null);
    const deferredManifest = await getDeliveryRunHandoffManifest({
        readerUserId: driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
    });
    assert.equal(deferredManifest.retryAttempt, 1);
    assert.equal(deferredManifest.unverifiedCount, run.stops.length);
    assert.equal(
        deferredManifest.items.find(({ stopId }) => stopId === targetStop.id)
            ?.state,
        DeliveryRunHandoffItemStates.UNVERIFIED,
    );

    await retryDeliveryRunStop({
        driverUserId,
        runId: run.id,
        stopId: targetStop.id,
        expectedRouteRevision: deferred.result.routeRevision,
    });
    const retryManifest = await getDeliveryRunHandoffManifest({
        readerUserId: driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
    });
    assert.equal(retryManifest.retryAttempt, 1);
    assert.equal(retryManifest.unverifiedCount, run.stops.length);
    assert.deepEqual(retryManifest, deferredManifest);

    await assertExecutionError(
        applyDeliveryRunHandoffMutations({
            driverUserId,
            runId: run.id,
            targetStopId: targetStop.id,
            expectedRetryAttempt: 0,
            mutations: [
                {
                    clientOperationId: 'handoff-late-first-visit-scan',
                    occurredAt: new Date(Date.now() - 1_000),
                    kind: DeliveryRunHandoffOperationKinds.SCAN,
                    tracePath: trace.tracePath,
                },
            ],
        }),
        DeliveryRunExecutionErrorCodes.ROUTE_REVISION_CONFLICT,
    );
    assert.deepEqual(
        await getDeliveryRunHandoffManifest({
            readerUserId: driverUserId,
            runId: run.id,
            targetStopId: targetStop.id,
        }),
        retryManifest,
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(deliveryRunHandoffOperations)
                .where(eq(deliveryRunHandoffOperations.runId, run.id))
        ).length,
        1,
    );

    const [currentVisitScan] = await applyDeliveryRunHandoffMutations({
        driverUserId,
        runId: run.id,
        targetStopId: targetStop.id,
        expectedRetryAttempt: 1,
        mutations: [
            {
                clientOperationId: 'handoff-current-retry-scan',
                occurredAt: new Date(),
                kind: DeliveryRunHandoffOperationKinds.SCAN,
                tracePath: trace.tracePath,
            },
        ],
    });
    assert.equal(currentVisitScan?.result.outcome, 'applied');
    assert.equal(currentVisitScan?.retryAttempt, 1);
    const [receipt] = await storage()
        .select()
        .from(deliveryRunHandoffOperations)
        .where(
            and(
                eq(deliveryRunHandoffOperations.runId, run.id),
                eq(
                    deliveryRunHandoffOperations.clientOperationId,
                    'handoff-current-retry-scan',
                ),
            ),
        );
    assert.equal(receipt?.retryAttempt, 1);
});
