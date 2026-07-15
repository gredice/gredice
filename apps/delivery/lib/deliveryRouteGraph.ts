export const pickupNodeServiceSeconds = 10 * 60;
export const deliveryNodeServiceSeconds = 5 * 60;
export const maximumDeliveryRouteGraphNodes = 27;

const deliveryRouteGraphBeamWidth = 4_096;

export type DeliveryRouteGraphCoordinates = {
    latitude: number;
    longitude: number;
};

type DeliveryRouteGraphBaseNode = DeliveryRouteGraphCoordinates & {
    key: string;
    serviceSeconds: number;
    windowStartAt?: Date;
    windowEndAt?: Date;
};

export type DeliveryRouteGraphPickupNode = DeliveryRouteGraphBaseNode & {
    kind: 'pickup';
};

export type DeliveryRouteGraphCustomerNode = DeliveryRouteGraphBaseNode & {
    kind: 'customer';
    requiredPickupKey: string;
    deliveryRequestId?: string;
};

export type DeliveryRouteGraphNode =
    | DeliveryRouteGraphPickupNode
    | DeliveryRouteGraphCustomerNode;

export type DeliveryRouteGraphLeg = {
    fromKey: string;
    toKey: string;
    travelSeconds: number;
    distanceMeters: number;
};

export type DeliveryRouteGraphVisit = {
    sequence: number;
    node: DeliveryRouteGraphNode;
    incomingTravelSeconds: number;
    incomingDistanceMeters: number;
    arrivalAt: Date;
    waitingSeconds: number;
    serviceStartedAt: Date;
    serviceSeconds: number;
    serviceCompletedAt: Date;
};

export type DeliveryRouteGraphPlan = {
    startedAt: Date;
    completedAt: Date;
    totalDistanceMeters: number;
    totalTravelSeconds: number;
    totalWaitingSeconds: number;
    totalServiceSeconds: number;
    totalDurationSeconds: number;
    visits: DeliveryRouteGraphVisit[];
};

export type DeliveryRouteGraphPlanningErrorCode =
    | 'invalid-route-graph'
    | 'route-infeasible'
    | 'route-time-window-infeasible';

export class DeliveryRouteGraphPlanningError extends Error {
    override name = 'DeliveryRouteGraphPlanningError';

    constructor(
        message: string,
        readonly code: DeliveryRouteGraphPlanningErrorCode,
        readonly nodeKey?: string,
        readonly deliveryRequestId?: string,
    ) {
        super(message);
    }
}

export type SolveDeliveryRouteGraphInput = {
    nodes: readonly DeliveryRouteGraphNode[];
    originKey: string;
    departureAt: Date;
    legs: readonly DeliveryRouteGraphLeg[];
};

type SearchStateCore = {
    visitedMask: number;
    currentIndex: number;
    availableAtMs: number;
    totalDistanceMeters: number;
    totalTravelSeconds: number;
    totalWaitingSeconds: number;
    totalServiceSeconds: number;
    order: number[];
};

type SearchState = SearchStateCore & {
    optimisticCompletedAtMs: number;
    optimisticDistanceMeters: number;
    pendingWindowEndTimes: number[];
};

type ValidatedGraph = {
    nodes: DeliveryRouteGraphNode[];
    originIndex: number;
    legsByFromIndex: Map<number, DeliveryRouteGraphLeg>[];
    requiredPickupIndexByCustomerIndex: Map<number, number>;
    minimumIncomingTravelMs: number[];
    minimumIncomingDistanceMeters: number[];
};

function deliveryRequestId(node: DeliveryRouteGraphNode | undefined) {
    return node?.kind === 'customer' ? node.deliveryRequestId : undefined;
}

function invalidGraph(
    message: string,
    nodeKey?: string,
    deliveryRequestIdValue?: string,
): never {
    throw new DeliveryRouteGraphPlanningError(
        message,
        'invalid-route-graph',
        nodeKey,
        deliveryRequestIdValue,
    );
}

function validDate(value: Date) {
    return Number.isFinite(value.getTime());
}

function validNonNegativeInteger(value: number) {
    return Number.isInteger(value) && value >= 0;
}

