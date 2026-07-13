import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountCanTrackDeliveryRun,
    createDeliveryRun,
    deliveryRequests,
    fulfillDeliveryRunStop,
    getDeliveryRequest,
    getDeliveryRun,
    markDeliveryRunStopArrived,
    operations,
    pickupLocations,
    storage,
    timeSlots,
    updateDeliveryRunLocation,
    users,
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('delivery run enforces stop order and limits tracking to the current delivery', async () => {
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
                accountId: otherAccountId,
            },
        ])
        .returning({ id: operations.id });
    assert.equal(operationRows.length, 2);
    const requestIds = [randomUUID(), randomUUID()];
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
            latitude: 45.8 + index * 0.01,
            longitude: 15.97 + index * 0.01,
            formattedAddress: `Testna ${index + 1}, Zagreb, HR`,
            estimatedArrivalAt: new Date(
                Date.parse('2026-07-13T08:15:00.000Z') + index * 900_000,
            ),
            estimatedTravelSeconds: 600,
            estimatedDistanceMeters: 2_250,
        })),
    });
    assert.equal(run.stops.length, 2);
    const [firstStop, secondStop] = run.stops;
    assert.ok(firstStop);
    assert.ok(secondStop);

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
            stopId: secondStop.id,
        }),
        /route order/,
    );
    await assert.rejects(
        fulfillDeliveryRunStop({
            driverUserId,
            runId: run.id,
            stopId: secondStop.id,
        }),
        /route order/,
    );
    assert.notEqual(
        (await getDeliveryRequest(secondStop.deliveryRequestId))?.state,
        'fulfilled',
    );

    await updateDeliveryRunLocation({
        runId: run.id,
        driverUserId,
        latitude: 45.801,
        longitude: 15.971,
        recordedAt: new Date('2026-07-13T08:05:00.000Z'),
    });
    await fulfillDeliveryRunStop({
        driverUserId,
        runId: run.id,
        stopId: firstStop.id,
    });
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
        stopId: secondStop.id,
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
