import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountCanTrackDeliveryRun,
    createDeliveryRun,
    deliveryRequests,
    fulfillDeliveryRunStop,
    fulfillDeliveryRunStops,
    getDeliveryRequest,
    getDeliveryRun,
    markDeliveryRunStopArrived,
    markDeliveryRunStopsArrived,
    operations,
    pickupLocations,
    storage,
    timeSlots,
    updateDeliveryRunLocation,
    users,
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('delivery run fulfills a current bulk stop atomically and preserves route order', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    const otherAccountId = await createTestAccount();
    const driverUserId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: driverUserId,
            userName: `driver-${driverUserId}@example.test`,
            displayName: 'Test Driver',
            role: 'driver',
        });
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
        .values([
            {
                entityId: 1,
                entityTypeName: 'operation',
                accountId,
            },
            {
                entityId: 2,
                entityTypeName: 'operation',
                accountId,
            },
            {
                entityId: 3,
                entityTypeName: 'operation',
                accountId: otherAccountId,
            },
        ])
        .returning({ id: operations.id });
    assert.equal(operationRows.length, 3);
    const requestIds = [randomUUID(), randomUUID(), randomUUID()];
    await storage()
        .insert(deliveryRequests)
        .values(
            operationRows.map((operation, index) => ({
                id: requestIds[index] ?? randomUUID(),
                operationId: operation.id,
            })),
        );

    const run = await createDeliveryRun({
        driverUserId,
        timeSlotId: slot.id,
        totalDistanceMeters: 4_500,
        totalDurationSeconds: 1_200,
        stops: requestIds.map((deliveryRequestId, index) => ({
            deliveryRequestId,
            sequence: index + 1,
            latitude: index < 2 ? 45.8 : 45.81,
            longitude: index < 2 ? 15.97 : 15.98,
            formattedAddress: `Testna ${index < 2 ? 1 : 2}, Zagreb, HR`,
            estimatedArrivalAt: new Date(
                Date.parse('2026-07-13T08:15:00.000Z') +
                    (index < 2 ? 0 : 900_000),
            ),
            estimatedTravelSeconds: 600,
            estimatedDistanceMeters: 2_250,
        })),
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
    assert.equal(completedRun?.currentLatitude, null);
    assert.equal(completedRun?.currentLongitude, null);
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
});