function validateNode(node: DeliveryRouteGraphNode) {
    if (node.key.trim().length === 0) {
        invalidGraph('Stanica rute mora imati stabilan ključ.', node.key);
    }
    if (
        !Number.isFinite(node.latitude) ||
        node.latitude < -90 ||
        node.latitude > 90 ||
        !Number.isFinite(node.longitude) ||
        node.longitude < -180 ||
        node.longitude > 180
    ) {
        invalidGraph(
            'Stanica rute nema valjane koordinate.',
            node.key,
            deliveryRequestId(node),
        );
    }
    if (!validNonNegativeInteger(node.serviceSeconds)) {
        invalidGraph(
            'Trajanje usluge na stanici rute nije valjano.',
            node.key,
            deliveryRequestId(node),
        );
    }
    if (node.windowStartAt && !validDate(node.windowStartAt)) {
        invalidGraph(
            'Početak vremenskog prozora stanice nije valjan.',
            node.key,
            deliveryRequestId(node),
        );
    }
    if (node.windowEndAt && !validDate(node.windowEndAt)) {
        invalidGraph(
            'Kraj vremenskog prozora stanice nije valjan.',
            node.key,
            deliveryRequestId(node),
        );
    }
    if (
        node.windowStartAt &&
        node.windowEndAt &&
        node.windowStartAt.getTime() > node.windowEndAt.getTime()
    ) {
        invalidGraph(
            'Vremenski prozor stanice nije valjan.',
            node.key,
            deliveryRequestId(node),
        );
    }
}

function validateGraph(input: SolveDeliveryRouteGraphInput): ValidatedGraph {
    if (!validDate(input.departureAt)) {
        invalidGraph('Vrijeme polaska rute nije valjano.');
    }
    if (input.nodes.length === 0) {
        invalidGraph('Ruta mora sadržavati barem jednu stanicu.');
    }
    if (input.nodes.length > maximumDeliveryRouteGraphNodes) {
        invalidGraph(
            `Ruta može sadržavati najviše ${maximumDeliveryRouteGraphNodes} stanica.`,
        );
    }

    const nodes = [...input.nodes].sort((first, second) =>
        first.key.localeCompare(second.key),
    );
    const nodeIndexByKey = new Map<string, number>();
    for (const [index, node] of nodes.entries()) {
        validateNode(node);
        if (nodeIndexByKey.has(node.key)) {
            invalidGraph(
                'Ključevi stanica rute moraju biti jedinstveni.',
                node.key,
                deliveryRequestId(node),
            );
        }
        nodeIndexByKey.set(node.key, index);
    }

    const originIndex = nodeIndexByKey.get(input.originKey);
    if (originIndex === undefined) {
        invalidGraph('Početna stanica rute ne postoji.', input.originKey);
    }
    const origin = nodes[originIndex];
    if (origin?.kind !== 'pickup') {
        invalidGraph(
            'Početna stanica rute mora biti preuzimanje.',
            input.originKey,
            deliveryRequestId(origin),
        );
    }

    const requiredPickupIndexByCustomerIndex = new Map<number, number>();
    for (const [index, node] of nodes.entries()) {
        if (node.kind !== 'customer') continue;
        const pickupIndex = nodeIndexByKey.get(node.requiredPickupKey);
        const pickup =
            pickupIndex === undefined ? undefined : nodes[pickupIndex];
        if (pickupIndex === undefined || pickup?.kind !== 'pickup') {
            invalidGraph(
                'Dostavna stanica nema valjano prethodno preuzimanje.',
                node.key,
                node.deliveryRequestId,
            );
        }
        requiredPickupIndexByCustomerIndex.set(index, pickupIndex);
    }

    const legsByFromIndex = nodes.map(
        () => new Map<number, DeliveryRouteGraphLeg>(),
    );
    const minimumIncomingTravelMs = nodes.map(() => Number.POSITIVE_INFINITY);
    const minimumIncomingDistanceMeters = nodes.map(
        () => Number.POSITIVE_INFINITY,
    );

    for (const leg of input.legs) {
        const fromIndex = nodeIndexByKey.get(leg.fromKey);
        const toIndex = nodeIndexByKey.get(leg.toKey);
        if (fromIndex === undefined || toIndex === undefined) {
            const unknownKey =
                fromIndex === undefined ? leg.fromKey : leg.toKey;
            invalidGraph('Matrica rute sadrži nepoznatu stanicu.', unknownKey);
        }
        if (fromIndex === toIndex) {
            invalidGraph(
                'Matrica rute ne smije sadržavati vezu stanice prema samoj sebi.',
                leg.fromKey,
                deliveryRequestId(nodes[fromIndex]),
            );
        }
        if (
            !validNonNegativeInteger(leg.travelSeconds) ||
            !validNonNegativeInteger(leg.distanceMeters)
        ) {
            invalidGraph(
                'Matrica rute sadrži nevaljano trajanje ili udaljenost.',
                leg.toKey,
                deliveryRequestId(nodes[toIndex]),
            );
        }
        const row = legsByFromIndex[fromIndex];
        if (!row) {
            invalidGraph('Matrica rute nije valjana.', leg.fromKey);
        }
        if (row.has(toIndex)) {
            invalidGraph(
                'Matrica rute sadrži dupliciranu usmjerenu vezu.',
                leg.toKey,
                deliveryRequestId(nodes[toIndex]),
            );
        }
        row.set(toIndex, leg);
        minimumIncomingTravelMs[toIndex] = Math.min(
            minimumIncomingTravelMs[toIndex] ?? Number.POSITIVE_INFINITY,
            leg.travelSeconds * 1_000,
        );
        minimumIncomingDistanceMeters[toIndex] = Math.min(
            minimumIncomingDistanceMeters[toIndex] ?? Number.POSITIVE_INFINITY,
            leg.distanceMeters,
        );
    }

    return {
        nodes,
        originIndex,
        legsByFromIndex,
        requiredPickupIndexByCustomerIndex,
        minimumIncomingTravelMs,
        minimumIncomingDistanceMeters,
    };
}

