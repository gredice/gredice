import assert from 'node:assert/strict';
import test from 'node:test';
import { DeliveryRunPersistenceError } from '@gredice/storage';
import type {
    PlannedDeliveryPickupNode,
    PlannedPickupAwareDeliveryStop,
} from './deliveryPickupRouting';
import {
    DeliveryRoutePlanningError,
    maximumDeliveryRouteStops,
} from './deliveryRouting';
import {
    type DeliveryRunPlanningDependencies,
    type DeliveryRunPlanningRequest,
    DeliveryRunPreparationError,
    deliveryRunPersistencePreparationError,
    prepareDeliveryRun,
    revalidatePreparedDeliveryRun,
} from './deliveryRunPlanning';

const now = new Date('2026-07-15T07:00:00.000Z');

type CallCounters = {
    activeRunReads: number;
    requestReads: number;
    assignmentReads: number;
    plannerCalls: number;
    mutationCalls: number;
};

function request({
    id,
    routeRevision = 1,
    state = 'ready',
    slotId = 1,
    locationId = 10,
    locationName = 'HQ Zagreb',
    slotStartAt = '2026-07-15T08:00:00.000Z',
    slotEndAt = '2026-07-15T10:00:00.000Z',
    addressId = 100,
    street1 = 'Ilica 1',
    withAddress = true,
    withSlot = true,
}: {
    id: string;
    routeRevision?: number;
    state?: string;
    slotId?: number;
    locationId?: number;
    locationName?: string;
    slotStartAt?: string;
    slotEndAt?: string;
    addressId?: number;
    street1?: string;
    withAddress?: boolean;
    withSlot?: boolean;
}): DeliveryRunPlanningRequest {
    return {
        id,
        routeRevision,
        mode: 'delivery',
        state,
        address: withAddress
            ? {
                  id: addressId,
                  updatedAt: new Date('2026-07-14T08:00:00.000Z'),
                  contactName: 'Primatelj',
                  phone: '+385 91 111 1111',
                  label: 'Dom',
                  street1,
                  postalCode: '10000',
                  city: 'Zagreb',
                  countryCode: 'HR',
              }
            : undefined,
        slot: withSlot
            ? {
                  id: slotId,
                  locationId,
                  updatedAt: new Date('2026-07-14T07:00:00.000Z'),
                  startAt: new Date(slotStartAt),
                  endAt: new Date(slotEndAt),
                  location: {
                      id: locationId,
                      updatedAt: new Date('2026-07-14T06:00:00.000Z'),
                      name: locationName,
                      street1: `Lokacija ${locationId}`,
                      postalCode: '10000',
                      city: 'Zagreb',
                      countryCode: 'HR',
                  },
              }
            : undefined,
    };
}

function planningDependencies({
    requests,
    activeRunId,
    assignedRequestId,
    planRoute,
}: {
    requests: DeliveryRunPlanningRequest[];
    activeRunId?: string;
    assignedRequestId?: string;
    planRoute?: DeliveryRunPlanningDependencies['planRoute'];
}) {
    const counters: CallCounters = {
        activeRunReads: 0,
        requestReads: 0,
        assignmentReads: 0,
        plannerCalls: 0,
        mutationCalls: 0,
    };
    const dependencies: DeliveryRunPlanningDependencies = {
        getActiveRunForDriver: async () => {
            counters.activeRunReads += 1;
            return activeRunId ? { id: activeRunId } : undefined;
        },
        getRequests: async () => {
            counters.requestReads += 1;
            return requests;
        },
        getDispatchRevision: async () =>
            Math.max(0, ...requests.map(({ routeRevision }) => routeRevision)),
        getAssignedStops: async () => {
            counters.assignmentReads += 1;
            return assignedRequestId
                ? [{ stop: { deliveryRequestId: assignedRequestId } }]
                : [];
        },
        planRoute: async (input) => {
            counters.plannerCalls += 1;
            if (planRoute) return await planRoute(input);

            const pickupNodes = input.pickupCandidates.map(
                (candidate, index): PlannedDeliveryPickupNode => ({
                    ...candidate,
                    kind: 'pickup',
                    latitude: 45.8 + index / 100,
                    longitude: 15.96 + index / 100,
                    sequence: index + 1,
                    itinerarySequence: index + 1,
                    estimatedArrivalAt: new Date(
                        now.getTime() + index * 600_000,
                    ),
                    incomingTravelSeconds: index === 0 ? 0 : 600,
                    incomingDistanceMeters: index === 0 ? 0 : 1_000,
                    estimatedTravelSeconds: index === 0 ? 0 : 600,
                    estimatedDistanceMeters: index === 0 ? 0 : 1_000,
                    serviceDurationSeconds: 600,
                }),
            );
            const stops = input.candidates.map(
                (candidate, index): PlannedPickupAwareDeliveryStop => ({
                    ...candidate,
                    kind: 'customer',
                    latitude: 45.81 + index / 100,
                    longitude: 15.97 + index / 100,
                    sequence: index + 1,
                    itinerarySequence: pickupNodes.length + index + 1,
                    estimatedArrivalAt: new Date(
                        now.getTime() + (index + 1) * 600_000,
                    ),
                    estimatedTravelSeconds: 600,
                    estimatedDistanceMeters: 1_000,
                    serviceDurationSeconds: 300,
                }),
            );
            return {
                routePlanVersion: 2,
                estimateSource: 'google',
                encodedPolyline: 'prepared-polyline',
                totalDistanceMeters: input.candidates.length * 1_000,
                totalDurationSeconds: input.candidates.length * 600,
                totalTravelSeconds: input.candidates.length * 600,
                totalWaitingSeconds: 0,
                totalServiceSeconds:
                    pickupNodes.length * 600 + stops.length * 300,
                pickupNodes,
                stops,
                itinerary: [...pickupNodes, ...stops],
            };
        },
        now: () => now,
    };

    return { dependencies, counters };
}

