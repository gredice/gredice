import { imageObservablePlantStatusTransitions } from '@gredice/js/plants';
import { validate as isUuid, version as uuidVersion } from 'uuid';
import {
    getScheduleTaskBlockReason,
    isScheduleTaskBlockReasonCode,
    knownEventTypes,
    type RaisedBedFieldPlantPurchase,
    type RaisedBedFieldSowingLocation,
    type RaisedBedPlantingLifecycleStartedPayload,
    type RaisedBedPlantingLifecycleStatus,
    raisedBedPlantingLifecycleStatuses,
    type ScheduleTaskBlockDetails,
} from '../repositories/events';
import {
    getPreviousPlantStatusChangedAtForUpdate,
    isPlantStatusEffectiveDateAllowed,
} from './plantStatusChronology';

export const selectedRaisedBedPlantingEventTypes = [
    knownEventTypes.raisedBedPlantings.lifecycleStarted,
    knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
    knownEventTypes.raisedBedPlantings.taskScheduled,
    knownEventTypes.raisedBedPlantings.taskAssigned,
    knownEventTypes.raisedBedPlantings.taskBlocked,
    knownEventTypes.raisedBedPlantings.taskCompleted,
    knownEventTypes.raisedBedPlantings.taskVerified,
    knownEventTypes.raisedBedPlantings.taskCancelled,
] as const;

const selectedRaisedBedPlantingEventTypeSet = new Set<string>(
    selectedRaisedBedPlantingEventTypes,
);
const stoppedButCollisionActiveStatuses =
    new Set<RaisedBedPlantingLifecycleStatus>([
        'died',
        'harvested',
        'notSprouted',
    ]);

export type SelectedRaisedBedPlantingEvent = {
    id: number;
    type: string;
    version: number;
    aggregateId: string;
    data: unknown;
    createdAt: Date;
};

export type SelectedRaisedBedPlantingTaskIdentity = {
    kind: 'selected';
    plantingId: number;
    expectedLifecycleVersionEventId: number;
    expectedPlantSortId: number;
};

export type SelectedRaisedBedPlantingTaskStatus =
    | 'planned'
    | 'blocked'
    | 'pendingVerification'
    | 'completed'
    | 'cancelled';

export type SelectedRaisedBedPlantingTaskCompletion = {
    eventId: number;
    completedAt: Date;
    completedBy: string;
    images: string[];
    notes?: string;
    status: 'pendingVerification' | 'sowed';
};

export type SelectedRaisedBedPlantingTaskVerification = {
    eventId: number;
    verifiedAt: Date;
    verifiedBy: string;
};

export type SelectedRaisedBedPlantingTaskCancellation = {
    eventId: number;
    cancelledAt: Date;
    cancelledBy: string;
    refundSunflowerAmount: number;
    reason: string;
};

export type SelectedRaisedBedPlantingTaskReadModel = {
    identity: SelectedRaisedBedPlantingTaskIdentity;
    status: SelectedRaisedBedPlantingTaskStatus;
    scheduledDate: string | null;
    sowingLocation: RaisedBedFieldSowingLocation;
    purchase?: RaisedBedFieldPlantPurchase;
    startedBy: string;
    initialCommandId: string;
    initialScheduledDate: string | null;
    initialSowingLocation: RaisedBedFieldSowingLocation;
    assignedUserIds: string[];
    assignedBy: string | null;
    assignedAt: Date | null;
    block: ScheduleTaskBlockDetails | null;
    completion: SelectedRaisedBedPlantingTaskCompletion | null;
    verification: SelectedRaisedBedPlantingTaskVerification | null;
    cancellation: SelectedRaisedBedPlantingTaskCancellation | null;
};

export type SelectedRaisedBedPlantingLifecycleProjection = {
    aggregateId: string;
    plantingId: number;
    plantSortId: number;
    status: RaisedBedPlantingLifecycleStatus;
    isActive: boolean;
    startedAt: Date;
    stoppedAt: Date | null;
    statusEventId: number;
    versionEventId: number;
    statusChanges: Array<{
        eventId: number;
        occurredAt: Date;
        status: RaisedBedPlantingLifecycleStatus;
    }>;
    initial: RaisedBedPlantingLifecycleStartedPayload;
    task: SelectedRaisedBedPlantingTaskReadModel;
};