function nodeAt(nodes: readonly DeliveryRouteGraphNode[], index: number) {
    const node = nodes[index];
    if (!node) {
        invalidGraph('Ruta sadrži nepoznatu stanicu.');
    }
    return node;
}

function hasVisited(mask: number, index: number) {
    return (mask & (2 ** index)) !== 0;
}

function scoreState(
    state: SearchStateCore,
    graph: ValidatedGraph,
): SearchState {
    let remainingDurationMs = 0;
    let latestWindowCompletionAtMs = state.availableAtMs;
    let optimisticDistanceMeters = state.totalDistanceMeters;
    const pendingWindowEndTimes: number[] = [];

    for (const [index, node] of graph.nodes.entries()) {
        if (hasVisited(state.visitedMask, index)) continue;
        if (node.windowEndAt) {
            pendingWindowEndTimes.push(node.windowEndAt.getTime());
        }
        if (node.kind === 'pickup') {
            // An unvisited pickup inherits its earliest dependent deadline so
            // the bounded beam retains both pickup-first and delivery-first
            // states that can still satisfy a customer window.
            const dependentWindowEnd = graph.nodes.reduce(
                (earliest, dependent, dependentIndex) => {
                    if (
                        hasVisited(state.visitedMask, dependentIndex) ||
                        dependent.kind !== 'customer' ||
                        dependent.requiredPickupKey !== node.key ||
                        !dependent.windowEndAt
                    ) {
                        return earliest;
                    }
                    return Math.min(earliest, dependent.windowEndAt.getTime());
                },
                Number.POSITIVE_INFINITY,
            );
            if (Number.isFinite(dependentWindowEnd)) {
                pendingWindowEndTimes.push(dependentWindowEnd);
            }
        }
        remainingDurationMs +=
            node.serviceSeconds * 1_000 +
            (graph.minimumIncomingTravelMs[index] ?? Number.POSITIVE_INFINITY);
        optimisticDistanceMeters +=
            graph.minimumIncomingDistanceMeters[index] ??
            Number.POSITIVE_INFINITY;
        if (node.windowStartAt) {
            latestWindowCompletionAtMs = Math.max(
                latestWindowCompletionAtMs,
                node.windowStartAt.getTime() + node.serviceSeconds * 1_000,
            );
        }
    }

    const optimisticCompletedAtMs = Math.max(
        state.availableAtMs + remainingDurationMs,
        latestWindowCompletionAtMs,
    );

    return {
        ...state,
        optimisticCompletedAtMs,
        optimisticDistanceMeters,
        pendingWindowEndTimes: pendingWindowEndTimes.sort(
            (first, second) => first - second,
        ),
    };
}

function compareNumber(first: number, second: number) {
    if (first < second) return -1;
    if (first > second) return 1;
    return 0;
}

