import { createHash } from 'node:crypto';
import {
    type DeliveryRunExecutionStep,
    getActiveDeliveryRunForDriver,
    getDeliveryRunExecutionProgress,
} from '@gredice/storage';
import 'server-only';
import {
    type DeliveryMobileActiveRouteResponse,
    type DeliveryMobileStop,
    deliveryMobileActiveRouteResponseSchema,
    deliveryMobileSchemaVersion,
    maximumDeliveryMobileStops,
} from './mobileActiveRouteContract';

type ProjectionPickupNode = {
    id: string;
    itinerarySequence: number | null;
    formattedAddress: string;
    latitude: number | null;
    longitude: number | null;
    estimatedArrivalAt: Date | null;
    incomingTravelSeconds: number | null;
    incomingDistanceMeters: number | null;
};

type ProjectionDeliveryStop = {
    id: number;
    itinerarySequence: number | null;
    formattedAddress: string;
    latitude: number;
    longitude: number;
    estimatedArrivalAt: Date | null;
    estimatedTravelSeconds: number | null;
    estimatedDistanceMeters: number | null;
};

export type DeliveryMobileProjectionSource = {
    run: {
        id: string;
        revision: number;
        reroutePending: boolean;
        pickupNodes: ProjectionPickupNode[];
        stops: ProjectionDeliveryStop[];
    };
    executionSteps: DeliveryRunExecutionStep[];
};

export type DeliveryMobileProjectionResult = {
    response: DeliveryMobileActiveRouteResponse;
    omittedInvalidNodeCount: number;
};

export class DeliveryMobileRouteTemporarilyUnavailableError extends Error {
    override name = 'DeliveryMobileRouteTemporarilyUnavailableError';
}

function validCoordinate(
    value: number | null,
    minimum: number,
    maximum: number,
): value is number {
    return (
        value !== null &&
        Number.isFinite(value) &&
        value >= minimum &&
        value <= maximum
    );
}

function validSequence(value: number | null): value is number {
    return value !== null && Number.isInteger(value) && value > 0;
}

function validAddress(value: string) {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
}

function nullableIso(value: Date | null) {
    return value && Number.isFinite(value.getTime())
        ? value.toISOString()
        : null;
}

function nullableNonnegativeInteger(value: number | null) {
    return value !== null && Number.isInteger(value) && value >= 0
        ? value
        : null;
}

function opaqueNavigationId({
    kind,
    runId,
    nodeKey,
}: {
    kind: DeliveryMobileStop['kind'];
    runId: string;
    nodeKey: string;
}) {
    const opaqueId = createHash('sha256')
        .update(`${runId}\n${kind}\n${nodeKey}`)
        .digest('base64url')
        .slice(0, 24);
    return `${kind}:${opaqueId}`;
}

function opaqueRouteId(runId: string) {
    const opaqueId = createHash('sha256')
        .update(`route\n${runId}`)
        .digest('base64url')
        .slice(0, 32);
    return `route:${opaqueId}`;
}

function isNavigableExecutionStep(step: DeliveryRunExecutionStep) {
    if (step.state === 'completed') return false;
    if (step.kind === 'pickup') return step.state === 'current';
    return step.pickupConfirmed && step.actionableStopIds.length > 0;
}

function pickupStop({
    node,
    runId,
    reroutePending,
    state,
}: {
    node: ProjectionPickupNode;
    runId: string;
    reroutePending: boolean;
    state: 'current' | 'upcoming';
}): DeliveryMobileStop | null {
    const address = validAddress(node.formattedAddress);
    if (
        !address ||
        !validSequence(node.itinerarySequence) ||
        !validCoordinate(node.latitude, -90, 90) ||
        !validCoordinate(node.longitude, -180, 180)
    ) {
        return null;
    }

    return {
        navigationId: opaqueNavigationId({
            kind: 'pickup',
            runId,
            nodeKey: node.id,
        }),
        kind: 'pickup',
        sequence: node.itinerarySequence,
        actionState: state,
        label: `Preuzimanje ${node.itinerarySequence}`,
        address,
        latitude: node.latitude,
        longitude: node.longitude,
        estimatedArrivalAt: reroutePending
            ? null
            : nullableIso(node.estimatedArrivalAt),
        travelSeconds: reroutePending
            ? null
            : nullableNonnegativeInteger(node.incomingTravelSeconds),
        distanceMeters: reroutePending
            ? null
            : nullableNonnegativeInteger(node.incomingDistanceMeters),
    };
}