export type SelectedRaisedBedPlantingLifecycleProjectionErrorCode =
    | 'duplicate_command_id'
    | 'duplicate_event_id'
    | 'identity_mismatch'
    | 'invalid_event'
    | 'invalid_transition'
    | 'missing_start_event'
    | 'multiple_start_events'
    | 'unsupported_event_version'
    | 'version_chain_mismatch';

export class SelectedRaisedBedPlantingLifecycleProjectionError extends Error {
    override readonly name =
        'SelectedRaisedBedPlantingLifecycleProjectionError';

    constructor(
        readonly code: SelectedRaisedBedPlantingLifecycleProjectionErrorCode,
        readonly eventId: number | null,
        message?: string,
    ) {
        super(
            message ??
                `Selected raised-bed planting lifecycle projection failed${eventId === null ? '' : ` for event ${eventId.toString()}`}: ${code}.`,
        );
    }
}

function projectionError(
    code: SelectedRaisedBedPlantingLifecycleProjectionErrorCode,
    eventId: number | null,
    message?: string,
): never {
    throw new SelectedRaisedBedPlantingLifecycleProjectionError(
        code,
        eventId,
        message,
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredRecord(value: unknown, eventId: number) {
    if (!isRecord(value)) {
        projectionError('invalid_event', eventId);
    }
    return value;
}

function requiredString(value: unknown, eventId: number) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        projectionError('invalid_event', eventId);
    }
    return value.trim();
}

function positiveSafeInteger(value: unknown, eventId: number) {
    if (!Number.isSafeInteger(value) || Number(value) <= 0) {
        projectionError('invalid_event', eventId);
    }
    return Number(value);
}

function commandId(value: unknown, eventId: number) {
    const normalized = requiredString(value, eventId).toLowerCase();
    if (!isUuid(normalized)) {
        projectionError('invalid_event', eventId);
    }
    const version = uuidVersion(normalized);
    if (version < 1 || version > 8) {
        projectionError('invalid_event', eventId);
    }
    return normalized;
}

function isoDate(value: unknown, eventId: number) {
    const raw = requiredString(value, eventId);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        projectionError('invalid_event', eventId);
    }
    return parsed.toISOString();
}

function optionalIsoDate(value: unknown, eventId: number) {
    return value === undefined ? undefined : isoDate(value, eventId);
}

function scheduledDate(value: unknown, eventId: number) {
    return value === null ? null : isoDate(value, eventId);
}

function sowingLocation(
    value: unknown,
    eventId: number,
): RaisedBedFieldSowingLocation {
    if (value !== 'direct' && value !== 'greenhouse') {
        projectionError('invalid_event', eventId);
    }
    return value;
}

function nonNegativeSafeInteger(value: unknown, eventId: number) {
    if (!Number.isSafeInteger(value) || Number(value) < 0) {
        projectionError('invalid_event', eventId);
    }
    return Number(value);
}

function purchase(
    value: unknown,
    eventId: number,
): RaisedBedFieldPlantPurchase | undefined {
    if (value === undefined) {
        return undefined;
    }
    const data = requiredRecord(value, eventId);
    const cartItemId = positiveSafeInteger(data.cartItemId, eventId);
    if (data.currency === 'inventory') {
        return { cartItemId, currency: 'inventory' };
    }
    if (data.currency === 'sunflower') {
        return {
            cartItemId,
            currency: 'sunflower',
            sunflowerAmount: nonNegativeSafeInteger(
                data.sunflowerAmount,
                eventId,
            ),
        };
    }
    if (data.currency === 'eur') {
        return {
            cartItemId,
            currency: 'eur',
            euroAmountCents: nonNegativeSafeInteger(
                data.euroAmountCents,
                eventId,
            ),
        };
    }
    projectionError('invalid_event', eventId);
}