function compareOrder(first: readonly number[], second: readonly number[]) {
    const length = Math.min(first.length, second.length);
    for (let index = 0; index < length; index += 1) {
        const difference = compareNumber(
            first[index] ?? -1,
            second[index] ?? -1,
        );
        if (difference !== 0) return difference;
    }
    return compareNumber(first.length, second.length);
}

function comparePendingWindowEnds(
    first: readonly number[],
    second: readonly number[],
) {
    // At the same search depth, states that have already satisfied an earlier
    // deadline must survive the global beam even when route costs tie.
    const length = Math.max(first.length, second.length);
    for (let index = 0; index < length; index += 1) {
        const firstEnd = first[index] ?? Number.POSITIVE_INFINITY;
        const secondEnd = second[index] ?? Number.POSITIVE_INFINITY;
        const difference = compareNumber(secondEnd, firstEnd);
        if (difference !== 0) return difference;
    }
    return 0;
}

function compareSearchStates(first: SearchState, second: SearchState) {
    return (
        comparePendingWindowEnds(
            first.pendingWindowEndTimes,
            second.pendingWindowEndTimes,
        ) ||
        compareNumber(
            first.optimisticCompletedAtMs,
            second.optimisticCompletedAtMs,
        ) ||
        compareNumber(
            first.optimisticDistanceMeters,
            second.optimisticDistanceMeters,
        ) ||
        compareNumber(first.availableAtMs, second.availableAtMs) ||
        compareNumber(first.totalDistanceMeters, second.totalDistanceMeters) ||
        compareOrder(first.order, second.order)
    );
}

function compareCompletedStates(first: SearchState, second: SearchState) {
    return (
        compareNumber(first.availableAtMs, second.availableAtMs) ||
        compareNumber(first.totalDistanceMeters, second.totalDistanceMeters) ||
        compareOrder(first.order, second.order)
    );
}

function stateDominates(first: SearchState, second: SearchState) {
    return (
        first.availableAtMs <= second.availableAtMs &&
        first.totalDistanceMeters <= second.totalDistanceMeters &&
        (first.availableAtMs < second.availableAtMs ||
            first.totalDistanceMeters < second.totalDistanceMeters)
    );
}

function paretoStates(states: readonly SearchState[]) {
    const statesByPosition = new Map<string, SearchState[]>();

    for (const candidate of states) {
        const key = `${candidate.visitedMask}:${candidate.currentIndex}`;
        const existingStates = statesByPosition.get(key) ?? [];
        let candidateIsDominated = false;
        const survivors: SearchState[] = [];

        for (const existing of existingStates) {
            if (
                existing.availableAtMs === candidate.availableAtMs &&
                existing.totalDistanceMeters === candidate.totalDistanceMeters
            ) {
                if (compareOrder(existing.order, candidate.order) <= 0) {
                    candidateIsDominated = true;
                    survivors.push(existing);
                }
                continue;
            }
            if (stateDominates(existing, candidate)) {
                candidateIsDominated = true;
                survivors.push(existing);
                continue;
            }
            if (!stateDominates(candidate, existing)) {
                survivors.push(existing);
            }
        }

        if (!candidateIsDominated) {
            survivors.push(candidate);
        }
        statesByPosition.set(key, survivors);
    }

    return Array.from(statesByPosition.values()).flat();
}

function serviceStartAtMs(arrivalAtMs: number, node: DeliveryRouteGraphNode) {
    const windowStartAtMs = node.windowStartAt?.getTime();
    return Math.max(
        arrivalAtMs,
        windowStartAtMs === undefined
            ? arrivalAtMs
            : Math.ceil(windowStartAtMs / 1_000) * 1_000,
    );
}

function missesWindow(
    serviceStartedAtMs: number,
    node: DeliveryRouteGraphNode,
) {
    return (
        node.windowEndAt !== undefined &&
        serviceStartedAtMs > node.windowEndAt.getTime()
    );
}

function firstMissedNode(
    missedNodes: ReadonlyMap<string, DeliveryRouteGraphNode>,
) {
    return Array.from(missedNodes.values()).sort((first, second) => {
        const windowDifference = compareNumber(
            first.windowEndAt?.getTime() ?? Number.POSITIVE_INFINITY,
            second.windowEndAt?.getTime() ?? Number.POSITIVE_INFINITY,
        );
        return windowDifference || first.key.localeCompare(second.key);
    })[0];
}