async function preparationError(
    promise: Promise<unknown>,
): Promise<DeliveryRunPreparationError> {
    try {
        await promise;
    } catch (error) {
        assert.ok(error instanceof DeliveryRunPreparationError);
        return error;
    }
    assert.fail('Expected delivery run preparation to fail');
}

test('prepares a valid single-location run and expands every ready delivery at a bulk stop', async () => {
    const requests = [
        request({ id: 'bulk-one', addressId: 100 }),
        request({ id: 'bulk-two', addressId: 100 }),
        request({
            id: 'later-stop',
            slotId: 2,
            slotStartAt: '2026-07-15T10:00:00.000Z',
            slotEndAt: '2026-07-15T12:00:00.000Z',
            addressId: 200,
            street1: 'Vukovarska 2',
        }),
    ];
    const { dependencies, counters } = planningDependencies({ requests });

    const prepared = await prepareDeliveryRun(
        {
            driverUserId: 'driver-one',
            deliveryRequestIds: ['bulk-one', 'later-stop'],
        },
        dependencies,
    );

    assert.equal(prepared.summary.deliveryCount, 3);
    assert.equal(prepared.dispatchRevision, 1);
    assert.deepEqual(prepared.selectionRequestIds, ['bulk-one', 'later-stop']);
    assert.equal(prepared.summary.stopCount, 2);
    assert.equal(prepared.summary.slotCount, 2);
    assert.deepEqual(
        prepared.summary.pickupLocations.map((location) => location.id),
        [10],
    );
    assert.equal(prepared.createRunInput.timeSlotId, 1);
    assert.equal(prepared.createRunInput.routePlanVersion, 2);
    assert.equal(prepared.createRunInput.estimateSource, 'google');
    assert.equal(prepared.createRunInput.totalDistanceMeters, 2_000);
    assert.deepEqual(
        prepared.createRunInput.pickupNodes?.map((node) => ({
            pickupLocationId: node.pickupLocationId,
            sequence: node.sequence,
            name: node.name,
            street1: node.street1,
            sourceUpdatedAt: node.sourceUpdatedAt.toISOString(),
        })),
        [
            {
                pickupLocationId: 10,
                sequence: 1,
                name: 'HQ Zagreb',
                street1: 'Lokacija 10',
                sourceUpdatedAt: '2026-07-14T06:00:00.000Z',
            },
        ],
    );
    assert.deepEqual(
        prepared.createRunInput.runSlots?.map((slot) => ({
            timeSlotId: slot.timeSlotId,
            pickupLocationId: slot.pickupLocationId,
            sequence: slot.sequence,
            windowStartAt: slot.windowStartAt.toISOString(),
            windowEndAt: slot.windowEndAt.toISOString(),
        })),
        [
            {
                timeSlotId: 1,
                pickupLocationId: 10,
                sequence: 1,
                windowStartAt: '2026-07-15T08:00:00.000Z',
                windowEndAt: '2026-07-15T10:00:00.000Z',
            },
            {
                timeSlotId: 2,
                pickupLocationId: 10,
                sequence: 2,
                windowStartAt: '2026-07-15T10:00:00.000Z',
                windowEndAt: '2026-07-15T12:00:00.000Z',
            },
        ],
    );
    assert.deepEqual(
        prepared.createRunInput.stops.map((stop) => stop.deliveryRequestId),
        ['bulk-one', 'bulk-two', 'later-stop'],
    );
    assert.deepEqual(
        prepared.createRunInput.stops.map((stop) => stop.sequence),
        [1, 2, 3],
    );
    assert.deepEqual(
        prepared.createRunInput.stops.map((stop) => stop.itinerarySequence),
        [2, 2, 3],
    );
    assert.deepEqual(
        prepared.createRunInput.stops.map(
            (stop) => stop.serviceDurationSeconds,
        ),
        [300, 300, 300],
    );
    assert.deepEqual(
        prepared.createRunInput.pickupNodes.map((node) => ({
            itinerarySequence: node.itinerarySequence,
            incomingTravelSeconds: node.incomingTravelSeconds,
            incomingDistanceMeters: node.incomingDistanceMeters,
            serviceDurationSeconds: node.serviceDurationSeconds,
        })),
        [
            {
                itinerarySequence: 1,
                incomingTravelSeconds: 0,
                incomingDistanceMeters: 0,
                serviceDurationSeconds: 600,
            },
        ],
    );
    assert.deepEqual(
        prepared.createRunInput.stops.map((stop) => stop.timeSlotId),
        [1, 1, 2],
    );
    assert.equal(
        prepared.createRunInput.stops[0]?.stopKey,
        prepared.createRunInput.stops[1]?.stopKey,
    );
    assert.notEqual(
        prepared.createRunInput.stops[1]?.stopKey,
        prepared.createRunInput.stops[2]?.stopKey,
    );
    assert.deepEqual(
        prepared.requestSnapshots.map((snapshot) => snapshot.deliveryRequestId),
        ['bulk-one', 'bulk-two', 'later-stop'],
    );
    assert.deepEqual(
        prepared.requestSnapshots.map((snapshot) => ({
            requestDispatchEventId: snapshot.requestDispatchEventId,
            addressId: snapshot.address.id,
            addressUpdatedAt: snapshot.address.updatedAt.toISOString(),
            slotId: snapshot.slot.id,
            pickupLocationId: snapshot.pickupLocation.id,
        })),
        [
            {
                requestDispatchEventId: 1,
                addressId: 100,
                addressUpdatedAt: '2026-07-14T08:00:00.000Z',
                slotId: 1,
                pickupLocationId: 10,
            },
            {
                requestDispatchEventId: 1,
                addressId: 100,
                addressUpdatedAt: '2026-07-14T08:00:00.000Z',
                slotId: 1,
                pickupLocationId: 10,
            },
            {
                requestDispatchEventId: 1,
                addressId: 200,
                addressUpdatedAt: '2026-07-14T08:00:00.000Z',
                slotId: 2,
                pickupLocationId: 10,
            },
        ],
    );
    assert.deepEqual(counters, {
        activeRunReads: 1,
        requestReads: 1,
        assignmentReads: 1,
        plannerCalls: 1,
        mutationCalls: 0,
    });
});

