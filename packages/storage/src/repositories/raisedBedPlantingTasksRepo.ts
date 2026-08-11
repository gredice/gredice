import 'server-only';

import { userAllowedPlantStatusTransitions } from '@gredice/js/plants';
import { getRaisedBedCloseupUrl } from '@gredice/js/urls';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { validate as isUuid, version as uuidVersion } from 'uuid';
import type { EntityStandardized } from '../@types/EntityStandardized';
import {
    isSelectedRaisedBedPlantingEffectiveDateAllowed,
    isSelectedRaisedBedPlantingStatusTransitionAllowed,
    projectSelectedRaisedBedPlantingLifecycle,
    type SelectedRaisedBedPlantingEvent,
    type SelectedRaisedBedPlantingLifecycleProjection,
    type SelectedRaisedBedPlantingTaskReadModel,
    selectedRaisedBedPlantingEventTypes,
} from '../helpers/selectedRaisedBedPlantingLifecycle';
import {
    accountUsers,
    events,
    farms,
    farmUsers,
    gardens,
    raisedBedPlantings,
    raisedBeds,
    users,
} from '../schema';
import { storage } from '../storage';
import { earnSunflowersOnce } from './accountsRepo';
import { getEntityFormatted } from './entitiesRepo';
import {
    createEvent,
    type Event,
    getEventById,
    getScheduleTaskBlockReason,
    isScheduleTaskBlockReasonCode,
    knownEvents,
    knownEventTypes,
    type RaisedBedFieldSowingLocation,
    type RaisedBedPlantingEventsPayload,
    type RaisedBedPlantingLifecycleStatus,
    raisedBedPlantingLifecycleStatuses,
    type ScheduleTaskBlockReasonCode,
} from './events';
import { normalizeAssignedUserIds } from './events/normalizeAssignedUserIds';
import {
    isDiaryRescheduleDateAllowed,
    startOfUtcDay,
} from './gardenDiaryRescheduleRepo';
import { createNotificationWithStatus } from './notificationsRepo';
import { getRaisedBedPlanting } from './raisedBedPlantingsRepo';
import {
    type ScheduleTaskActor,
    ScheduleTaskSubmissionError,
} from './scheduleTaskSubmissionsRepo';
import {
    type ScheduleTaskTransaction,
    withSelectedRaisedBedPlantingScheduleTaskTransaction,
} from './scheduleTaskTransactionsRepo';

const maxTaskNoteLength = 2000;
const maxCompletionImageCount = 20;
const maxBlockImageCount = 5;
const mutableLifecycleStatusSet = new Set<string>(
    raisedBedPlantingLifecycleStatuses.filter(
        (status) => status !== 'cancelled' && status !== 'pendingVerification',
    ),
);
const ownerRemovalSourceStatuses = new Set<RaisedBedPlantingLifecycleStatus>([
    'notSprouted',
    'died',
    'harvested',
]);

export type SelectedRaisedBedPlantingTaskCommandIdentity = {
    kind: 'selected';
    plantingId: number;
    expectedLifecycleVersionEventId: number;
    expectedPlantSortId: number;
};

type SelectedRaisedBedPlantingTaskCommandBase =
    SelectedRaisedBedPlantingTaskCommandIdentity & {
        actor: ScheduleTaskActor;
        commandId: string;
    };

export type SelectedRaisedBedPlantingTaskMutationResult = {
    kind: 'selectedPlantingTask';
    plantingId: number;
    eventId: number;
    occurredAt: Date;
    created: boolean;
    lifecycleStatus: RaisedBedPlantingLifecycleStatus;
    lifecycleStoppedAt: Date | null;
    isActive: boolean;
    task: SelectedRaisedBedPlantingTaskReadModel;
};

export type EnsureSelectedRaisedBedPlantingSowedNotificationInput = Pick<
    SelectedRaisedBedPlantingTaskMutationResult,
    'eventId' | 'plantingId'
>;

export type EnsureSelectedRaisedBedPlantingSowedNotificationResult = {
    notificationId: string;
    created: boolean;
};

export type AssignSelectedRaisedBedPlantingTaskInput =
    SelectedRaisedBedPlantingTaskCommandBase & {
        assignedUserIds: readonly string[];
    };

export type RescheduleSelectedRaisedBedPlantingTaskInput =
    SelectedRaisedBedPlantingTaskCommandBase & {
        scheduledDate: string | null;
        sowingLocation: RaisedBedFieldSowingLocation;
    };

export type CancelSelectedRaisedBedPlantingTaskInput =
    SelectedRaisedBedPlantingTaskCommandBase & {
        effectiveAt?: string;
        reason: string;
    };

export type CompleteSelectedRaisedBedPlantingTaskInput =
    SelectedRaisedBedPlantingTaskCommandBase & {
        imageUrls?: readonly string[];
        notes?: string | null;
    };

export type BlockSelectedRaisedBedPlantingTaskInput =
    SelectedRaisedBedPlantingTaskCommandBase & {
        imageUrls?: readonly string[];
        note?: string | null;
        reasonCode: ScheduleTaskBlockReasonCode;
    };

export type VerifySelectedRaisedBedPlantingTaskInput =
    SelectedRaisedBedPlantingTaskCommandBase;

export type UpdateSelectedRaisedBedPlantingLifecycleStatusInput =
    SelectedRaisedBedPlantingTaskCommandBase & {
        effectiveAt?: string;
        status: Exclude<
            RaisedBedPlantingLifecycleStatus,
            'cancelled' | 'pendingVerification'
        >;
    };

export type SelectedRaisedBedPlantingOwner = {
    accountId: string;
    userId: string;
};

type SelectedRaisedBedPlantingOwnerCommandBase =
    SelectedRaisedBedPlantingTaskCommandIdentity & {
        owner: SelectedRaisedBedPlantingOwner;
        commandId: string;
    };

export type RescheduleSelectedRaisedBedPlantingTaskForOwnerInput =
    SelectedRaisedBedPlantingOwnerCommandBase & {
        scheduledDate: string;
        sowingLocation: RaisedBedFieldSowingLocation;
    };

export type CancelSelectedRaisedBedPlantingTaskForOwnerInput =
    SelectedRaisedBedPlantingOwnerCommandBase & {
        effectiveAt?: string;
        reason: string;
    };

