import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull, lte, ne, or } from 'drizzle-orm';
import 'server-only';
import {
    accountUsers,
    DeliveryRunStates,
    DeliveryRunStopStates,
    deliveryRequests,
    deliveryRunStops,
    deliveryRuns,
    operations,
    users,
} from '../schema';
import { storage } from '../storage';

export type CreateDeliveryRunStopInput = {
    deliveryRequestId: string;
    sequence: number;
    latitude: number;
    longitude: number;
    formattedAddress: string;
    estimatedArrivalAt?: Date;
    estimatedTravelSeconds?: number;
    estimatedDistanceMeters?: number;
};

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

export async function createDeliveryRun({
    driverUserId,
    timeSlotId,
    encodedPolyline,
    totalDistanceMeters,
    totalDurationSeconds,
    stops,
}: {
    driverUserId: string;
    timeSlotId: number;
    encodedPolyline?: string;
    totalDistanceMeters?: number;
    totalDurationSeconds?: number;
    stops: CreateDeliveryRunStopInput[];
}) {
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
            stops: {
                orderBy: [asc(deliveryRunStops.sequence)],
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
            stops: {
                orderBy: [asc(deliveryRunStops.sequence)],
            },
        },
    });
}

export function getDeliveryRunStop(stopId: number) {
    return storage().query.deliveryRunStops.findFirst({
        where: eq(deliveryRunStops.id, stopId),
        with: {
            run: true,
        },
    });
}

export async function getDeliveryRunStopsForRequestIds(requestIds: string[]) {
    if (requestIds.length === 0) {
        return [];
    }

    return await storage()
        .select({
            run: deliveryRuns,
            stop: deliveryRunStops,
        })
        .from(deliveryRunStops)
        .innerJoin(deliveryRuns, eq(deliveryRunStops.runId, deliveryRuns.id))
        .where(inArray(deliveryRunStops.deliveryRequestId, requestIds));
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
    const row = await storage()
        .select({ id: deliveryRunStops.id })
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
                eq(operations.accountId, accountId),
            ),
        )
        .limit(1);

    return row.length > 0;
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

async function ensureOwnedActiveRunStop({
    driverUserId,
    runId,
    stopId,
}: {
    driverUserId: string;
    runId: string;
    stopId: number;
}) {
    const stop = await storage().query.deliveryRunStops.findFirst({
        where: and(
            eq(deliveryRunStops.id, stopId),
            eq(deliveryRunStops.runId, runId),
        ),
        with: { run: true },
    });

    if (
        !stop ||
        stop.run.driverUserId !== driverUserId ||
        stop.run.state !== DeliveryRunStates.ACTIVE
    ) {
        throw new Error('Active delivery stop not found');
    }

    if (stop.state !== DeliveryRunStopStates.DELIVERED) {
        const currentStop = await storage().query.deliveryRunStops.findFirst({
            columns: { id: true },
            where: and(
                eq(deliveryRunStops.runId, runId),
                ne(deliveryRunStops.state, DeliveryRunStopStates.DELIVERED),
            ),
            orderBy: [asc(deliveryRunStops.sequence)],
        });
        if (currentStop?.id !== stopId) {
            throw new Error('Delivery stops must be completed in route order');
        }
    }

    return stop;
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
    const stop = await ensureOwnedActiveRunStop({
        driverUserId,
        runId,
        stopId,
    });

    if (stop.state === DeliveryRunStopStates.DELIVERED) {
        return stop;
    }

    const rows = await storage()
        .update(deliveryRunStops)
        .set({
            state: DeliveryRunStopStates.ARRIVED,
            arrivedAt: stop.arrivedAt ?? new Date(),
        })
        .where(eq(deliveryRunStops.id, stopId))
        .returning();

    return rows[0] ?? stop;
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
    const stop = await ensureOwnedActiveRunStop({
        driverUserId,
        runId,
        stopId,
    });

    if (stop.state !== DeliveryRunStopStates.DELIVERED) {
        const now = new Date();
        await storage()
            .update(deliveryRunStops)
            .set({
                state: DeliveryRunStopStates.DELIVERED,
                arrivedAt: stop.arrivedAt ?? now,
                deliveredAt: now,
            })
            .where(eq(deliveryRunStops.id, stopId));
    }

    const remaining = await storage().query.deliveryRunStops.findFirst({
        columns: { id: true },
        where: and(
            eq(deliveryRunStops.runId, runId),
            ne(deliveryRunStops.state, DeliveryRunStopStates.DELIVERED),
        ),
    });

    if (!remaining) {
        await storage()
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
            .where(eq(deliveryRuns.id, runId));
    }

    return stop.deliveryRequestId;
}