test('maps persistence conflicts without exposing token ownership', () => {
    const privateError = deliveryRunPersistencePreparationError(
        new DeliveryRunPersistenceError(
            'preparation-owner-mismatch',
            'private storage detail',
        ),
    );
    assert.ok(privateError);
    assert.equal(privateError.code, 'preparation-not-found');
    assert.doesNotMatch(privateError.message, /owner|driver|private/i);

    const changedError = deliveryRunPersistencePreparationError(
        new DeliveryRunPersistenceError(
            'delivery-source-changed',
            'private storage detail',
            { deliveryRequestId: 'request-one' },
        ),
    );
    assert.equal(changedError?.code, 'delivery-source-changed');
    assert.equal(changedError?.conflict.deliveryRequestId, 'request-one');
});

test('revalidates an unchanged preparation immediately before persistence', async () => {
    const requests = [request({ id: 'selected' })];
    const { dependencies, counters } = planningDependencies({ requests });
    const prepared = await prepareDeliveryRun(
        {
            driverUserId: 'driver-one',
            deliveryRequestIds: ['selected'],
        },
        dependencies,
    );

    await revalidatePreparedDeliveryRun(prepared, dependencies);

    assert.deepEqual(counters, {
        activeRunReads: 2,
        requestReads: 2,
        assignmentReads: 2,
        plannerCalls: 1,
        mutationCalls: 0,
    });
});