export type UpdateSelectedRaisedBedPlantingLifecycleStatusForOwnerInput =
    SelectedRaisedBedPlantingOwnerCommandBase & {
        effectiveAt?: string;
        status: Exclude<
            RaisedBedPlantingLifecycleStatus,
            'cancelled' | 'pendingVerification'
        >;
    };

type SelectedPlantingContext = {
    accountId: string;
    eventAggregateId: string;
    farmId: number;
    isActive: boolean;
    plantingId: number;
    plantSortId: number;
    raisedBedStatus: string;
};

type NormalizedSelectedPlantingCommandIdentity = {
    kind: 'selected';
    plantingId: number;
    expectedLifecycleVersionEventId: number;
    expectedPlantSortId: number;
    commandId: string;
};

type AuthorizedSelectedPlanting = Awaited<
    ReturnType<typeof getAuthorizedSelectedPlanting>
>;

function invalidInput(message: string): never {
    throw new ScheduleTaskSubmissionError('invalid_input', message);
}

function positiveSafeInteger(value: number, label: string) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        invalidInput(`${label} mora biti pozitivan cijeli broj.`);
    }
    return value;
}

function normalizeActor(actor: ScheduleTaskActor) {
    if (
        !actor ||
        (actor.role !== 'admin' && actor.role !== 'farmer') ||
        typeof actor.userId !== 'string' ||
        actor.userId.trim().length === 0
    ) {
        invalidInput('Izvršitelj zadatka nije ispravan.');
    }
    return { userId: actor.userId.trim(), role: actor.role };
}

function normalizeCommandId(value: string) {
    if (typeof value !== 'string') {
        invalidInput('ID naredbe nije ispravan.');
    }
    const normalized = value.trim().toLowerCase();
    if (!isUuid(normalized)) {
        invalidInput('ID naredbe nije ispravan.');
    }
    const version = uuidVersion(normalized);
    if (version < 1 || version > 8) {
        invalidInput('ID naredbe nije ispravan.');
    }
    return normalized;
}

function normalizeIdentity(input: SelectedRaisedBedPlantingTaskCommandBase) {
    if (input.kind !== 'selected') {
        invalidInput('Vrsta identiteta zadatka nije ispravna.');
    }
    return {
        kind: 'selected' as const,
        plantingId: positiveSafeInteger(input.plantingId, 'ID sijanja'),
        expectedLifecycleVersionEventId: positiveSafeInteger(
            input.expectedLifecycleVersionEventId,
            'Verzija životnog ciklusa',
        ),
        expectedPlantSortId: positiveSafeInteger(
            input.expectedPlantSortId,
            'ID sorte biljke',
        ),
        actor: normalizeActor(input.actor),
        commandId: normalizeCommandId(input.commandId),
    };
}

function normalizeOwner(owner: SelectedRaisedBedPlantingOwner) {
    if (
        !owner ||
        typeof owner.accountId !== 'string' ||
        owner.accountId.trim().length === 0 ||
        typeof owner.userId !== 'string' ||
        owner.userId.trim().length === 0
    ) {
        invalidInput('Vlasnik sijanja nije ispravan.');
    }
    return {
        accountId: owner.accountId.trim(),
        userId: owner.userId.trim(),
    };
}

function normalizeOwnerIdentity(
    input: SelectedRaisedBedPlantingOwnerCommandBase,
) {
    if (input.kind !== 'selected') {
        invalidInput('Vrsta identiteta zadatka nije ispravna.');
    }
    return {
        kind: 'selected' as const,
        plantingId: positiveSafeInteger(input.plantingId, 'ID sijanja'),
        expectedLifecycleVersionEventId: positiveSafeInteger(
            input.expectedLifecycleVersionEventId,
            'Verzija životnog ciklusa',
        ),
        expectedPlantSortId: positiveSafeInteger(
            input.expectedPlantSortId,
            'ID sorte biljke',
        ),
        commandId: normalizeCommandId(input.commandId),
        owner: normalizeOwner(input.owner),
    };
}

function normalizeIsoDate(value: string, label: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        invalidInput(`${label} nije ispravan.`);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        invalidInput(`${label} nije ispravan.`);
    }
    return parsed.toISOString();
}

function normalizeLifecycleStatusChangeTarget(value: unknown) {
    if (typeof value !== 'string' || !mutableLifecycleStatusSet.has(value)) {
        invalidInput('Stanje životnog ciklusa nije ispravno.');
    }
    return value as Exclude<
        RaisedBedPlantingLifecycleStatus,
        'cancelled' | 'pendingVerification'
    >;
}

function normalizeOwnerScheduledDate(value: string) {
    return startOfUtcDay(
        new Date(normalizeIsoDate(value, 'Datum sijanja')),
    ).toISOString();
}

function isOwnerLifecycleStatusTransitionAllowed(
    currentStatus: RaisedBedPlantingLifecycleStatus,
    nextStatus: RaisedBedPlantingLifecycleStatus,
) {
    if (nextStatus === 'removed') {
        return ownerRemovalSourceStatuses.has(currentStatus);
    }
    return (userAllowedPlantStatusTransitions[currentStatus] ?? []).includes(
        nextStatus,
    );
}

function assertOwnerCanCancelScheduledTask(
    task: SelectedRaisedBedPlantingTaskReadModel,
    referenceDate: Date,
) {
    const scheduledDate = task.scheduledDate
        ? new Date(task.scheduledDate)
        : null;
    if (
        !scheduledDate ||
        Number.isNaN(scheduledDate.getTime()) ||
        !isDiaryRescheduleDateAllowed(scheduledDate, referenceDate)
    ) {
        throw new ScheduleTaskSubmissionError(
            'invalid_status',
            'Moguće je otkazati samo sijanje zakazano za budući datum.',
        );
    }
}

function normalizeOptionalNote(value: string | null | undefined) {
    if (value == null) {
        return undefined;
    }
    if (typeof value !== 'string') {
        invalidInput('Napomena nije ispravna.');
    }
    const normalized = value.trim();
    if (!normalized) {
        return undefined;
    }
    if (normalized.length > maxTaskNoteLength) {
        invalidInput(
            `Napomena može imati najviše ${maxTaskNoteLength.toString()} znakova.`,
        );
    }
    return normalized;
}

