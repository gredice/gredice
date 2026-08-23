import {
    and,
    desc,
    eq,
    inArray,
    isNull,
    notInArray,
    or,
    sql,
} from 'drizzle-orm';
import 'server-only';
import {
    DeliveryRunExceptionReasons,
    DeliveryRunStates,
    DeliveryRunStopStates,
    deliveryRunSlots,
    deliveryRunStops,
    deliveryRuns,
    events,
} from '../schema';
import type { storage } from '../storage';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];

export const DeliveryRunAssignmentErrorCodes = {
    ACTIVE_ASSIGNMENT_EXISTS: 'active-delivery-assignment-exists',
} as const;

export type DeliveryRunAssignmentErrorCode =
    (typeof DeliveryRunAssignmentErrorCodes)[keyof typeof DeliveryRunAssignmentErrorCodes];

export class DeliveryRunAssignmentError extends Error {
    override name = 'DeliveryRunAssignmentError';

    constructor(
        readonly code: DeliveryRunAssignmentErrorCode,
        message: string,
    ) {
        super(message);
    }
}

const activelyAssignedStopStates = [
    DeliveryRunStopStates.PENDING,
    DeliveryRunStopStates.ARRIVED,
    DeliveryRunStopStates.DEFERRED,
    DeliveryRunStopStates.FAILED,
];

const terminalStopStates = [
    DeliveryRunStopStates.DELIVERED,
    DeliveryRunStopStates.FAILED,
    DeliveryRunStopStates.CANCELLED,
];

function activeAssignmentError(resource: 'address' | 'slot' | 'request') {
    const label =
        resource === 'address'
            ? 'Delivery address'
            : resource === 'slot'
              ? 'Delivery time slot'
              : 'Delivery request';
    return new DeliveryRunAssignmentError(
        DeliveryRunAssignmentErrorCodes.ACTIVE_ASSIGNMENT_EXISTS,
        `${label} belongs to an active delivery run. Abandon or recover the assignment before changing it.`,
    );
}

export async function assertDeliveryAddressHasNoActiveAssignment(
    addressId: number,
    db: TransactionClient,
) {
    const assignment = await db
        .select({ id: deliveryRunStops.id })
        .from(deliveryRunStops)
        .innerJoin(deliveryRuns, eq(deliveryRunStops.runId, deliveryRuns.id))
        .where(
            and(
                or(
                    eq(deliveryRunStops.deliveryAddressId, addressId),
                    and(
                        isNull(deliveryRunStops.deliveryAddressId),
                        sql`(
                            select legacy_address_event.data->>'addressId'
                            from ${events} legacy_address_event
                            where legacy_address_event.aggregate_id = ${deliveryRunStops.deliveryRequestId}
                              and legacy_address_event.type in ('delivery.request.created', 'delivery.request.address.changed')
                            order by legacy_address_event.created_at desc, legacy_address_event.id desc
                            limit 1
                        ) = ${String(addressId)}`,
                    ),
                ),
                isNull(deliveryRunStops.releasedAt),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                inArray(deliveryRunStops.state, activelyAssignedStopStates),
            ),
        )
        .limit(1);
    if (assignment[0]) throw activeAssignmentError('address');
}

export async function assertDeliveryTimeSlotHasNoActiveAssignment(
    timeSlotId: number,
    db: TransactionClient,
) {
    const assignment = await db
        .select({ id: deliveryRunStops.id })
        .from(deliveryRunStops)
        .innerJoin(deliveryRuns, eq(deliveryRunStops.runId, deliveryRuns.id))
        .leftJoin(
            deliveryRunSlots,
            and(
                eq(deliveryRunStops.runId, deliveryRunSlots.runId),
                eq(deliveryRunStops.runSlotId, deliveryRunSlots.id),
            ),
        )
        .where(
            and(
                or(
                    eq(deliveryRunSlots.timeSlotId, timeSlotId),
                    and(
                        isNull(deliveryRunStops.runSlotId),
                        eq(deliveryRuns.timeSlotId, timeSlotId),
                    ),
                ),
                isNull(deliveryRunStops.releasedAt),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                inArray(deliveryRunStops.state, activelyAssignedStopStates),
            ),
        )
        .limit(1);
    if (assignment[0]) throw activeAssignmentError('slot');
}

export async function assertDeliveryRequestHasNoActiveAssignment(
    requestId: string,
    db: TransactionClient,
) {
    const assignment = await db
        .select({ id: deliveryRunStops.id })
        .from(deliveryRunStops)
        .innerJoin(deliveryRuns, eq(deliveryRunStops.runId, deliveryRuns.id))
        .where(
            and(
                eq(deliveryRunStops.deliveryRequestId, requestId),
                isNull(deliveryRunStops.releasedAt),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
                inArray(deliveryRunStops.state, activelyAssignedStopStates),
            ),
        )
        .limit(1);
    if (assignment[0]) throw activeAssignmentError('request');
}