function throwInfeasibleRoute(
    missedNodes: ReadonlyMap<string, DeliveryRouteGraphNode>,
    blockedNodes: ReadonlyMap<string, DeliveryRouteGraphNode>,
): never {
    const missedNode = firstMissedNode(missedNodes);
    if (missedNode) {
        throw new DeliveryRouteGraphPlanningError(
            'Rutu nije moguće završiti unutar vremenskog prozora odabrane stanice.',
            'route-time-window-infeasible',
            missedNode.key,
            deliveryRequestId(missedNode),
        );
    }

    const blockedNode = Array.from(blockedNodes.values()).sort(
        (first, second) => first.key.localeCompare(second.key),
    )[0];
    throw new DeliveryRouteGraphPlanningError(
        'Nije moguće povezati sve odabrane stanice u jednu rutu.',
        'route-infeasible',
        blockedNode?.key,
        deliveryRequestId(blockedNode),
    );
}

function recordAlreadyMissedNodes(
    state: SearchStateCore,
    graph: ValidatedGraph,
    missedNodes: Map<string, DeliveryRouteGraphNode>,
) {
    let foundMissedNode = false;
    for (const [index, node] of graph.nodes.entries()) {
        if (hasVisited(state.visitedMask, index)) continue;
        if (
            node.windowEndAt &&
            state.availableAtMs > node.windowEndAt.getTime()
        ) {
            missedNodes.set(node.key, node);
            foundMissedNode = true;
        }
    }
    return foundMissedNode;
}

function expandState(
    state: SearchState,
    graph: ValidatedGraph,
    missedNodes: Map<string, DeliveryRouteGraphNode>,
    blockedNodes: Map<string, DeliveryRouteGraphNode>,
) {
    const expanded: SearchState[] = [];
    const row = graph.legsByFromIndex[state.currentIndex];

    for (const [nextIndex, node] of graph.nodes.entries()) {
        if (hasVisited(state.visitedMask, nextIndex)) continue;
        if (node.kind === 'customer') {
            const pickupIndex =
                graph.requiredPickupIndexByCustomerIndex.get(nextIndex);
            if (
                pickupIndex === undefined ||
                !hasVisited(state.visitedMask, pickupIndex)
            ) {
                continue;
            }
        }

        const leg = row?.get(nextIndex);
        if (!leg) {
            blockedNodes.set(node.key, node);
            continue;
        }
        const arrivalAtMs = state.availableAtMs + leg.travelSeconds * 1_000;
        const serviceStartedAtMs = serviceStartAtMs(arrivalAtMs, node);
        if (missesWindow(serviceStartedAtMs, node)) {
            missedNodes.set(node.key, node);
            continue;
        }

        const waitingSeconds = (serviceStartedAtMs - arrivalAtMs) / 1_000;
        const nextCore: SearchStateCore = {
            visitedMask: state.visitedMask | (2 ** nextIndex),
            currentIndex: nextIndex,
            availableAtMs: serviceStartedAtMs + node.serviceSeconds * 1_000,
            totalDistanceMeters: state.totalDistanceMeters + leg.distanceMeters,
            totalTravelSeconds: state.totalTravelSeconds + leg.travelSeconds,
            totalWaitingSeconds: state.totalWaitingSeconds + waitingSeconds,
            totalServiceSeconds:
                state.totalServiceSeconds + node.serviceSeconds,
            order: [...state.order, nextIndex],
        };
        if (recordAlreadyMissedNodes(nextCore, graph, missedNodes)) {
            continue;
        }
        expanded.push(scoreState(nextCore, graph));
    }

    return expanded;
}

