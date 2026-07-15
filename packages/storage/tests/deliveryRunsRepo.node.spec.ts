import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountCanTrackDeliveryRun,
    type CreatePreparedDeliveryRunInput,
    cancelDeliveryRequest,
    changeDeliveryRequestSlot,
    consumeDeliveryRunPreparation,
    createDeliveryAddress,
    createDeliveryRun,
    createEvent,
    DeliveryRunPersistenceError,
    DeliveryRunPersistenceErrorCodes,
    type DeliveryRunPreparationPlanPayloadV1,
    type DeliveryRunPreparationPlanPayloadV2,
    type DeliveryRunRequestSnapshotInput,
    deliveryRequests,
    deliveryRunPickupNodes,
    deliveryRunPreparations,
    deliveryRunStops,
    deliveryRuns,
    fulfillDeliveryRunStop,
    fulfillDeliveryRunStops,
    getDeliveryDispatchRevision,
    getDeliveryRequest,
    getDeliveryRequestDispatchSnapshots,
    getDeliveryRun,
    getDeliveryRunStopsForRequestIds,
    knownEvents,
    markDeliveryRunStopArrived,
    markDeliveryRunStopsArrived,
    operations,
    pickupLocations,
    saveDeliveryRunPreparation,
    storage,
    timeSlots,
    updateDeliveryAddress,
    updateDeliveryRunLocation,
    updatePickupLocation,
    updateTimeSlot,
    users,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

type DeliveryRunFixture = Awaited<ReturnType<typeof createDeliveryRunFixture>>;
let nextSupplementalOperationEntityId = 10_000;

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
        const operationId = fixture.operationIds[index];
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
    };

    return {
        fixture,
        addressIds,
        createRunInput,
        requestSnapshots,
        selectionRequestIds: [...fixture.requestIds],
        dispatchRevision: await getDeliveryDispatchRevision(),
    };
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

async function assertPersistenceError(promise: Promise<unknown>, code: string) {
    await assert.rejects(
        promise,
        (error) =>
            error instanceof DeliveryRunPersistenceError && error.code === code,
    );
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

test('an older GPS sample is rejected without overwriting the latest telemetry', async () => {
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
    await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.812,
        longitude: 15.982,
        accuracy: 5,
        heading: 135,
        speed: 9.25,
        recordedAt: latestRecordedAt,
    });

    await assert.rejects(
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
        /Active delivery run not found/,
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

test('[legacy] active run keeps snapshots while the source address and slot mutate', async () => {
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

    await updateDeliveryAddress(
        { id: addressId, street1: 'Nova 2' },
        accountId,
    );
    await changeDeliveryRequestSlot(requestId, newSlot.id);

    const changedRequest = await getDeliveryRequest(requestId);
    const unchangedRun = await getDeliveryRun(run.id);
    assert.equal(changedRequest?.address?.street1, 'Nova 2');
    assert.equal(changedRequest?.slot?.id, newSlot.id);
    assert.equal(unchangedRun?.timeSlotId, fixture.timeSlotId);
    assert.equal(unchangedRun?.stops[0]?.formattedAddress, snapshotAddress);
});

test('[legacy] bulk fulfillment accepts a non-contiguous set containing the current stop', async () => {
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
        stopIds: [firstStop.id, thirdStop.id],
    });

    const skippedRun = await getDeliveryRun(run.id);
    assert.equal(skippedRun?.state, 'active');
    assert.deepEqual(
        skippedRun?.stops.map((stop) => stop.state),
        ['delivered', 'pending', 'delivered'],
    );
    assert.notEqual(
        (await getDeliveryRequest(secondStop.deliveryRequestId))?.state,
        'fulfilled',
    );

    await fulfillDeliveryRunStop({
        driverUserId,
        runId: run.id,
        stopId: secondStop.id,
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
    assert.equal(savedPreparation?.plan.formatVersion, 2);

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
    await updateDeliveryAddress(
        { id: firstAddressId, street1: 'Promijenjena 99' },
        prepared.fixture.accountIds[0] ?? '',
    );
    await updatePickupLocation({
        id: firstNode.pickupLocationId,
        name: 'Promijenjeno skladište',
    });
    await updateTimeSlot({
        id: firstRunSlot.timeSlotId,
        endAt: new Date('2026-07-13T10:30:00.000Z'),
    });

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

test('persisted v2 itinerary tampering is rejected before run creation', async () => {
    const prepared = await createPreparedRunFixture();
    const driverUserId = prepared.fixture.driverUserIds[0];
    assert.ok(driverUserId);
    const saved = await saveDeliveryRunPreparation(prepared);
    const preparation = await storage().query.deliveryRunPreparations.findFirst(
        {
            where: eq(deliveryRunPreparations.id, saved.preparationId),
        },
    );
    assert.equal(preparation?.plan.formatVersion, 2);
    if (preparation?.plan.formatVersion !== 2) {
        assert.fail('Expected a v2 delivery run preparation');
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
    if (preparation?.plan.formatVersion !== 2) {
        assert.fail('Expected a v2 delivery run preparation');
    }
    await storage()
        .update(deliveryRunPreparations)
        .set({ plan: asLegacyPreparationPlan(preparation.plan) })
        .where(eq(deliveryRunPreparations.id, saved.preparationId));

    const run = await consumeDeliveryRunPreparation({
        preparationToken: saved.preparationToken,
        driverUserId,
        deliveryRequestIds: prepared.fixture.requestIds,
    });
    assert.equal(run.routePlanVersion, 1);
    assert.equal(run.estimateSource, 'legacy');
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