function stringArray(value: unknown, eventId: number) {
    if (
        !Array.isArray(value) ||
        !value.every(
            (item) => typeof item === 'string' && item.trim().length > 0,
        )
    ) {
        projectionError('invalid_event', eventId);
    }
    const normalized = value.map((item) => item.trim());
    if (new Set(normalized).size !== normalized.length) {
        projectionError('invalid_event', eventId);
    }
    return normalized;
}

function optionalString(value: unknown, eventId: number) {
    return value === undefined ? undefined : requiredString(value, eventId);
}

function lifecycleStatus(
    value: unknown,
    eventId: number,
): RaisedBedPlantingLifecycleStatus {
    if (
        typeof value !== 'string' ||
        !raisedBedPlantingLifecycleStatuses.includes(
            value as RaisedBedPlantingLifecycleStatus,
        )
    ) {
        projectionError('invalid_event', eventId);
    }
    return value as RaisedBedPlantingLifecycleStatus;
}

function expectedVersion(
    value: unknown,
    event: SelectedRaisedBedPlantingEvent,
    currentVersionEventId: number,
) {
    const parsed = positiveSafeInteger(value, event.id);
    if (parsed !== currentVersionEventId) {
        projectionError('version_chain_mismatch', event.id);
    }
    return parsed;
}

function effectiveDate(
    effectiveAt: string | undefined,
    event: SelectedRaisedBedPlantingEvent,
) {
    return effectiveAt ? new Date(effectiveAt) : event.createdAt;
}

function taskIdentity(
    plantingId: number,
    plantSortId: number,
    versionEventId: number,
): SelectedRaisedBedPlantingTaskIdentity {
    return {
        kind: 'selected',
        plantingId,
        expectedLifecycleVersionEventId: versionEventId,
        expectedPlantSortId: plantSortId,
    };
}

function parseStartEvent(event: SelectedRaisedBedPlantingEvent) {
    const data = requiredRecord(event.data, event.id);
    if (data.status !== 'planned') {
        projectionError('invalid_event', event.id);
    }
    const parsed: RaisedBedPlantingLifecycleStartedPayload = {
        commandId: commandId(data.commandId, event.id),
        plantingId: positiveSafeInteger(data.plantingId, event.id),
        plantSortId: positiveSafeInteger(data.plantSortId, event.id),
        status: 'planned',
        scheduledDate: scheduledDate(data.scheduledDate, event.id),
        sowingLocation: sowingLocation(data.sowingLocation, event.id),
        ...(data.purchase === undefined
            ? {}
            : { purchase: purchase(data.purchase, event.id) }),
        startedBy: requiredString(data.startedBy, event.id),
    };
    return parsed;
}

function assertCanSchedule(
    taskStatus: SelectedRaisedBedPlantingTaskStatus,
    eventId: number,
) {
    if (taskStatus !== 'planned' && taskStatus !== 'blocked') {
        projectionError('invalid_transition', eventId);
    }
}

export function isSelectedRaisedBedPlantingStatusTransitionAllowed(
    currentStatus: RaisedBedPlantingLifecycleStatus,
    nextStatus: RaisedBedPlantingLifecycleStatus,
) {
    // Reactivating a removed multi-field planting must re-run geometry and
    // collision locks. This first contract deliberately keeps removal final;
    // a later reactivation feature needs that dedicated placement boundary.
    if (currentStatus === 'removed') {
        return nextStatus === 'removed';
    }
    return (
        currentStatus === nextStatus ||
        (imageObservablePlantStatusTransitions[currentStatus] ?? []).includes(
            nextStatus,
        )
    );
}