function buildPlan(
    input: SolveDeliveryRouteGraphInput,
    graph: ValidatedGraph,
    state: SearchState,
): DeliveryRouteGraphPlan {
    const visits: DeliveryRouteGraphVisit[] = [];
    let availableAtMs = input.departureAt.getTime();
    let totalDistanceMeters = 0;
    let totalTravelSeconds = 0;
    let totalWaitingSeconds = 0;
    let totalServiceSeconds = 0;
    let previousIndex: number | undefined;

    for (const [orderIndex, nodeIndex] of state.order.entries()) {
        const node = nodeAt(graph.nodes, nodeIndex);
        const leg =
            previousIndex === undefined
                ? undefined
                : graph.legsByFromIndex[previousIndex]?.get(nodeIndex);
        if (previousIndex !== undefined && !leg) {
            invalidGraph(
                'Planirana ruta sadrži nepoznatu vezu.',
                node.key,
                deliveryRequestId(node),
            );
        }

        const incomingTravelSeconds = leg?.travelSeconds ?? 0;
        const incomingDistanceMeters = leg?.distanceMeters ?? 0;
        const arrivalAtMs = availableAtMs + incomingTravelSeconds * 1_000;
        const serviceStartedAtMs = serviceStartAtMs(arrivalAtMs, node);
        const waitingSeconds = (serviceStartedAtMs - arrivalAtMs) / 1_000;
        const serviceCompletedAtMs =
            serviceStartedAtMs + node.serviceSeconds * 1_000;

        visits.push({
            sequence: orderIndex + 1,
            node,
            incomingTravelSeconds,
            incomingDistanceMeters,
            arrivalAt: new Date(arrivalAtMs),
            waitingSeconds,
            serviceStartedAt: new Date(serviceStartedAtMs),
            serviceSeconds: node.serviceSeconds,
            serviceCompletedAt: new Date(serviceCompletedAtMs),
        });
        availableAtMs = serviceCompletedAtMs;
        totalDistanceMeters += incomingDistanceMeters;
        totalTravelSeconds += incomingTravelSeconds;
        totalWaitingSeconds += waitingSeconds;
        totalServiceSeconds += node.serviceSeconds;
        previousIndex = nodeIndex;
    }

    return {
        startedAt: new Date(input.departureAt),
        completedAt: new Date(availableAtMs),
        totalDistanceMeters,
        totalTravelSeconds,
        totalWaitingSeconds,
        totalServiceSeconds,
        totalDurationSeconds:
            (availableAtMs - input.departureAt.getTime()) / 1_000,
        visits,
    };
}

/**
 * Plans a precedence-safe path through a sparse directed route matrix.
 *
 * The fixed pickup origin is serviced first. Each search depth keeps a bounded,
 * deterministic A*-scored beam plus the non-dominated arrival/distance states
 * for each visited-set position.
 */
export function solveDeliveryRouteGraph(
    input: SolveDeliveryRouteGraphInput,
): DeliveryRouteGraphPlan {
    const normalizedInput = {
        ...input,
        departureAt: new Date(
            Math.ceil(input.departureAt.getTime() / 1_000) * 1_000,
        ),
    };
    const graph = validateGraph(normalizedInput);
    const origin = nodeAt(graph.nodes, graph.originIndex);
    const originArrivalAtMs = normalizedInput.departureAt.getTime();
    const originServiceStartedAtMs = serviceStartAtMs(
        originArrivalAtMs,
        origin,
    );
    if (missesWindow(originServiceStartedAtMs, origin)) {
        throw new DeliveryRouteGraphPlanningError(
            'Rutu nije moguće započeti unutar vremenskog prozora preuzimanja.',
            'route-time-window-infeasible',
            origin.key,
        );
    }

    const originWaitingSeconds =
        (originServiceStartedAtMs - originArrivalAtMs) / 1_000;
    const initialCore: SearchStateCore = {
        visitedMask: 2 ** graph.originIndex,
        currentIndex: graph.originIndex,
        availableAtMs: originServiceStartedAtMs + origin.serviceSeconds * 1_000,
        totalDistanceMeters: 0,
        totalTravelSeconds: 0,
        totalWaitingSeconds: originWaitingSeconds,
        totalServiceSeconds: origin.serviceSeconds,
        order: [graph.originIndex],
    };
    const missedNodes = new Map<string, DeliveryRouteGraphNode>();
    const blockedNodes = new Map<string, DeliveryRouteGraphNode>();
    if (recordAlreadyMissedNodes(initialCore, graph, missedNodes)) {
        throwInfeasibleRoute(missedNodes, blockedNodes);
    }

    let states = [scoreState(initialCore, graph)];
    for (let depth = 1; depth < graph.nodes.length; depth += 1) {
        const expanded = states.flatMap((state) =>
            expandState(state, graph, missedNodes, blockedNodes),
        );
        if (expanded.length === 0) {
            throwInfeasibleRoute(missedNodes, blockedNodes);
        }
        states = paretoStates(expanded)
            .sort(compareSearchStates)
            .slice(0, deliveryRouteGraphBeamWidth);
    }

    const completed = states.sort(compareCompletedStates)[0];
    if (!completed) {
        throwInfeasibleRoute(missedNodes, blockedNodes);
    }
    return buildPlan(normalizedInput, graph, completed);
}