function deliveryStop({
    step,
    stopsById,
    runId,
    reroutePending,
}: {
    step: Extract<DeliveryRunExecutionStep, { kind: 'delivery' }>;
    stopsById: ReadonlyMap<number, ProjectionDeliveryStop>;
    runId: string;
    reroutePending: boolean;
}): DeliveryMobileStop | null {
    const representative = step.actionableStopIds
        .map((stopId) => stopsById.get(stopId))
        .find((stop) => stop !== undefined);
    const address = representative
        ? validAddress(representative.formattedAddress)
        : null;
    if (
        !representative ||
        !address ||
        !validSequence(step.itinerarySequence) ||
        !validCoordinate(representative.latitude, -90, 90) ||
        !validCoordinate(representative.longitude, -180, 180)
    ) {
        return null;
    }

    return {
        navigationId: opaqueNavigationId({
            kind: 'delivery',
            runId,
            nodeKey: [...step.stopIds].sort((a, b) => a - b).join(','),
        }),
        kind: 'delivery',
        sequence: step.itinerarySequence,
        actionState: step.state === 'current' ? 'current' : 'upcoming',
        label: `Dostava ${step.itinerarySequence}`,
        address,
        latitude: representative.latitude,
        longitude: representative.longitude,
        estimatedArrivalAt: reroutePending
            ? null
            : nullableIso(representative.estimatedArrivalAt),
        travelSeconds: reroutePending
            ? null
            : nullableNonnegativeInteger(representative.estimatedTravelSeconds),
        distanceMeters: reroutePending
            ? null
            : nullableNonnegativeInteger(
                  representative.estimatedDistanceMeters,
              ),
    };
}

export function projectDeliveryMobileActiveRoute({
    source,
    generatedAt,
}: {
    source: DeliveryMobileProjectionSource | null;
    generatedAt: Date;
}): DeliveryMobileProjectionResult {
    if (!source) {
        return {
            response: deliveryMobileActiveRouteResponseSchema.parse({
                schemaVersion: deliveryMobileSchemaVersion,
                generatedAt: generatedAt.toISOString(),
                route: null,
            }),
            omittedInvalidNodeCount: 0,
        };
    }

    const currentIndex = source.executionSteps.findIndex(
        (step) => step.state === 'current',
    );
    const candidateSteps =
        currentIndex < 0
            ? []
            : source.executionSteps
                  .slice(currentIndex)
                  .filter(isNavigableExecutionStep)
                  .slice(0, maximumDeliveryMobileStops);
    const pickupNodesById = new Map(
        source.run.pickupNodes.map((node) => [node.id, node]),
    );
    const stopsById = new Map(source.run.stops.map((stop) => [stop.id, stop]));
    let omittedInvalidNodeCount = 0;
    const stops: DeliveryMobileStop[] = [];

    for (const step of candidateSteps) {
        const projected =
            step.kind === 'pickup'
                ? (() => {
                      const node = pickupNodesById.get(step.pickupNodeId);
                      return node
                          ? pickupStop({
                                node,
                                runId: source.run.id,
                                reroutePending: source.run.reroutePending,
                                state:
                                    step.state === 'current'
                                        ? 'current'
                                        : 'upcoming',
                            })
                          : null;
                  })()
                : deliveryStop({
                      step,
                      stopsById,
                      runId: source.run.id,
                      reroutePending: source.run.reroutePending,
                  });

        if (projected) {
            stops.push(projected);
        } else {
            omittedInvalidNodeCount += 1;
        }
    }

    const response = deliveryMobileActiveRouteResponseSchema.parse({
        schemaVersion: deliveryMobileSchemaVersion,
        generatedAt: generatedAt.toISOString(),
        route: {
            id: opaqueRouteId(source.run.id),
            revision: source.run.revision,
            state: 'active',
            reroutePending: source.run.reroutePending,
            currentNavigationId:
                stops.find((stop) => stop.actionState === 'current')
                    ?.navigationId ?? null,
            stops,
        },
    });

    return { response, omittedInvalidNodeCount };
}

