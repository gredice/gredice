import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountCanTrackDeliveryRun,
    cancelDeliveryRequest,
    changeDeliveryRequestSlot,
    createDeliveryAddress,
    createDeliveryRun,
    createEvent,
    deliveryRequests,
    fulfillDeliveryRunStop,
    fulfillDeliveryRunStops,
    getDeliveryRequest,
    getDeliveryRun,
    knownEvents,
    markDeliveryRunStopArrived,
    markDeliveryRunStopsArrived,
    operations,
    pickupLocations,
    storage,
    timeSlots,
    updateDeliveryAddress,
    updateDeliveryRunLocation,
    users,
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

type DeliveryRunFixture = Awaited<ReturnType<typeof createDeliveryRunFixture>>;

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
