import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type DeliveryRouteGraphCustomerNode,
    type DeliveryRouteGraphLeg,
    type DeliveryRouteGraphNode,
    type DeliveryRouteGraphPickupNode,
    DeliveryRouteGraphPlanningError,
    deliveryNodeServiceSeconds,
    pickupNodeServiceSeconds,
    solveDeliveryRouteGraph,
} from './deliveryRouteGraph';

const departureAt = new Date('2026-07-15T08:00:00.000Z');

function pickup(
    key: string,
    overrides: Partial<Omit<DeliveryRouteGraphPickupNode, 'kind' | 'key'>> = {},
): DeliveryRouteGraphPickupNode {
    return {
        kind: 'pickup',
        key,
        latitude: 45.8,
        longitude: 15.9,
        serviceSeconds: pickupNodeServiceSeconds,
        ...overrides,
    };
}

function customer(
    key: string,
    requiredPickupKey: string,
    overrides: Partial<
        Omit<
            DeliveryRouteGraphCustomerNode,
            'kind' | 'key' | 'requiredPickupKey'
        >
    > = {},
): DeliveryRouteGraphCustomerNode {
    return {
        kind: 'customer',
        key,
        requiredPickupKey,
        latitude: 45.81,
        longitude: 15.91,
        serviceSeconds: deliveryNodeServiceSeconds,
        ...overrides,
    };
}

function completeLegs(
    nodes: readonly DeliveryRouteGraphNode[],
    travelSeconds = 60,
    distanceMeters = 1_000,
) {
    return nodes.flatMap((from) =>
        nodes
            .filter((to) => to.key !== from.key)
            .map(
                (to): DeliveryRouteGraphLeg => ({
                    fromKey: from.key,
                    toKey: to.key,
                    travelSeconds,
                    distanceMeters,
                }),
            ),
    );
}

function planningError(run: () => unknown) {
    try {
        run();
    } catch (error) {
        assert.ok(error instanceof DeliveryRouteGraphPlanningError);
        return error;
    }
    assert.fail('Expected route graph planning to fail');
}

test('plans one pickup and includes service at the final delivery', () => {
    const origin = pickup('pickup:hq');
    const delivery = customer('customer:one', origin.key, {
        deliveryRequestId: 'request-one',
    });

    const plan = solveDeliveryRouteGraph({
        nodes: [delivery, origin],
        originKey: origin.key,
        departureAt,
        legs: [
            {
                fromKey: origin.key,
                toKey: delivery.key,
                travelSeconds: 120,
                distanceMeters: 1_000,
            },
        ],
    });

    assert.deepEqual(
        plan.visits.map(({ node }) => node.key),
        ['pickup:hq', 'customer:one'],
    );
    assert.deepEqual(
        plan.visits.map((visit) => ({
            sequence: visit.sequence,
            incomingTravelSeconds: visit.incomingTravelSeconds,
            incomingDistanceMeters: visit.incomingDistanceMeters,
            arrivalAt: visit.arrivalAt.toISOString(),
            serviceCompletedAt: visit.serviceCompletedAt.toISOString(),
        })),
        [
            {
                sequence: 1,
                incomingTravelSeconds: 0,
                incomingDistanceMeters: 0,
                arrivalAt: '2026-07-15T08:00:00.000Z',
                serviceCompletedAt: '2026-07-15T08:10:00.000Z',
            },
            {
                sequence: 2,
                incomingTravelSeconds: 120,
                incomingDistanceMeters: 1_000,
                arrivalAt: '2026-07-15T08:12:00.000Z',
                serviceCompletedAt: '2026-07-15T08:17:00.000Z',
            },
        ],
    );
    assert.equal(plan.completedAt.toISOString(), '2026-07-15T08:17:00.000Z');
    assert.equal(plan.totalDistanceMeters, 1_000);
    assert.equal(plan.totalTravelSeconds, 120);
    assert.equal(plan.totalServiceSeconds, 900);
    assert.equal(plan.totalDurationSeconds, 1_020);
});