function projectionSource(
    run: Awaited<ReturnType<typeof getActiveDeliveryRunForDriver>>,
    executionSteps: DeliveryRunExecutionStep[],
): DeliveryMobileProjectionSource | null {
    if (!run) return null;
    return {
        run: {
            id: run.id,
            revision: run.routeRevision,
            reroutePending: run.rerouteRequiredAt !== null,
            pickupNodes: run.pickupNodes.map((node) => ({
                id: node.id,
                itinerarySequence: node.itinerarySequence,
                formattedAddress: node.formattedAddress,
                latitude: node.latitude,
                longitude: node.longitude,
                estimatedArrivalAt: node.estimatedArrivalAt,
                incomingTravelSeconds: node.incomingTravelSeconds,
                incomingDistanceMeters: node.incomingDistanceMeters,
            })),
            stops: run.stops.map((stop) => ({
                id: stop.id,
                itinerarySequence: stop.itinerarySequence,
                formattedAddress: stop.formattedAddress,
                latitude: stop.latitude,
                longitude: stop.longitude,
                estimatedArrivalAt: stop.estimatedArrivalAt,
                estimatedTravelSeconds: stop.estimatedTravelSeconds,
                estimatedDistanceMeters: stop.estimatedDistanceMeters,
            })),
        },
        executionSteps,
    };
}

export async function readDeliveryMobileActiveRoute({
    userId,
    generatedAt,
}: {
    userId: string;
    generatedAt: Date;
}): Promise<DeliveryMobileProjectionResult> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const run = await getActiveDeliveryRunForDriver(userId);
        if (!run) {
            return projectDeliveryMobileActiveRoute({
                source: null,
                generatedAt,
            });
        }
        const executionSteps = await getDeliveryRunExecutionProgress(run.id);
        const current = await getActiveDeliveryRunForDriver(userId);
        if (
            current?.id === run.id &&
            current.routeRevision === run.routeRevision &&
            current.rerouteRequiredAt?.getTime() ===
                run.rerouteRequiredAt?.getTime()
        ) {
            return projectDeliveryMobileActiveRoute({
                source: projectionSource(run, executionSteps),
                generatedAt,
            });
        }
    }

    throw new DeliveryMobileRouteTemporarilyUnavailableError(
        'The active delivery route changed while it was being projected.',
    );
}

function etagState(response: DeliveryMobileActiveRouteResponse) {
    if (!response.route) return null;
    return {
        id: response.route.id,
        revision: response.route.revision,
        reroutePending: response.route.reroutePending,
        currentNavigationId: response.route.currentNavigationId,
        stops: response.route.stops.map((stop) => ({
            navigationId: stop.navigationId,
            kind: stop.kind,
            sequence: stop.sequence,
            actionState: stop.actionState,
            latitude: stop.latitude,
            longitude: stop.longitude,
            estimatedArrivalAt: stop.estimatedArrivalAt,
            travelSeconds: stop.travelSeconds,
            distanceMeters: stop.distanceMeters,
        })),
    };
}

export function deliveryMobileActiveRouteEtag({
    response,
    subject,
}: {
    response: DeliveryMobileActiveRouteResponse;
    subject: { userId: string; accountId: string };
}) {
    const digest = createHash('sha256')
        .update(
            JSON.stringify({
                schemaVersion: response.schemaVersion,
                subject,
                route: etagState(response),
            }),
        )
        .digest('base64url');
    return `"${digest}"`;
}

export function requestMatchesEtag(
    ifNoneMatch: string | undefined,
    etag: string,
) {
    if (!ifNoneMatch) return false;
    return ifNoneMatch.split(',').some((candidate) => {
        const normalized = candidate.trim();
        return (
            normalized === '*' ||
            normalized === etag ||
            normalized.replace(/^W\//, '') === etag
        );
    });
}