function normalizeImageUrls(
    values: readonly string[] | undefined,
    maximum: number,
) {
    if (values !== undefined && !Array.isArray(values)) {
        invalidInput('Fotografije nisu ispravne.');
    }
    const normalized = Array.from(
        new Set(
            (values ?? []).map((value) => {
                if (typeof value !== 'string') {
                    invalidInput('Fotografije nisu ispravne.');
                }
                return value.trim();
            }),
        ),
    ).filter(Boolean);
    if (normalized.length > maximum) {
        invalidInput(`Možeš dodati najviše ${maximum.toString()} fotografija.`);
    }
    return normalized;
}

function normalizeAssignedUserIdsForCommand(userIds: readonly string[]) {
    if (!Array.isArray(userIds)) {
        invalidInput('Dodijeljeni korisnici nisu ispravni.');
    }
    const trimmed = userIds.map((userId) => {
        if (typeof userId !== 'string' || userId.trim().length === 0) {
            invalidInput('Dodijeljeni korisnici nisu ispravni.');
        }
        return userId.trim();
    });
    return normalizeAssignedUserIds(trimmed, undefined).sort();
}

function normalizeReason(value: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        invalidInput('Razlog otkazivanja je obavezan.');
    }
    const normalized = value.trim();
    if (normalized.length > maxTaskNoteLength) {
        invalidInput(
            `Razlog može imati najviše ${maxTaskNoteLength.toString()} znakova.`,
        );
    }
    return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function jsonComparable(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(jsonComparable);
    }
    if (!isRecord(value)) {
        return value;
    }
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
        if (value[key] !== undefined) {
            normalized[key] = jsonComparable(value[key]);
        }
    }
    return normalized;
}

function sameJsonValue(left: unknown, right: unknown) {
    return (
        JSON.stringify(jsonComparable(left)) ===
        JSON.stringify(jsonComparable(right))
    );
}

function isCanonicalSelectedPlantingSowedEvent(event: {
    data: unknown;
    type: string;
}) {
    return (
        (event.type === knownEventTypes.raisedBedPlantings.taskCompleted ||
            event.type === knownEventTypes.raisedBedPlantings.taskVerified) &&
        isRecord(event.data) &&
        event.data.status === 'sowed'
    );
}

function formatSelectedPlantingFootprintPositions(
    positionIndexes: readonly number[],
) {
    const positions = Array.from(
        new Set(positionIndexes.map((positionIndex) => positionIndex + 1)),
    ).sort((left, right) => left - right);
    if (positions.length === 0) {
        throw new Error(
            'Selected planting sowing notification has no footprint positions.',
        );
    }
    if (positions.length === 1) {
        return `na polju **${positions.join('')}**`;
    }
    const lastPosition = positions.slice(-1).join('');
    const precedingPositions = positions.slice(0, -1).join(', ');
    return `na poljima **${precedingPositions} i ${lastPosition}**`;
}