test('revalidation rejects a request that changed while its route was planned', async () => {
    const selected = request({ id: 'selected' });
    const requests = [selected];
    const { dependencies, counters } = planningDependencies({ requests });
    const prepared = await prepareDeliveryRun(
        {
            driverUserId: 'driver-one',
            deliveryRequestIds: ['selected'],
        },
        dependencies,
    );
    selected.state = 'cancelled';

    const error = await preparationError(
        revalidatePreparedDeliveryRun(prepared, dependencies),
    );

    assert.equal(error.code, 'delivery-selection-changed');
    assert.equal(error.conflict.deliveryRequestId, 'selected');
    assert.equal(counters.plannerCalls, 1);
    assert.equal(counters.mutationCalls, 0);
});

test('revalidation rejects a newly ready member of a prepared bulk stop', async () => {
    const requests = [request({ id: 'bulk-one' })];
    const { dependencies, counters } = planningDependencies({ requests });
    const prepared = await prepareDeliveryRun(
        {
            driverUserId: 'driver-one',
            deliveryRequestIds: ['bulk-one'],
        },
        dependencies,
    );
    requests.push(request({ id: 'bulk-two' }));

    const error = await preparationError(
        revalidatePreparedDeliveryRun(prepared, dependencies),
    );

    assert.equal(error.code, 'delivery-bulk-selection-changed');
    assert.equal(error.conflict.deliveryRequestId, 'bulk-two');
    assert.equal(counters.plannerCalls, 1);
    assert.equal(counters.mutationCalls, 0);
});

test('rejects an active driver before reading or planning a new selection', async () => {
    const { dependencies, counters } = planningDependencies({
        requests: [request({ id: 'selected' })],
        activeRunId: 'active-run',
    });

    const error = await preparationError(
        prepareDeliveryRun(
            {
                driverUserId: 'driver-one',
                deliveryRequestIds: ['selected'],
            },
            dependencies,
        ),
    );

    assert.equal(error.code, 'active-run-exists');
    assert.equal(error.conflict.activeRunId, 'active-run');
    assert.deepEqual(counters, {
        activeRunReads: 1,
        requestReads: 0,
        assignmentReads: 0,
        plannerCalls: 0,
        mutationCalls: 0,
    });
});

test('rejects unavailable selections before assignment checks or route planning', async (context) => {
    const cases = [
        {
            name: 'not ready',
            selected: request({ id: 'selected', state: 'preparing' }),
        },
        {
            name: 'missing address',
            selected: request({ id: 'selected', withAddress: false }),
        },
        {
            name: 'missing slot',
            selected: request({ id: 'selected', withSlot: false }),
        },
        {
            name: 'expired slot',
            selected: request({
                id: 'selected',
                slotStartAt: '2026-07-15T04:00:00.000Z',
                slotEndAt: '2026-07-15T06:00:00.000Z',
            }),
        },
    ];

    for (const testCase of cases) {
        await context.test(testCase.name, async () => {
            const { dependencies, counters } = planningDependencies({
                requests: [testCase.selected],
            });
            const error = await preparationError(
                prepareDeliveryRun(
                    {
                        driverUserId: 'driver-one',
                        deliveryRequestIds: ['selected'],
                    },
                    dependencies,
                ),
            );

            assert.equal(error.code, 'delivery-not-ready');
            assert.equal(error.conflict.deliveryRequestId, 'selected');
            assert.equal(counters.assignmentReads, 0);
            assert.equal(counters.plannerCalls, 0);
            assert.equal(counters.mutationCalls, 0);
        });
    }
});

test('rejects mixed pickup locations through the shared policy before the planner', async () => {
    const requests = [
        request({ id: 'hq', locationId: 10, locationName: 'HQ Zagreb' }),
        request({
            id: 'east',
            slotId: 2,
            locationId: 20,
            locationName: 'Istočno skladište',
            addressId: 200,
            street1: 'Vukovarska 2',
        }),
    ];
    const { dependencies, counters } = planningDependencies({ requests });

    const error = await preparationError(
        prepareDeliveryRun(
            {
                driverUserId: 'driver-one',
                deliveryRequestIds: ['hq', 'east'],
            },
            dependencies,
        ),
    );

    assert.equal(error.code, 'mixed-pickup-locations');
    assert.equal(error.conflict.deliveryRequestId, 'east');
    assert.deepEqual(error.conflict.selection?.conflictingRequestIds, ['east']);
    assert.deepEqual(
        error.conflict.selection?.pickupLocations.map(
            (location) => location.id,
        ),
        [10, 20],
    );
    assert.equal(counters.assignmentReads, 0);
    assert.equal(counters.plannerCalls, 0);
    assert.equal(counters.mutationCalls, 0);
});