export type CancelActiveDeliveryRunAssignmentResult = {
    runId: string;
    routeRevision: number;
    runCompleted: boolean;
} | null;

export async function cancelActiveDeliveryRunAssignment({
    requestId,
    occurredAt,
    recordedByUserId,
    db,
}: {
    requestId: string;
    occurredAt: Date;
    recordedByUserId?: string;
    db: TransactionClient;
}): Promise<CancelActiveDeliveryRunAssignmentResult> {
    const candidate = await db
        .select({ runId: deliveryRuns.id })
        .from(deliveryRunStops)
        .innerJoin(deliveryRuns, eq(deliveryRunStops.runId, deliveryRuns.id))
        .where(
            and(
                eq(deliveryRunStops.deliveryRequestId, requestId),
                isNull(deliveryRunStops.releasedAt),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
            ),
        )
        .orderBy(desc(deliveryRunStops.createdAt))
        .limit(1);
    const runId = candidate[0]?.runId;
    if (!runId) return null;

    await db.execute(
        sql`select ${deliveryRuns.id} from ${deliveryRuns} where ${deliveryRuns.id} = ${runId} for update`,
    );
    const stop = await db.query.deliveryRunStops.findFirst({
        where: and(
            eq(deliveryRunStops.runId, runId),
            eq(deliveryRunStops.deliveryRequestId, requestId),
            isNull(deliveryRunStops.releasedAt),
        ),
    });
    if (!stop) return null;
    if (stop.state === DeliveryRunStopStates.DELIVERED) {
        throw new Error('Cannot cancel a fulfilled delivery request');
    }

    const [updatedStop] = await db
        .update(deliveryRunStops)
        .set({
            state: DeliveryRunStopStates.CANCELLED,
            deliveredAt: null,
            exceptionReason: DeliveryRunExceptionReasons.CANCELLATION,
            exceptionNote: null,
            exceptionOccurredAt: occurredAt,
            // Request cancellation audit data records the actor separately.
            // This FK is populated only after the caller verifies a users.id.
            exceptionRecordedByUserId: recordedByUserId ?? null,
            releasedAt: occurredAt,
        })
        .where(
            and(
                eq(deliveryRunStops.id, stop.id),
                eq(deliveryRunStops.runId, runId),
                isNull(deliveryRunStops.releasedAt),
            ),
        )
        .returning({ id: deliveryRunStops.id });
    if (!updatedStop) {
        throw new DeliveryRunAssignmentError(
            DeliveryRunAssignmentErrorCodes.ACTIVE_ASSIGNMENT_EXISTS,
            'Delivery assignment changed before cancellation could be recorded.',
        );
    }

    const [updatedRun] = await db
        .update(deliveryRuns)
        .set({
            routeRevision: sql`${deliveryRuns.routeRevision} + 1`,
            rerouteRequiredAt: occurredAt,
            rerouteAttemptedAt: null,
        })
        .where(
            and(
                eq(deliveryRuns.id, runId),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
            ),
        )
        .returning({ routeRevision: deliveryRuns.routeRevision });
    if (!updatedRun) return null;

    const unfinished = await db.query.deliveryRunStops.findFirst({
        columns: { id: true },
        where: and(
            eq(deliveryRunStops.runId, runId),
            notInArray(deliveryRunStops.state, terminalStopStates),
        ),
    });
    if (unfinished) {
        return {
            runId,
            routeRevision: updatedRun.routeRevision,
            runCompleted: false,
        };
    }

    await db
        .update(deliveryRunStops)
        .set({ releasedAt: occurredAt })
        .where(
            and(
                eq(deliveryRunStops.runId, runId),
                isNull(deliveryRunStops.releasedAt),
                inArray(deliveryRunStops.state, terminalStopStates),
            ),
        );
    await db
        .update(deliveryRuns)
        .set({
            state: DeliveryRunStates.COMPLETED,
            completedAt: occurredAt,
            rerouteRequiredAt: null,
            rerouteAttemptedAt: null,
            currentLatitude: null,
            currentLongitude: null,
            currentLocationAccuracy: null,
            currentLocationHeading: null,
            currentLocationSpeed: null,
            currentLocationRecordedAt: null,
            currentLocationReceivedAt: null,
        })
        .where(
            and(
                eq(deliveryRuns.id, runId),
                eq(deliveryRuns.state, DeliveryRunStates.ACTIVE),
            ),
        );
    return {
        runId,
        routeRevision: updatedRun.routeRevision,
        runCompleted: true,
    };
}