function escapeNotificationMarkdown(value: string) {
    return value.replace(/([\\`*_[\]{}()<>#+\-.!|])/g, '\\$1');
}

async function assertCurrentActor(
    transaction: ScheduleTaskTransaction,
    actor: ScheduleTaskActor,
) {
    const [user] = await transaction
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, actor.userId))
        .limit(1)
        .for('share');
    if (!user || user.role !== actor.role) {
        throw new ScheduleTaskSubmissionError(
            'not_authorized',
            'Tvoja se ovlast promijenila. Osvježi stranicu i pokušaj ponovno.',
        );
    }
}

async function lockFarmUserMemberships(
    transaction: ScheduleTaskTransaction,
    farmId: number,
    userIds: readonly string[],
) {
    const uniqueUserIds = Array.from(new Set(userIds));
    if (uniqueUserIds.length === 0) {
        return [];
    }
    const memberships = await transaction
        .select({ userId: farmUsers.userId })
        .from(farmUsers)
        .innerJoin(users, eq(farmUsers.userId, users.id))
        .where(
            and(
                eq(farmUsers.farmId, farmId),
                inArray(farmUsers.userId, uniqueUserIds),
            ),
        )
        .for('key share', { of: farmUsers });
    return Array.from(new Set(memberships.map((row) => row.userId))).sort();
}

async function getSelectedPlantingContext(
    transaction: ScheduleTaskTransaction,
    plantingId: number,
) {
    const [context] = await transaction
        .select({
            accountId: gardens.accountId,
            eventAggregateId: raisedBedPlantings.eventAggregateId,
            farmId: gardens.farmId,
            isActive: raisedBedPlantings.isActive,
            plantingId: raisedBedPlantings.id,
            plantSortId: raisedBedPlantings.plantSortId,
            raisedBedStatus: raisedBeds.status,
        })
        .from(raisedBedPlantings)
        .innerJoin(
            raisedBeds,
            eq(raisedBedPlantings.raisedBedId, raisedBeds.id),
        )
        .innerJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
        .innerJoin(farms, eq(gardens.farmId, farms.id))
        .where(
            and(
                eq(raisedBedPlantings.id, plantingId),
                eq(raisedBedPlantings.configurationSource, 'selected'),
                eq(raisedBedPlantings.isDeleted, false),
                eq(raisedBeds.isDeleted, false),
                eq(gardens.isDeleted, false),
                eq(gardens.isSandbox, false),
                eq(farms.isDeleted, false),
            ),
        )
        .limit(1);
    if (!context) {
        throw new ScheduleTaskSubmissionError(
            'not_found',
            'Odabrano sijanje nije pronađeno.',
        );
    }
    return context;
}

function selectedPlantingSunflowerRefundAmount(
    purchase: SelectedRaisedBedPlantingTaskReadModel['purchase'],
) {
    if (!purchase || purchase.currency === 'inventory') {
        return 0;
    }
    const amount =
        purchase.currency === 'sunflower'
            ? purchase.sunflowerAmount
            : purchase.euroAmountCents * 10;
    if (!Number.isSafeInteger(amount) || amount < 0) {
        throw new ScheduleTaskSubmissionError(
            'invalid_status',
            'Spremljeni iznos kupnje nije moguće sigurno vratiti.',
        );
    }
    return amount;
}

async function getAuthorizedSelectedPlanting(
    transaction: ScheduleTaskTransaction,
    actor: ScheduleTaskActor,
    plantingId: number,
) {
    await assertCurrentActor(transaction, actor);
    const context = await getSelectedPlantingContext(transaction, plantingId);
    if (actor.role === 'farmer') {
        const memberships = await lockFarmUserMemberships(
            transaction,
            context.farmId,
            [actor.userId],
        );
        if (!memberships.includes(actor.userId)) {
            throw new ScheduleTaskSubmissionError(
                'not_authorized',
                'Nemaš dozvolu za ovaj zadatak sijanja.',
            );
        }
    }
    const planting = await getRaisedBedPlanting(plantingId, transaction);
    if (!planting?.selectedTask || planting.lifecycleStatus === null) {
        throw new ScheduleTaskSubmissionError(
            'not_found',
            'Odabrano sijanje nema aktivan ugovor zadatka.',
        );
    }
    return { context, planting, task: planting.selectedTask };
}

async function getOwnerAuthorizedSelectedPlanting(
    transaction: ScheduleTaskTransaction,
    owner: SelectedRaisedBedPlantingOwner,
    plantingId: number,
) {
    const [membership] = await transaction
        .select({ id: accountUsers.id })
        .from(accountUsers)
        .innerJoin(users, eq(accountUsers.userId, users.id))
        .where(
            and(
                eq(accountUsers.accountId, owner.accountId),
                eq(accountUsers.userId, owner.userId),
            ),
        )
        .limit(1)
        .for('key share', { of: accountUsers });
    if (!membership) {
        throw new ScheduleTaskSubmissionError(
            'not_authorized',
            'Nemaš dozvolu za ovo sijanje.',
        );
    }
    const context = await getSelectedPlantingContext(transaction, plantingId);
    if (context.accountId !== owner.accountId) {
        throw new ScheduleTaskSubmissionError(
            'not_authorized',
            'Nemaš dozvolu za ovo sijanje.',
        );
    }
    const planting = await getRaisedBedPlanting(plantingId, transaction);
    if (!planting?.selectedTask || planting.lifecycleStatus === null) {
        throw new ScheduleTaskSubmissionError(
            'not_found',
            'Odabrano sijanje nema aktivan ugovor zadatka.',
        );
    }
    return { context, planting, task: planting.selectedTask };
}

function assertAdmin(actor: ScheduleTaskActor) {
    if (actor.role !== 'admin') {
        throw new ScheduleTaskSubmissionError(
            'not_authorized',
            'Samo administrator može izvršiti ovu radnju.',
        );
    }
}

function assertRaisedBedAvailable(context: SelectedPlantingContext) {
    if (context.raisedBedStatus === 'abandoned') {
        throw new ScheduleTaskSubmissionError(
            'invalid_status',
            'Zadatak na napuštenoj gredici više nije moguće mijenjati.',
        );
    }
}

function assertExpectedIdentity(
    context: SelectedPlantingContext,
    input: NormalizedSelectedPlantingCommandIdentity,
) {
    if (context.plantSortId !== input.expectedPlantSortId) {
        throw new ScheduleTaskSubmissionError(
            'task_changed',
            'Sijanje se u međuvremenu promijenilo. Osvježi zadatke i pokušaj ponovno.',
        );
    }
}

function assertExpectedVersion(
    task: SelectedRaisedBedPlantingTaskReadModel,
    input: NormalizedSelectedPlantingCommandIdentity,
) {
    if (
        task.identity.expectedLifecycleVersionEventId !==
        input.expectedLifecycleVersionEventId
    ) {
        throw new ScheduleTaskSubmissionError(
            'task_changed',
            'Zadatak sijanja je u međuvremenu promijenjen. Osvježi zadatke i pokušaj ponovno.',
        );
    }
}

function assertFarmerAssignment(
    task: SelectedRaisedBedPlantingTaskReadModel,
    actor: ScheduleTaskActor,
) {
    if (
        actor.role === 'farmer' &&
        task.assignedUserIds.length > 0 &&
        !task.assignedUserIds.includes(actor.userId)
    ) {
        throw new ScheduleTaskSubmissionError(
            'assignment_changed',
            'Ovo je sijanje u međuvremenu dodijeljeno drugom korisniku.',
        );
    }
}

async function loadSelectedPlantingEvents(
    transaction: ScheduleTaskTransaction,
    aggregateId: string,
) {
    return transaction
        .select()
        .from(events)
        .where(
            and(
                eq(events.aggregateId, aggregateId),
                inArray(events.type, [...selectedRaisedBedPlantingEventTypes]),
            ),
        )
        .orderBy(asc(events.id));
}

function eventCommandId(event: SelectedRaisedBedPlantingEvent) {
    const value = isRecord(event.data) ? event.data.commandId : undefined;
    return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

function mutationResult(
    projection: SelectedRaisedBedPlantingLifecycleProjection,
    event: Pick<SelectedRaisedBedPlantingEvent, 'id' | 'createdAt'>,
    created: boolean,
): SelectedRaisedBedPlantingTaskMutationResult {
    return {
        kind: 'selectedPlantingTask',
        plantingId: projection.plantingId,
        eventId: event.id,
        occurredAt: event.createdAt,
        created,
        lifecycleStatus: projection.status,
        lifecycleStoppedAt: projection.stoppedAt,
        isActive: projection.isActive,
        task: projection.task,
    };
}

async function executeAuthorizedSelectedPlantingCommand<
    Payload extends RaisedBedPlantingEventsPayload,
>(
    input: NormalizedSelectedPlantingCommandIdentity,
    payloadInput:
        | Payload
        | ((args: {
              context: SelectedPlantingContext;
              projection: SelectedRaisedBedPlantingLifecycleProjection;
              task: SelectedRaisedBedPlantingTaskReadModel;
          }) => Payload),
    eventFactory: (aggregateId: string, payload: Payload) => Event,
    validateCurrent: (args: {
        context: SelectedPlantingContext;
        projection: SelectedRaisedBedPlantingLifecycleProjection;
        task: SelectedRaisedBedPlantingTaskReadModel;
        transaction: ScheduleTaskTransaction;
    }) => Promise<void> | void,
    authorize: (
        transaction: ScheduleTaskTransaction,
        plantingId: number,
    ) => Promise<AuthorizedSelectedPlanting>,
    transaction?: ScheduleTaskTransaction,
) {
    return withSelectedRaisedBedPlantingScheduleTaskTransaction(
        input.plantingId,
        async (tx) => {
            const { context, task } = await authorize(tx, input.plantingId);
            assertExpectedIdentity(context, input);
            const sourceEvents = await loadSelectedPlantingEvents(
                tx,
                context.eventAggregateId,
            );
            const currentProjection = projectSelectedRaisedBedPlantingLifecycle(
                sourceEvents,
                {
                    aggregateId: context.eventAggregateId,
                    plantingId: context.plantingId,
                    plantSortId: context.plantSortId,
                },
            );
            const payload =
                typeof payloadInput === 'function'
                    ? payloadInput({
                          context,
                          projection: currentProjection,
                          task,
                      })
                    : payloadInput;
            const commandEvents = sourceEvents.filter(
                (event) => eventCommandId(event) === input.commandId,
            );
            if (commandEvents.length > 0) {
                const [commandEvent] = commandEvents;
                if (
                    commandEvents.length !== 1 ||
                    !commandEvent ||
                    !sameJsonValue(commandEvent.data, payload)
                ) {
                    throw new ScheduleTaskSubmissionError(
                        'submission_conflict',
                        'Ova je naredba već iskorištena s drukčijim podacima.',
                    );
                }
                return mutationResult(currentProjection, commandEvent, false);
            }

            assertExpectedVersion(task, input);
            await validateCurrent({
                context,
                projection: currentProjection,
                task,
                transaction: tx,
            });
            const event = await createEvent(
                eventFactory(context.eventAggregateId, payload),
                tx,
            );
            const nextProjection = projectSelectedRaisedBedPlantingLifecycle(
                [...sourceEvents, event],
                {
                    aggregateId: context.eventAggregateId,
                    plantingId: context.plantingId,
                    plantSortId: context.plantSortId,
                },
            );
            const [updated] = await tx
                .update(raisedBedPlantings)
                .set({ isActive: nextProjection.isActive })
                .where(
                    and(
                        eq(raisedBedPlantings.id, context.plantingId),
                        eq(raisedBedPlantings.isDeleted, false),
                    ),
                )
                .returning({ id: raisedBedPlantings.id });
            if (!updated) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Sijanje se u međuvremenu promijenilo. Osvježi zadatke i pokušaj ponovno.',
                );
            }
            return mutationResult(nextProjection, event, true);
        },
        transaction,
    );
}

function executeSelectedPlantingCommand<
    Payload extends RaisedBedPlantingEventsPayload,
>(
    input: ReturnType<typeof normalizeIdentity>,
    payloadInput:
        | Payload
        | ((args: {
              context: SelectedPlantingContext;
              projection: SelectedRaisedBedPlantingLifecycleProjection;
              task: SelectedRaisedBedPlantingTaskReadModel;
          }) => Payload),
    eventFactory: (aggregateId: string, payload: Payload) => Event,
    validateCurrent: (args: {
        context: SelectedPlantingContext;
        projection: SelectedRaisedBedPlantingLifecycleProjection;
        task: SelectedRaisedBedPlantingTaskReadModel;
        transaction: ScheduleTaskTransaction;
    }) => Promise<void> | void,
    transaction?: ScheduleTaskTransaction,
) {
    return executeAuthorizedSelectedPlantingCommand(
        input,
        payloadInput,
        eventFactory,
        validateCurrent,
        (tx, plantingId) =>
            getAuthorizedSelectedPlanting(tx, input.actor, plantingId),
        transaction,
    );
}

export async function getSelectedRaisedBedPlantingTask(plantingId: number) {
    const planting = await getRaisedBedPlanting(
        positiveSafeInteger(plantingId, 'ID sijanja'),
    );
    if (planting?.configurationSource !== 'selected') {
        return null;
    }
    return planting.selectedTask;
}

export async function getSelectedRaisedBedPlantingTaskForActor(
    input: { actor: ScheduleTaskActor; plantingId: number },
    transaction?: ScheduleTaskTransaction,
) {
    const actor = normalizeActor(input.actor);
    const plantingId = positiveSafeInteger(input.plantingId, 'ID sijanja');
    return withSelectedRaisedBedPlantingScheduleTaskTransaction(
        plantingId,
        async (tx) => {
            const { task } = await getAuthorizedSelectedPlanting(
                tx,
                actor,
                plantingId,
            );
            return task;
        },
        transaction,
    );
}

export async function getSelectedRaisedBedPlantingTaskForOwner(
    input: { owner: SelectedRaisedBedPlantingOwner; plantingId: number },
    transaction?: ScheduleTaskTransaction,
) {
    const owner = normalizeOwner(input.owner);
    const plantingId = positiveSafeInteger(input.plantingId, 'ID sijanja');
    return withSelectedRaisedBedPlantingScheduleTaskTransaction(
        plantingId,
        async (tx) => {
            const { task } = await getOwnerAuthorizedSelectedPlanting(
                tx,
                owner,
                plantingId,
            );
            return task;
        },
        transaction,
    );
}

export async function ensureSelectedRaisedBedPlantingSowedNotification(
    input: EnsureSelectedRaisedBedPlantingSowedNotificationInput,
): Promise<EnsureSelectedRaisedBedPlantingSowedNotificationResult> {
    const plantingId = positiveSafeInteger(input.plantingId, 'ID sijanja');
    const eventId = positiveSafeInteger(input.eventId, 'ID događaja');
    const [planting, event] = await Promise.all([
        getRaisedBedPlanting(plantingId),
        getEventById(eventId),
    ]);
    if (planting?.configurationSource !== 'selected') {
        throw new Error(
            'Selected planting sowing notification could not resolve its planting.',
        );
    }
    if (
        !event ||
        event.aggregateId !== planting.eventAggregateId ||
        !isCanonicalSelectedPlantingSowedEvent(event)
    ) {
        throw new Error(
            'Selected planting sowing notification requires a canonical sowed event.',
        );
    }

    const [routing] = await storage()
        .select({
            accountId: gardens.accountId,
            gardenId: gardens.id,
            raisedBedId: raisedBeds.id,
            raisedBedName: raisedBeds.name,
        })
        .from(raisedBeds)
        .innerJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
        .where(
            and(
                eq(raisedBeds.id, planting.raisedBedId),
                eq(raisedBeds.isDeleted, false),
                eq(gardens.isDeleted, false),
            ),
        )
        .limit(1);
    if (!routing) {
        throw new Error(
            'Selected planting sowing notification could not resolve its garden routing.',
        );
    }

    let plantName: string | null = null;
    try {
        const sortData = await getEntityFormatted<EntityStandardized>(
            planting.plantSortId,
        );
        const candidateName = sortData?.information?.name?.trim();
        plantName = candidateName ? candidateName : null;
    } catch {
        plantName = null;
    }
    if (!plantName) {
        console.warn(
            'Selected planting sowing notification is missing plant sort metadata.',
            {
                eventId,
                plantingId,
                plantSortId: planting.plantSortId,
            },
        );
    }

    const raisedBedName = routing.raisedBedName.trim();
    const escapedRaisedBedName = escapeNotificationMarkdown(raisedBedName);
    const escapedPlantName = plantName
        ? escapeNotificationMarkdown(plantName)
        : null;
    const footprintCopy = formatSelectedPlantingFootprintPositions(
        planting.memberships.map(
            (membership) => membership.raisedBedField.positionIndex,
        ),
    );
    return createNotificationWithStatus(
        {
            accountId: routing.accountId,
            gardenId: routing.gardenId,
            raisedBedId: routing.raisedBedId,
            header: escapedPlantName
                ? `Biljka ${plantName} je posijana!`
                : 'Biljka je posijana!',
            content: escapedPlantName
                ? `U gredici **${escapedRaisedBedName}** ${footprintCopy} posijana je biljka **${escapedPlantName}**.`
                : `U gredici **${escapedRaisedBedName}** ${footprintCopy} posijana je odabrana biljka.`,
            linkUrl: getRaisedBedCloseupUrl(raisedBedName),
            timestamp: event.createdAt,
        },
        {
            idempotencyKey: `selected-planting-sowed:${eventId.toString()}`,
        },
    );
}

export async function assignSelectedRaisedBedPlantingTask(
    input: AssignSelectedRaisedBedPlantingTaskInput,
    transaction?: ScheduleTaskTransaction,
) {
    const normalized = normalizeIdentity(input);
    assertAdmin(normalized.actor);
    const assignedUserIds = normalizeAssignedUserIdsForCommand(
        input.assignedUserIds,
    );
    const payload = {
        commandId: normalized.commandId,
        expectedLifecycleVersionEventId:
            normalized.expectedLifecycleVersionEventId,
        assignedBy: normalized.actor.userId,
        assignedUserIds,
    };
    return executeSelectedPlantingCommand(
        normalized,
        payload,
        (aggregateId) =>
            knownEvents.raisedBedPlantings.taskAssignedV1(aggregateId, payload),
        async ({ context, task, transaction: tx }) => {
            assertRaisedBedAvailable(context);
            if (task.status !== 'planned' && task.status !== 'blocked') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Dovršen ili otkazan zadatak sijanja nije moguće dodijeliti.',
                );
            }
            const memberships = await lockFarmUserMemberships(
                tx,
                context.farmId,
                assignedUserIds,
            );
            if (memberships.length !== assignedUserIds.length) {
                throw new ScheduleTaskSubmissionError(
                    'not_authorized',
                    'Jedan ili više odabranih korisnika više nisu članovi farme.',
                );
            }
        },
        transaction,
    );
}

export async function rescheduleSelectedRaisedBedPlantingTask(
    input: RescheduleSelectedRaisedBedPlantingTaskInput,
    transaction?: ScheduleTaskTransaction,
) {
    const normalized = normalizeIdentity(input);
    assertAdmin(normalized.actor);
    if (
        input.sowingLocation !== 'direct' &&
        input.sowingLocation !== 'greenhouse'
    ) {
        invalidInput('Mjesto sijanja nije ispravno.');
    }
    const payload = {
        commandId: normalized.commandId,
        expectedLifecycleVersionEventId:
            normalized.expectedLifecycleVersionEventId,
        scheduledBy: normalized.actor.userId,
        scheduledDate:
            input.scheduledDate === null
                ? null
                : normalizeIsoDate(input.scheduledDate, 'Datum sijanja'),
        sowingLocation: input.sowingLocation,
    };
    return executeSelectedPlantingCommand(
        normalized,
        payload,
        (aggregateId) =>
            knownEvents.raisedBedPlantings.taskScheduledV1(
                aggregateId,
                payload,
            ),
        ({ context, task }) => {
            assertRaisedBedAvailable(context);
            if (task.status !== 'planned' && task.status !== 'blocked') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Dovršen ili otkazan zadatak sijanja nije moguće premjestiti.',
                );
            }
        },
        transaction,
    );
}

export async function cancelSelectedRaisedBedPlantingTask(
    input: CancelSelectedRaisedBedPlantingTaskInput,
    transaction?: ScheduleTaskTransaction,
) {
    const normalized = normalizeIdentity(input);
    assertAdmin(normalized.actor);
    const effectiveAt = input.effectiveAt
        ? normalizeIsoDate(input.effectiveAt, 'Datum otkazivanja')
        : undefined;
    const reason = normalizeReason(input.reason);
    return executeSelectedPlantingCommand(
        normalized,
        ({ task }) => ({
            commandId: normalized.commandId,
            expectedLifecycleVersionEventId:
                normalized.expectedLifecycleVersionEventId,
            cancelledBy: normalized.actor.userId,
            ...(effectiveAt ? { effectiveAt } : {}),
            refundSunflowerAmount: selectedPlantingSunflowerRefundAmount(
                task.purchase,
            ),
            reason,
            status: 'cancelled' as const,
        }),
        (aggregateId, payload) =>
            knownEvents.raisedBedPlantings.taskCancelledV1(
                aggregateId,
                payload,
            ),
        async ({ context, projection, task, transaction: tx }) => {
            if (task.status !== 'planned' && task.status !== 'blocked') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Samo nedovršeno sijanje može biti otkazano.',
                );
            }
            const effectiveDate = effectiveAt
                ? new Date(effectiveAt)
                : new Date();
            if (
                !isSelectedRaisedBedPlantingEffectiveDateAllowed({
                    currentDate: new Date(),
                    effectiveDate,
                    nextStatus: 'cancelled',
                    projection,
                })
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_input',
                    'Datum otkazivanja mora biti između početka životnog ciklusa i današnjeg datuma.',
                );
            }
            const refundSunflowerAmount = selectedPlantingSunflowerRefundAmount(
                task.purchase,
            );
            if (refundSunflowerAmount > 0) {
                await earnSunflowersOnce(
                    context.accountId,
                    refundSunflowerAmount,
                    `refund:selectedRaisedBedPlanting:${context.plantingId.toString()}`,
                    tx,
                );
            }
        },
        transaction,
    );
}

export async function completeSelectedRaisedBedPlantingTask(
    input: CompleteSelectedRaisedBedPlantingTaskInput,
    transaction?: ScheduleTaskTransaction,
) {
    const normalized = normalizeIdentity(input);
    const notes = normalizeOptionalNote(input.notes);
    const payload = {
        commandId: normalized.commandId,
        expectedLifecycleVersionEventId:
            normalized.expectedLifecycleVersionEventId,
        completedBy: normalized.actor.userId,
        images: normalizeImageUrls(input.imageUrls, maxCompletionImageCount),
        ...(notes ? { notes } : {}),
        status:
            normalized.actor.role === 'admin'
                ? ('sowed' as const)
                : ('pendingVerification' as const),
    };
    return executeSelectedPlantingCommand(
        normalized,
        payload,
        (aggregateId) =>
            knownEvents.raisedBedPlantings.taskCompletedV1(
                aggregateId,
                payload,
            ),
        ({ context, task }) => {
            assertRaisedBedAvailable(context);
            if (task.status !== 'planned') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Zadatak sijanja više nije moguće dovršiti.',
                );
            }
            assertFarmerAssignment(task, normalized.actor);
        },
        transaction,
    );
}

export async function blockSelectedRaisedBedPlantingTask(
    input: BlockSelectedRaisedBedPlantingTaskInput,
    transaction?: ScheduleTaskTransaction,
) {
    const normalized = normalizeIdentity(input);
    if (!isScheduleTaskBlockReasonCode(input.reasonCode)) {
        invalidInput('Razlog blokade nije ispravan.');
    }
    const reason = getScheduleTaskBlockReason(input.reasonCode);
    const note = normalizeOptionalNote(input.note);
    if (
        (input.reasonCode === 'task_not_applicable' ||
            input.reasonCode === 'other') &&
        !note
    ) {
        invalidInput('Za odabrani razlog dodaj kratku napomenu.');
    }
    const images = normalizeImageUrls(input.imageUrls, maxBlockImageCount);
    const payload = {
        commandId: normalized.commandId,
        expectedLifecycleVersionEventId:
            normalized.expectedLifecycleVersionEventId,
        blockedBy: normalized.actor.userId,
        reasonCode: reason.code,
        reasonLabel: reason.label,
        ...(note ? { note } : {}),
        ...(images.length > 0 ? { images } : {}),
    };
    return executeSelectedPlantingCommand(
        normalized,
        payload,
        (aggregateId) =>
            knownEvents.raisedBedPlantings.taskBlockedV1(aggregateId, payload),
        ({ context, task }) => {
            assertRaisedBedAvailable(context);
            if (task.status !== 'planned') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Samo planirani zadatak sijanja može biti blokiran.',
                );
            }
            assertFarmerAssignment(task, normalized.actor);
        },
        transaction,
    );
}

export async function verifySelectedRaisedBedPlantingTask(
    input: VerifySelectedRaisedBedPlantingTaskInput,
    transaction?: ScheduleTaskTransaction,
) {
    const normalized = normalizeIdentity(input);
    assertAdmin(normalized.actor);
    const payload = {
        commandId: normalized.commandId,
        expectedLifecycleVersionEventId:
            normalized.expectedLifecycleVersionEventId,
        verifiedBy: normalized.actor.userId,
        status: 'sowed' as const,
    };
    return executeSelectedPlantingCommand(
        normalized,
        payload,
        (aggregateId) =>
            knownEvents.raisedBedPlantings.taskVerifiedV1(aggregateId, payload),
        ({ context, task }) => {
            assertRaisedBedAvailable(context);
            if (task.status !== 'pendingVerification') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Samo predano sijanje koje čeka provjeru može biti potvrđeno.',
                );
            }
        },
        transaction,
    );
}

export async function updateSelectedRaisedBedPlantingLifecycleStatus(
    input: UpdateSelectedRaisedBedPlantingLifecycleStatusInput,
    transaction?: ScheduleTaskTransaction,
) {
    const normalized = normalizeIdentity(input);
    assertAdmin(normalized.actor);
    const status = normalizeLifecycleStatusChangeTarget(input.status);
    const payload = {
        commandId: normalized.commandId,
        expectedLifecycleVersionEventId:
            normalized.expectedLifecycleVersionEventId,
        changedBy: normalized.actor.userId,
        ...(input.effectiveAt
            ? {
                  effectiveAt: normalizeIsoDate(
                      input.effectiveAt,
                      'Datum promjene stanja',
                  ),
              }
            : {}),
        status,
    };
    return executeSelectedPlantingCommand(
        normalized,
        payload,
        (aggregateId) =>
            knownEvents.raisedBedPlantings.lifecycleStatusChangedV1(
                aggregateId,
                payload,
            ),
        ({ context, projection, task }) => {
            if (status !== 'removed') {
                assertRaisedBedAvailable(context);
            }
            if (task.status === 'cancelled') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Otkazani zadatak ne podržava promjene životnog ciklusa.',
                );
            }
            if (
                !isSelectedRaisedBedPlantingStatusTransitionAllowed(
                    projection.status,
                    status,
                )
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    `Promjena stanja iz ${projection.status} u ${status} nije dopuštena.`,
                );
            }
            const currentDate = new Date();
            const effectiveDate = payload.effectiveAt
                ? new Date(payload.effectiveAt)
                : currentDate;
            if (
                !isSelectedRaisedBedPlantingEffectiveDateAllowed({
                    currentDate,
                    effectiveDate,
                    nextStatus: status,
                    projection,
                })
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_input',
                    'Datum stanja mora biti između početka životnog ciklusa, prethodne promjene stanja i današnjeg datuma.',
                );
            }
        },
        transaction,
    );
}

export async function rescheduleSelectedRaisedBedPlantingTaskForOwner(
    input: RescheduleSelectedRaisedBedPlantingTaskForOwnerInput,
    transaction?: ScheduleTaskTransaction,
) {
    const normalized = normalizeOwnerIdentity(input);
    if (
        input.sowingLocation !== 'direct' &&
        input.sowingLocation !== 'greenhouse'
    ) {
        invalidInput('Mjesto sijanja nije ispravno.');
    }
    const payload = {
        commandId: normalized.commandId,
        expectedLifecycleVersionEventId:
            normalized.expectedLifecycleVersionEventId,
        scheduledBy: normalized.owner.userId,
        scheduledDate: normalizeOwnerScheduledDate(input.scheduledDate),
        sowingLocation: input.sowingLocation,
    };
    return executeAuthorizedSelectedPlantingCommand(
        normalized,
        payload,
        (aggregateId) =>
            knownEvents.raisedBedPlantings.taskScheduledV1(
                aggregateId,
                payload,
            ),
        ({ context, task }) => {
            assertRaisedBedAvailable(context);
            if (task.status !== 'planned' && task.status !== 'blocked') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Dovršen ili otkazan zadatak sijanja nije moguće premjestiti.',
                );
            }
            if (
                !isDiaryRescheduleDateAllowed(
                    new Date(payload.scheduledDate),
                    new Date(),
                )
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_input',
                    'Datum sijanja mora biti sutra ili kasnije.',
                );
            }
        },
        (tx, plantingId) =>
            getOwnerAuthorizedSelectedPlanting(
                tx,
                normalized.owner,
                plantingId,
            ),
        transaction,
    );
}

export async function cancelSelectedRaisedBedPlantingTaskForOwner(
    input: CancelSelectedRaisedBedPlantingTaskForOwnerInput,
    transaction?: ScheduleTaskTransaction,
) {
    const normalized = normalizeOwnerIdentity(input);
    const effectiveAt = input.effectiveAt
        ? normalizeIsoDate(input.effectiveAt, 'Datum otkazivanja')
        : undefined;
    const reason = normalizeReason(input.reason);
    return executeAuthorizedSelectedPlantingCommand(
        normalized,
        ({ task }) => ({
            commandId: normalized.commandId,
            expectedLifecycleVersionEventId:
                normalized.expectedLifecycleVersionEventId,
            cancelledBy: normalized.owner.userId,
            ...(effectiveAt ? { effectiveAt } : {}),
            refundSunflowerAmount: selectedPlantingSunflowerRefundAmount(
                task.purchase,
            ),
            reason,
            status: 'cancelled' as const,
        }),
        (aggregateId, payload) =>
            knownEvents.raisedBedPlantings.taskCancelledV1(
                aggregateId,
                payload,
            ),
        async ({ context, projection, task, transaction: tx }) => {
            if (task.status !== 'planned' && task.status !== 'blocked') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Samo nedovršeno sijanje može biti otkazano.',
                );
            }
            const currentDate = new Date();
            assertOwnerCanCancelScheduledTask(task, currentDate);
            const effectiveDate = effectiveAt
                ? new Date(effectiveAt)
                : currentDate;
            if (
                !isSelectedRaisedBedPlantingEffectiveDateAllowed({
                    currentDate,
                    effectiveDate,
                    nextStatus: 'cancelled',
                    projection,
                })
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_input',
                    'Datum otkazivanja mora biti između početka životnog ciklusa i današnjeg datuma.',
                );
            }
            const refundSunflowerAmount = selectedPlantingSunflowerRefundAmount(
                task.purchase,
            );
            if (refundSunflowerAmount > 0) {
                await earnSunflowersOnce(
                    context.accountId,
                    refundSunflowerAmount,
                    `refund:selectedRaisedBedPlanting:${context.plantingId.toString()}`,
                    tx,
                );
            }
        },
        (tx, plantingId) =>
            getOwnerAuthorizedSelectedPlanting(
                tx,
                normalized.owner,
                plantingId,
            ),
        transaction,
    );
}

export async function updateSelectedRaisedBedPlantingLifecycleStatusForOwner(
    input: UpdateSelectedRaisedBedPlantingLifecycleStatusForOwnerInput,
    transaction?: ScheduleTaskTransaction,
) {
    const normalized = normalizeOwnerIdentity(input);
    const status = normalizeLifecycleStatusChangeTarget(input.status);
    const effectiveAt = input.effectiveAt
        ? normalizeIsoDate(input.effectiveAt, 'Datum promjene stanja')
        : undefined;
    const payload = {
        commandId: normalized.commandId,
        expectedLifecycleVersionEventId:
            normalized.expectedLifecycleVersionEventId,
        changedBy: normalized.owner.userId,
        ...(effectiveAt ? { effectiveAt } : {}),
        status,
    };
    return executeAuthorizedSelectedPlantingCommand(
        normalized,
        payload,
        (aggregateId) =>
            knownEvents.raisedBedPlantings.lifecycleStatusChangedV1(
                aggregateId,
                payload,
            ),
        ({ context, projection, task }) => {
            if (status !== 'removed') {
                assertRaisedBedAvailable(context);
            }
            if (task.status !== 'completed') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Životni ciklus možeš mijenjati tek nakon potvrđenog dovršenja sijanja.',
                );
            }
            if (
                !isOwnerLifecycleStatusTransitionAllowed(
                    projection.status,
                    status,
                )
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    `Promjena stanja iz ${projection.status} u ${status} nije dopuštena.`,
                );
            }
            const currentDate = new Date();
            const effectiveDate = effectiveAt
                ? new Date(effectiveAt)
                : currentDate;
            if (
                !isSelectedRaisedBedPlantingEffectiveDateAllowed({
                    currentDate,
                    effectiveDate,
                    nextStatus: status,
                    projection,
                })
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_input',
                    'Datum stanja mora biti između početka životnog ciklusa, prethodne promjene stanja i današnjeg datuma.',
                );
            }
        },
        (tx, plantingId) =>
            getOwnerAuthorizedSelectedPlanting(
                tx,
                normalized.owner,
                plantingId,
            ),
        transaction,
    );
}