export function isSelectedRaisedBedPlantingEffectiveDateAllowed({
    currentDate,
    effectiveDate,
    nextStatus,
    projection,
}: {
    currentDate: Date;
    effectiveDate: Date;
    nextStatus: RaisedBedPlantingLifecycleStatus;
    projection: SelectedRaisedBedPlantingLifecycleProjection;
}) {
    const latestStatusChange = projection.statusChanges.at(-1) ?? null;
    return isPlantStatusEffectiveDateAllowed({
        currentDate,
        effectiveDate,
        plantCycleStartedAt: projection.startedAt,
        previousStatusChangedAt: getPreviousPlantStatusChangedAtForUpdate({
            currentStatus: projection.status,
            latestStatusChangedAt: latestStatusChange?.occurredAt ?? null,
            nextStatus,
            statusChanges: projection.statusChanges,
        }),
    });
}

/**
 * Reduces the selected planting's first-class event stream. Every command
 * event carries the immediately preceding event ID, making missing, reordered,
 * or out-of-band writes fail closed instead of silently changing task state.
 */
export function projectSelectedRaisedBedPlantingLifecycle(
    sourceEvents: readonly SelectedRaisedBedPlantingEvent[],
    expectedIdentity?: {
        aggregateId: string;
        plantingId: number;
        plantSortId: number;
    },
    options: { currentDate?: Date } = {},
): SelectedRaisedBedPlantingLifecycleProjection {
    const currentDate = options.currentDate ?? new Date();
    const relevantEvents = sourceEvents
        .filter((event) =>
            selectedRaisedBedPlantingEventTypeSet.has(event.type),
        )
        .sort((left, right) => left.id - right.id);
    const eventIds = new Set<number>();
    const commandIds = new Set<string>();
    for (const event of relevantEvents) {
        if (eventIds.has(event.id)) {
            projectionError('duplicate_event_id', event.id);
        }
        eventIds.add(event.id);
        if (event.version !== 1) {
            projectionError('unsupported_event_version', event.id);
        }
        if (
            expectedIdentity &&
            event.aggregateId !== expectedIdentity.aggregateId
        ) {
            projectionError('identity_mismatch', event.id);
        }
    }

    const startEvents = relevantEvents.filter(
        (event) =>
            event.type === knownEventTypes.raisedBedPlantings.lifecycleStarted,
    );
    const [startEvent] = startEvents;
    if (!startEvent) {
        projectionError('missing_start_event', null);
    }
    if (startEvents.length !== 1) {
        projectionError('multiple_start_events', startEvent.id);
    }
    if (relevantEvents[0]?.id !== startEvent.id) {
        projectionError('invalid_transition', startEvent.id);
    }

    const initial = parseStartEvent(startEvent);
    if (
        expectedIdentity &&
        (startEvent.aggregateId !== expectedIdentity.aggregateId ||
            initial.plantingId !== expectedIdentity.plantingId ||
            initial.plantSortId !== expectedIdentity.plantSortId)
    ) {
        projectionError('identity_mismatch', startEvent.id);
    }
    commandIds.add(initial.commandId);

    let projection: SelectedRaisedBedPlantingLifecycleProjection = {
        aggregateId: startEvent.aggregateId,
        plantingId: initial.plantingId,
        plantSortId: initial.plantSortId,
        status: 'planned',
        isActive: true,
        startedAt: startEvent.createdAt,
        stoppedAt: null,
        statusEventId: startEvent.id,
        versionEventId: startEvent.id,
        statusChanges: [
            {
                eventId: startEvent.id,
                occurredAt: startEvent.createdAt,
                status: 'planned',
            },
        ],
        initial,
        task: {
            identity: taskIdentity(
                initial.plantingId,
                initial.plantSortId,
                startEvent.id,
            ),
            status: 'planned',
            scheduledDate: initial.scheduledDate,
            sowingLocation: initial.sowingLocation,
            ...(initial.purchase ? { purchase: initial.purchase } : {}),
            startedBy: initial.startedBy,
            initialCommandId: initial.commandId,
            initialScheduledDate: initial.scheduledDate,
            initialSowingLocation: initial.sowingLocation,
            assignedUserIds: [],
            assignedBy: null,
            assignedAt: null,
            block: null,
            completion: null,
            verification: null,
            cancellation: null,
        },
    };

    for (const event of relevantEvents.slice(1)) {
        const data = requiredRecord(event.data, event.id);
        const persistedCommandId = commandId(data.commandId, event.id);
        if (commandIds.has(persistedCommandId)) {
            projectionError('duplicate_command_id', event.id);
        }
        commandIds.add(persistedCommandId);
        expectedVersion(
            data.expectedLifecycleVersionEventId,
            event,
            projection.versionEventId,
        );

        if (event.type === knownEventTypes.raisedBedPlantings.taskScheduled) {
            assertCanSchedule(projection.task.status, event.id);
            projection = {
                ...projection,
                versionEventId: event.id,
                task: {
                    ...projection.task,
                    status: 'planned',
                    scheduledDate: scheduledDate(data.scheduledDate, event.id),
                    sowingLocation: sowingLocation(
                        data.sowingLocation,
                        event.id,
                    ),
                    block: null,
                },
            };
            requiredString(data.scheduledBy, event.id);
        } else if (
            event.type === knownEventTypes.raisedBedPlantings.taskAssigned
        ) {
            assertCanSchedule(projection.task.status, event.id);
            projection = {
                ...projection,
                versionEventId: event.id,
                task: {
                    ...projection.task,
                    assignedUserIds: stringArray(
                        data.assignedUserIds,
                        event.id,
                    ),
                    assignedBy: requiredString(data.assignedBy, event.id),
                    assignedAt: event.createdAt,
                },
            };
        } else if (
            event.type === knownEventTypes.raisedBedPlantings.taskBlocked
        ) {
            if (projection.task.status !== 'planned') {
                projectionError('invalid_transition', event.id);
            }
            if (!isScheduleTaskBlockReasonCode(data.reasonCode)) {
                projectionError('invalid_event', event.id);
            }
            const reason = getScheduleTaskBlockReason(data.reasonCode);
            const note = optionalString(data.note, event.id);
            const images =
                data.images === undefined
                    ? undefined
                    : stringArray(data.images, event.id);
            projection = {
                ...projection,
                versionEventId: event.id,
                task: {
                    ...projection.task,
                    status: 'blocked',
                    block: {
                        blockedBy: requiredString(data.blockedBy, event.id),
                        reasonCode: reason.code,
                        reasonLabel: reason.label,
                        ...(note ? { note } : {}),
                        ...(images ? { images } : {}),
                        eventId: event.id,
                        blockedAt: event.createdAt,
                    },
                },
            };
        } else if (
            event.type === knownEventTypes.raisedBedPlantings.taskCompleted
        ) {
            if (projection.task.status !== 'planned') {
                projectionError('invalid_transition', event.id);
            }
            if (
                data.status !== 'pendingVerification' &&
                data.status !== 'sowed'
            ) {
                projectionError('invalid_event', event.id);
            }
            const notes = optionalString(data.notes, event.id);
            const completion: SelectedRaisedBedPlantingTaskCompletion = {
                eventId: event.id,
                completedAt: event.createdAt,
                completedBy: requiredString(data.completedBy, event.id),
                images: stringArray(data.images, event.id),
                ...(notes ? { notes } : {}),
                status: data.status,
            };
            projection = {
                ...projection,
                status: data.status,
                isActive: true,
                stoppedAt: null,
                statusEventId: event.id,
                versionEventId: event.id,
                statusChanges: [
                    ...projection.statusChanges,
                    {
                        eventId: event.id,
                        occurredAt: event.createdAt,
                        status: data.status,
                    },
                ],
                task: {
                    ...projection.task,
                    status:
                        data.status === 'sowed'
                            ? 'completed'
                            : 'pendingVerification',
                    block: null,
                    completion,
                },
            };
        } else if (
            event.type === knownEventTypes.raisedBedPlantings.taskVerified
        ) {
            if (
                projection.task.status !== 'pendingVerification' ||
                data.status !== 'sowed'
            ) {
                projectionError('invalid_transition', event.id);
            }
            projection = {
                ...projection,
                status: 'sowed',
                isActive: true,
                stoppedAt: null,
                statusEventId: event.id,
                versionEventId: event.id,
                statusChanges: [
                    ...projection.statusChanges,
                    {
                        eventId: event.id,
                        occurredAt: event.createdAt,
                        status: 'sowed',
                    },
                ],
                task: {
                    ...projection.task,
                    status: 'completed',
                    verification: {
                        eventId: event.id,
                        verifiedAt: event.createdAt,
                        verifiedBy: requiredString(data.verifiedBy, event.id),
                    },
                },
            };
        } else if (
            event.type ===
            knownEventTypes.raisedBedPlantings.lifecycleStatusChanged
        ) {
            const status = lifecycleStatus(data.status, event.id);
            if (status === 'cancelled' || status === 'pendingVerification') {
                projectionError('invalid_event', event.id);
            }
            if (
                !isSelectedRaisedBedPlantingStatusTransitionAllowed(
                    projection.status,
                    status,
                )
            ) {
                projectionError('invalid_transition', event.id);
            }
            requiredString(data.changedBy, event.id);
            const effectiveAt = optionalIsoDate(data.effectiveAt, event.id);
            const latestStatusChange = projection.statusChanges.at(-1);
            const occurredAt =
                status === projection.status && effectiveAt === undefined
                    ? (latestStatusChange?.occurredAt ?? event.createdAt)
                    : effectiveDate(effectiveAt, event);
            if (
                !isSelectedRaisedBedPlantingEffectiveDateAllowed({
                    currentDate,
                    effectiveDate: occurredAt,
                    nextStatus: status,
                    projection,
                })
            ) {
                projectionError('invalid_transition', event.id);
            }
            const isRemoved = status === 'removed';
            const isStoppedButActive =
                stoppedButCollisionActiveStatuses.has(status);
            projection = {
                ...projection,
                status,
                isActive: !isRemoved,
                stoppedAt: isRemoved || isStoppedButActive ? occurredAt : null,
                statusEventId: event.id,
                versionEventId: event.id,
                statusChanges: [
                    ...projection.statusChanges,
                    { eventId: event.id, occurredAt, status },
                ],
                task: {
                    ...projection.task,
                    status: status === 'planned' ? 'planned' : 'completed',
                    block: null,
                },
            };
        } else if (
            event.type === knownEventTypes.raisedBedPlantings.taskCancelled
        ) {
            assertCanSchedule(projection.task.status, event.id);
            if (data.status !== 'cancelled') {
                projectionError('invalid_event', event.id);
            }
            const cancelledBy = requiredString(data.cancelledBy, event.id);
            const refundSunflowerAmount = nonNegativeSafeInteger(
                data.refundSunflowerAmount,
                event.id,
            );
            const reason = requiredString(data.reason, event.id);
            const effectiveAt = optionalIsoDate(data.effectiveAt, event.id);
            const cancelledAt = effectiveDate(effectiveAt, event);
            if (
                !isSelectedRaisedBedPlantingEffectiveDateAllowed({
                    currentDate,
                    effectiveDate: cancelledAt,
                    nextStatus: 'cancelled',
                    projection,
                })
            ) {
                projectionError('invalid_transition', event.id);
            }
            projection = {
                ...projection,
                status: 'cancelled',
                isActive: false,
                stoppedAt: cancelledAt,
                statusEventId: event.id,
                versionEventId: event.id,
                statusChanges: [
                    ...projection.statusChanges,
                    {
                        eventId: event.id,
                        occurredAt: cancelledAt,
                        status: 'cancelled',
                    },
                ],
                task: {
                    ...projection.task,
                    status: 'cancelled',
                    block: null,
                    cancellation: {
                        eventId: event.id,
                        cancelledAt,
                        cancelledBy,
                        refundSunflowerAmount,
                        reason,
                    },
                },
            };
        } else {
            projectionError('invalid_event', event.id);
        }

        projection = {
            ...projection,
            task: {
                ...projection.task,
                identity: taskIdentity(
                    projection.plantingId,
                    projection.plantSortId,
                    event.id,
                ),
            },
        };
    }

    return projection;
}