test('interleaves two pickups when an early customer window requires it', () => {
    const firstPickup = pickup('pickup:a');
    const secondPickup = pickup('pickup:b');
    const firstCustomer = customer('customer:a', firstPickup.key, {
        windowEndAt: new Date('2026-07-15T08:12:00.000Z'),
    });
    const secondCustomer = customer('customer:b', secondPickup.key);
    const nodes = [secondCustomer, secondPickup, firstCustomer, firstPickup];

    const plan = solveDeliveryRouteGraph({
        nodes,
        originKey: firstPickup.key,
        departureAt,
        legs: completeLegs(nodes),
    });

    assert.deepEqual(
        plan.visits.map(({ node }) => node.key),
        ['pickup:a', 'customer:a', 'pickup:b', 'customer:b'],
    );
});

test('never visits a customer before its required pickup', () => {
    const origin = pickup('pickup:a');
    const requiredPickup = pickup('pickup:b');
    const delivery = customer('customer:b', requiredPickup.key);

    const plan = solveDeliveryRouteGraph({
        nodes: [delivery, origin, requiredPickup],
        originKey: origin.key,
        departureAt,
        legs: [
            {
                fromKey: origin.key,
                toKey: delivery.key,
                travelSeconds: 1,
                distanceMeters: 1,
            },
            {
                fromKey: origin.key,
                toKey: requiredPickup.key,
                travelSeconds: 100,
                distanceMeters: 100,
            },
            {
                fromKey: requiredPickup.key,
                toKey: delivery.key,
                travelSeconds: 1,
                distanceMeters: 1,
            },
        ],
    });

    assert.deepEqual(
        plan.visits.map(({ node }) => node.key),
        ['pickup:a', 'pickup:b', 'customer:b'],
    );
});

test('waits for a window and counts service at the final node', () => {
    const origin = pickup('pickup:hq');
    const delivery = customer('customer:later', origin.key, {
        windowStartAt: new Date('2026-07-15T08:30:00.000Z'),
    });

    const plan = solveDeliveryRouteGraph({
        nodes: [origin, delivery],
        originKey: origin.key,
        departureAt,
        legs: [
            {
                fromKey: origin.key,
                toKey: delivery.key,
                travelSeconds: 60,
                distanceMeters: 500,
            },
        ],
    });
    const finalVisit = plan.visits[1];

    assert.equal(
        finalVisit?.arrivalAt.toISOString(),
        '2026-07-15T08:11:00.000Z',
    );
    assert.equal(finalVisit?.waitingSeconds, 19 * 60);
    assert.equal(
        finalVisit?.serviceStartedAt.toISOString(),
        '2026-07-15T08:30:00.000Z',
    );
    assert.equal(
        finalVisit?.serviceCompletedAt.toISOString(),
        '2026-07-15T08:35:00.000Z',
    );
    assert.equal(plan.completedAt.toISOString(), '2026-07-15T08:35:00.000Z');
    assert.equal(plan.totalWaitingSeconds, 19 * 60);
    assert.equal(plan.totalServiceSeconds, 15 * 60);
    assert.equal(plan.totalDurationSeconds, 35 * 60);
});

test('returns persistence-safe whole-second totals after waiting for a window', () => {
    const departureWithMilliseconds = new Date('2026-07-15T08:00:00.500Z');
    const origin = pickup('pickup:hq');
    const delivery = customer('customer:later', origin.key, {
        windowStartAt: new Date('2026-07-15T08:30:00.000Z'),
    });

    const plan = solveDeliveryRouteGraph({
        nodes: [origin, delivery],
        originKey: origin.key,
        departureAt: departureWithMilliseconds,
        legs: [
            {
                fromKey: origin.key,
                toKey: delivery.key,
                travelSeconds: 60,
                distanceMeters: 500,
            },
        ],
    });

    assert.equal(Number.isInteger(plan.totalWaitingSeconds), true);
    assert.equal(Number.isInteger(plan.totalDurationSeconds), true);
    assert.equal(
        plan.totalDurationSeconds,
        plan.totalTravelSeconds +
            plan.totalWaitingSeconds +
            plan.totalServiceSeconds,
    );
});