test('rejects selections whose combined window exceeds the shared route span', async () => {
    const requests = [
        request({ id: 'today' }),
        request({
            id: 'tomorrow',
            slotId: 2,
            slotStartAt: '2026-07-16T09:00:01.000Z',
            slotEndAt: '2026-07-16T11:00:01.000Z',
            addressId: 200,
            street1: 'Vukovarska 2',
        }),
    ];
    const { dependencies, counters } = planningDependencies({ requests });

    const error = await preparationError(
        prepareDeliveryRun(
            {
                driverUserId: 'driver-one',
                deliveryRequestIds: ['today', 'tomorrow'],
            },
            dependencies,
        ),
    );

    assert.equal(error.code, 'route-window-span-exceeded');
    assert.equal(error.conflict.deliveryRequestId, 'tomorrow');
    assert.equal(counters.assignmentReads, 0);
    assert.equal(counters.plannerCalls, 0);
    assert.equal(counters.mutationCalls, 0);
});

test('rejects a selection beyond the shared physical-stop limit before the planner', async () => {
    const requests = Array.from(
        { length: maximumDeliveryRouteStops + 1 },
        (_value, index) =>
            request({
                id: `request-${index}`,
                addressId: 100 + index,
                street1: `Adresa ${index}`,
            }),
    );
    const { dependencies, counters } = planningDependencies({ requests });

    const error = await preparationError(
        prepareDeliveryRun(
            {
                driverUserId: 'driver-one',
                deliveryRequestIds: requests.map((item) => item.id),
            },
            dependencies,
        ),
    );

    assert.equal(error.code, 'route-stop-limit-exceeded');
    assert.equal(
        error.conflict.deliveryRequestId,
        `request-${maximumDeliveryRouteStops}`,
    );
    assert.equal(
        error.conflict.selection?.separateRouteRequestIds.length,
        maximumDeliveryRouteStops,
    );
    assert.equal(counters.assignmentReads, 0);
    assert.equal(counters.plannerCalls, 0);
    assert.equal(counters.mutationCalls, 0);
});

test('rejects an assigned bulk member before route planning', async () => {
    const requests = [request({ id: 'bulk-one' }), request({ id: 'bulk-two' })];
    const { dependencies, counters } = planningDependencies({
        requests,
        assignedRequestId: 'bulk-two',
    });

    const error = await preparationError(
        prepareDeliveryRun(
            {
                driverUserId: 'driver-one',
                deliveryRequestIds: ['bulk-one'],
            },
            dependencies,
        ),
    );

    assert.equal(error.code, 'delivery-already-assigned');
    assert.equal(error.conflict.deliveryRequestId, 'bulk-two');
    assert.equal(counters.plannerCalls, 0);
    assert.equal(counters.mutationCalls, 0);
});

test('enriches a route-planning conflict with its selected address, slot, and pickup location', async () => {
    const selected = request({ id: 'unmapped-address' });
    const { dependencies, counters } = planningDependencies({
        requests: [selected],
        planRoute: async () => {
            throw new DeliveryRoutePlanningError(
                'Adresu dostave nije moguće pronaći.',
                'delivery-address-not-found',
                'unmapped-address',
            );
        },
    });

    const error = await preparationError(
        prepareDeliveryRun(
            {
                driverUserId: 'driver-one',
                deliveryRequestIds: ['unmapped-address'],
            },
            dependencies,
        ),
    );

    assert.equal(error.code, 'delivery-address-not-found');
    assert.equal(error.conflict.deliveryRequestId, 'unmapped-address');
    assert.equal(error.conflict.deliveryAddress, 'Ilica 1, 10000 Zagreb, HR');
    assert.equal(error.conflict.slot?.id, 1);
    assert.equal(error.conflict.pickupLocation?.id, 10);
    assert.equal(counters.plannerCalls, 1);
    assert.equal(counters.mutationCalls, 0);
});