test('keeps the only deadline-feasible state at the 27-node beam limit', () => {
    const origin = pickup('a-origin');
    const deadlineCustomer = customer('z-deadline', origin.key, {
        deliveryRequestId: 'request-deadline',
        windowEndAt: new Date(departureAt.getTime() + 1_600 * 1_000),
    });
    const ordinaryCustomers = Array.from({ length: 25 }, (_value, index) =>
        customer(`b-${String(index).padStart(2, '0')}`, origin.key),
    );
    const nodes = [origin, ...ordinaryCustomers, deadlineCustomer];
    const legs = nodes.flatMap((from) =>
        nodes
            .filter((to) => to.key !== from.key)
            .map(
                (to): DeliveryRouteGraphLeg => ({
                    fromKey: from.key,
                    toKey: to.key,
                    travelSeconds: to.key === deadlineCustomer.key ? 400 : 0,
                    distanceMeters: to.key === deadlineCustomer.key ? 400 : 0,
                }),
            ),
    );

    const plan = solveDeliveryRouteGraph({
        nodes,
        originKey: origin.key,
        departureAt,
        legs,
    });
    const deadlineVisit = plan.visits.find(
        (visit) => visit.node.key === deadlineCustomer.key,
    );

    assert.ok(deadlineVisit);
    assert.ok(deadlineCustomer.windowEndAt);
    assert.ok(deadlineVisit.serviceStartedAt <= deadlineCustomer.windowEndAt);
});

test('reports deterministic time-window infeasibility with the delivery identity', () => {
    const origin = pickup('pickup:hq');
    const delivery = customer('customer:late', origin.key, {
        deliveryRequestId: 'request-late',
        windowEndAt: new Date('2026-07-15T08:05:00.000Z'),
    });
    const leg: DeliveryRouteGraphLeg = {
        fromKey: origin.key,
        toKey: delivery.key,
        travelSeconds: 0,
        distanceMeters: 0,
    };

    const firstError = planningError(() =>
        solveDeliveryRouteGraph({
            nodes: [delivery, origin],
            originKey: origin.key,
            departureAt,
            legs: [leg],
        }),
    );
    const secondError = planningError(() =>
        solveDeliveryRouteGraph({
            nodes: [origin, delivery],
            originKey: origin.key,
            departureAt,
            legs: [leg],
        }),
    );

    assert.deepEqual(
        {
            code: firstError.code,
            nodeKey: firstError.nodeKey,
            deliveryRequestId: firstError.deliveryRequestId,
        },
        {
            code: 'route-time-window-infeasible',
            nodeKey: 'customer:late',
            deliveryRequestId: 'request-late',
        },
    );
    assert.deepEqual(
        {
            code: secondError.code,
            nodeKey: secondError.nodeKey,
            deliveryRequestId: secondError.deliveryRequestId,
        },
        {
            code: firstError.code,
            nodeKey: firstError.nodeKey,
            deliveryRequestId: firstError.deliveryRequestId,
        },
    );
});

test('uses stable node-key ordering when route costs tie', () => {
    const origin = pickup('pickup:hq');
    const second = customer('customer:b', origin.key);
    const first = customer('customer:a', origin.key);
    const nodes = [second, origin, first];

    const plan = solveDeliveryRouteGraph({
        nodes,
        originKey: origin.key,
        departureAt,
        legs: completeLegs(nodes, 60, 100),
    });

    assert.deepEqual(
        plan.visits.map(({ node }) => node.key),
        ['pickup:hq', 'customer:a', 'customer:b'],
    );
});

test('rejects a customer whose required pickup is not in the graph', () => {
    const origin = pickup('pickup:hq');
    const delivery = customer('customer:orphan', 'pickup:missing', {
        deliveryRequestId: 'request-orphan',
    });

    const error = planningError(() =>
        solveDeliveryRouteGraph({
            nodes: [origin, delivery],
            originKey: origin.key,
            departureAt,
            legs: [],
        }),
    );

    assert.equal(error.code, 'invalid-route-graph');
    assert.equal(error.nodeKey, delivery.key);
    assert.equal(error.deliveryRequestId, 'request-orphan');
});

test('treats a missing directed leg as route infeasibility', () => {
    const origin = pickup('pickup:hq');
    const delivery = customer('customer:unreachable', origin.key, {
        deliveryRequestId: 'request-unreachable',
    });

    const error = planningError(() =>
        solveDeliveryRouteGraph({
            nodes: [origin, delivery],
            originKey: origin.key,
            departureAt,
            legs: [],
        }),
    );

    assert.equal(error.code, 'route-infeasible');
    assert.equal(error.nodeKey, delivery.key);
    assert.equal(error.deliveryRequestId, 'request-unreachable');
});
