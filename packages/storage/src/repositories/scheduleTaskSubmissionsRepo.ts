import 'server-only';

import { and, asc, eq, inArray } from 'drizzle-orm';
import {
    events,
    farms,
    farmUsers,
    gardens,
    operations,
    raisedBedFields,
    raisedBeds,
    users,
} from '../schema';
import {
    createEvent,
    getScheduleTaskBlockReason,
    isScheduleTaskBlockReasonCode,
    knownEvents,
    knownEventTypes,
    type ScheduleTaskBlockPayload,
    type ScheduleTaskBlockReasonCode,
} from './events';
import { normalizeAssignedUserIds } from './events/normalizeAssignedUserIds';
import {
    getFarmUserAcceptedOperationById,
    getOperationById,
    lockOperationFarmUserMemberships,
} from './operationsRepo';
import { getRaisedBedFieldsWithEvents } from './raisedBedFieldsRepo';
import {
    type ScheduleTaskTransaction,
    withOperationScheduleTaskTransaction,
    withPlantingScheduleTaskTransaction,
} from './scheduleTaskTransactionsRepo';

export {
    acquireScheduleTaskAdvisoryLock,
    type ScheduleTaskTransaction,
    withOperationScheduleTaskTransaction,
    withPlantingScheduleTaskTransaction,
} from './scheduleTaskTransactionsRepo';

const maxTaskNoteLength = 2000;
const maxCompletionImageCount = 20;
const maxBlockImageCount = 5;

export type ScheduleTaskActor = {
    userId: string;
    role: 'admin' | 'farmer';
};

export type ScheduleTaskSubmissionErrorCode =
    | 'invalid_input'
    | 'not_found'
    | 'not_authorized'
    | 'assignment_changed'
    | 'task_changed'
    | 'invalid_status';

export class ScheduleTaskSubmissionError extends Error {
    constructor(
        readonly code: ScheduleTaskSubmissionErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'ScheduleTaskSubmissionError';
    }
}

export type OperationTaskSubmissionResult = {
    kind: 'operation';
    outcome: 'completed' | 'blocked';
    status: 'pendingVerification' | 'completed' | 'blocked';
    eventId: number;
    occurredAt: Date;
    created: boolean;
};

export type PlantingTaskSubmissionResult = {
    kind: 'planting';
    outcome: 'completed' | 'blocked';
    status: 'pendingVerification' | 'sowed' | 'blocked';
    eventId: number;
    occurredAt: Date;
    created: boolean;
};

export type ScheduleTaskAssignmentResult = {
    kind: 'operation' | 'planting';
    changed: boolean;
    eventId: number | null;
    assignedAt: Date | null;
    previousAssignedUserIds: string[];
    assignedUserIds: string[];
    newlyAssignedUserIds: string[];
};

export type OperationTaskVerificationResult = {
    kind: 'operation';
    status: 'completed';
    eventId: number;
    occurredAt: Date;
    created: boolean;
};

export type OperationCompletionEvidenceUpdateResult = {
    kind: 'operation';
    status: 'pendingVerification';
    eventId: number;
    occurredAt: Date;
    created: boolean;
};

export type PlantingTaskVerificationResult = {
    kind: 'planting';
    status: 'sowed';
    eventId: number;
    occurredAt: Date;
    created: boolean;
};

function assertPositiveSafeInteger(value: number, label: string) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new ScheduleTaskSubmissionError(
            'invalid_input',
            `${label} mora biti pozitivan cijeli broj.`,
        );
    }
    return value;
}

function assertPositionIndex(value: number) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new ScheduleTaskSubmissionError(
            'invalid_input',
            'Pozicija sijanja mora biti cijeli broj nula ili veći.',
        );
    }
    return value;
}

function assertTaskVersionEventId(value: number) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new ScheduleTaskSubmissionError(
            'invalid_input',
            'Verzija zadatka mora biti cijeli broj nula ili veći.',
        );
    }
    return value;
}

function normalizeUserIds(userIds: readonly string[]) {
    return normalizeAssignedUserIds(
        userIds.map((userId) => userId.trim()),
        undefined,
    );
}

function sameUserIdSet(left: readonly string[], right: readonly string[]) {
    return (
        left.length === right.length &&
        left.every((userId) => right.includes(userId))
    );
}

function normalizeOptionalNote(note: string | null | undefined) {
    const normalized = note?.trim();
    if (!normalized) {
        return undefined;
    }
    if (normalized.length > maxTaskNoteLength) {
        throw new ScheduleTaskSubmissionError(
            'invalid_input',
            `Napomena može imati najviše ${maxTaskNoteLength.toString()} znakova.`,
        );
    }
    return normalized;
}

function normalizeImageUrls(
    imageUrls: readonly string[] | undefined,
    maxImageCount: number,
) {
    const normalized = Array.from(
        new Set(
            (imageUrls ?? [])
                .map((imageUrl) => imageUrl.trim())
                .filter((imageUrl) => imageUrl.length > 0),
        ),
    );
    if (normalized.length > maxImageCount) {
        throw new ScheduleTaskSubmissionError(
            'invalid_input',
            `Možeš dodati najviše ${maxImageCount.toString()} fotografija.`,
        );
    }
    return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function sameStrings(left: readonly string[], right: readonly string[]) {
    return (
        left.length === right.length &&
        left.every((value, index) => value === right[index])
    );
}

function buildBlockPayload({
    actorId,
    imageUrls,
    note,
    reasonCode,
}: {
    actorId: string;
    imageUrls?: readonly string[];
    note?: string | null;
    reasonCode: ScheduleTaskBlockReasonCode;
}): ScheduleTaskBlockPayload {
    if (!isScheduleTaskBlockReasonCode(reasonCode)) {
        throw new ScheduleTaskSubmissionError(
            'invalid_input',
            'Razlog blokade nije podržan.',
        );
    }

    const reason = getScheduleTaskBlockReason(reasonCode);
    const normalizedNote = normalizeOptionalNote(note);
    if (
        (reasonCode === 'task_not_applicable' || reasonCode === 'other') &&
        !normalizedNote
    ) {
        throw new ScheduleTaskSubmissionError(
            'invalid_input',
            'Za odabrani razlog dodaj kratku napomenu.',
        );
    }
    const images = normalizeImageUrls(imageUrls, maxBlockImageCount);

    return {
        blockedBy: actorId,
        reasonCode: reason.code,
        reasonLabel: reason.label,
        ...(normalizedNote ? { note: normalizedNote } : {}),
        ...(images.length > 0 ? { images } : {}),
    };
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

async function assertCurrentAdmin(
    transaction: ScheduleTaskTransaction,
    userId: string,
) {
    const [user] = await transaction
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .for('share');
    if (user?.role !== 'admin') {
        throw new ScheduleTaskSubmissionError(
            'not_authorized',
            'Samo administrator može izvršiti ovu radnju.',
        );
    }
}

async function lockOperationAggregateRow(
    transaction: ScheduleTaskTransaction,
    operationId: number,
) {
    const [operation] = await transaction
        .select({ id: operations.id, raisedBedId: operations.raisedBedId })
        .from(operations)
        .where(
            and(
                eq(operations.id, operationId),
                eq(operations.isDeleted, false),
            ),
        )
        .limit(1)
        .for('update');
    if (!operation) {
        throw new ScheduleTaskSubmissionError(
            'not_found',
            'Radnja nije pronađena.',
        );
    }

    if (operation.raisedBedId !== null) {
        const [raisedBed] = await transaction
            .select({ status: raisedBeds.status })
            .from(raisedBeds)
            .where(
                and(
                    eq(raisedBeds.id, operation.raisedBedId),
                    eq(raisedBeds.isDeleted, false),
                ),
            )
            .limit(1)
            .for('update');
        if (!raisedBed) {
            throw new ScheduleTaskSubmissionError(
                'not_found',
                'Gredica zadatka nije pronađena.',
            );
        }
        if (raisedBed.status === 'abandoned') {
            throw new ScheduleTaskSubmissionError(
                'invalid_status',
                'Zadatak na napuštenoj gredici više nije moguće poslati.',
            );
        }
    }
}

async function getAuthorizedOperation(
    transaction: ScheduleTaskTransaction,
    actor: ScheduleTaskActor,
    operationId: number,
) {
    await assertCurrentActor(transaction, actor);
    await lockOperationAggregateRow(transaction, operationId);

    if (actor.role === 'farmer') {
        const lockedMembershipUserIds = await lockOperationFarmUserMemberships(
            operationId,
            [actor.userId],
            transaction,
        );
        if (!lockedMembershipUserIds.includes(actor.userId)) {
            throw new ScheduleTaskSubmissionError(
                'not_authorized',
                'Nemaš dozvolu za ovaj zadatak.',
            );
        }
    }

    const operation =
        actor.role === 'admin'
            ? await getOperationById(operationId, transaction)
            : await getFarmUserAcceptedOperationById(
                  actor.userId,
                  operationId,
                  transaction,
              );
    if (!operation) {
        throw new ScheduleTaskSubmissionError(
            'not_authorized',
            'Nemaš dozvolu za ovaj zadatak.',
        );
    }
    if (!operation.isAccepted) {
        throw new ScheduleTaskSubmissionError(
            'invalid_status',
            'Radnja mora biti potvrđena prije slanja.',
        );
    }
    return operation;
}

function existingOperationTerminalResult(
    operation: Awaited<ReturnType<typeof getOperationById>>,
): OperationTaskSubmissionResult | null {
    if (
        (operation.status === 'pendingVerification' ||
            operation.status === 'completed') &&
        operation.completionEventId &&
        operation.completedAt
    ) {
        return {
            kind: 'operation',
            outcome: 'completed',
            status: operation.status,
            eventId: operation.completionEventId,
            occurredAt: operation.completedAt,
            created: false,
        };
    }
    if (
        operation.status === 'blocked' &&
        operation.blockedEventId &&
        operation.blockedAt
    ) {
        return {
            kind: 'operation',
            outcome: 'blocked',
            status: 'blocked',
            eventId: operation.blockedEventId,
            occurredAt: operation.blockedAt,
            created: false,
        };
    }
    return null;
}

function assertOperationAssignment(
    operation: Awaited<ReturnType<typeof getOperationById>>,
    actor: ScheduleTaskActor,
) {
    if (
        actor.role === 'farmer' &&
        operation.assignedUserIds.length > 0 &&
        !operation.assignedUserIds.includes(actor.userId)
    ) {
        throw new ScheduleTaskSubmissionError(
            'assignment_changed',
            'Ovaj je zadatak u međuvremenu dodijeljen drugom korisniku.',
        );
    }
}

async function getPlantingTaskContext(
    transaction: ScheduleTaskTransaction,
    raisedBedId: number,
    positionIndex: number,
) {
    const [row] = await transaction
        .select({
            fieldId: raisedBedFields.id,
            farmId: gardens.farmId,
            raisedBedStatus: raisedBeds.status,
        })
        .from(raisedBedFields)
        .innerJoin(raisedBeds, eq(raisedBedFields.raisedBedId, raisedBeds.id))
        .innerJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
        .innerJoin(farms, eq(gardens.farmId, farms.id))
        .where(
            and(
                eq(raisedBedFields.raisedBedId, raisedBedId),
                eq(raisedBedFields.positionIndex, positionIndex),
                eq(raisedBedFields.isDeleted, false),
                eq(raisedBeds.isDeleted, false),
                eq(gardens.isDeleted, false),
                eq(gardens.isSandbox, false),
                eq(farms.isDeleted, false),
            ),
        )
        .limit(1)
        .for('update');
    if (!row) {
        throw new ScheduleTaskSubmissionError(
            'not_found',
            'Zadatak sijanja nije pronađen.',
        );
    }
    if (row.raisedBedStatus === 'abandoned') {
        throw new ScheduleTaskSubmissionError(
            'invalid_status',
            'Sijanje na napuštenoj gredici više nije moguće poslati.',
        );
    }

    const field = (
        await getRaisedBedFieldsWithEvents(raisedBedId, transaction)
    ).find((candidate) => candidate.positionIndex === positionIndex);
    if (!field?.active || !field.plantSortId) {
        throw new ScheduleTaskSubmissionError(
            'not_found',
            'Aktivno sijanje nije pronađeno.',
        );
    }

    return { ...row, field };
}

async function getAuthorizedPlantingTask(
    transaction: ScheduleTaskTransaction,
    actor: ScheduleTaskActor,
    raisedBedId: number,
    positionIndex: number,
) {
    await assertCurrentActor(transaction, actor);
    const context = await getPlantingTaskContext(
        transaction,
        raisedBedId,
        positionIndex,
    );
    if (actor.role === 'farmer') {
        const lockedMembershipUserIds = await lockFarmUserMemberships(
            transaction,
            context.farmId,
            [actor.userId],
        );
        if (!lockedMembershipUserIds.includes(actor.userId)) {
            throw new ScheduleTaskSubmissionError(
                'not_authorized',
                'Nemaš dozvolu za ovaj zadatak sijanja.',
            );
        }
    }
    return context;
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

    return Array.from(new Set(memberships.map((row) => row.userId)));
}

function existingPlantingTerminalResult(
    field: Awaited<ReturnType<typeof getRaisedBedFieldsWithEvents>>[number],
): PlantingTaskSubmissionResult | null {
    if (
        (field.plantStatus === 'pendingVerification' ||
            field.plantStatus === 'sowed') &&
        field.plantStatusEventId &&
        field.plantStatusChangedAt
    ) {
        return {
            kind: 'planting',
            outcome: 'completed',
            status: field.plantStatus,
            eventId: field.plantStatusEventId,
            occurredAt: field.plantStatusChangedAt,
            created: false,
        };
    }
    if (
        field.plantStatus === 'blocked' &&
        field.blockedEventId &&
        field.blockedAt
    ) {
        return {
            kind: 'planting',
            outcome: 'blocked',
            status: 'blocked',
            eventId: field.blockedEventId,
            occurredAt: field.blockedAt,
            created: false,
        };
    }
    return null;
}

async function existingPlantingTerminalInCycle(
    transaction: ScheduleTaskTransaction,
    aggregateId: string,
    eventIds: readonly number[],
): Promise<PlantingTaskSubmissionResult | null> {
    if (eventIds.length === 0) {
        return null;
    }

    const completionEvents = await transaction
        .select({
            createdAt: events.createdAt,
            data: events.data,
            id: events.id,
            type: events.type,
        })
        .from(events)
        .where(
            and(
                eq(events.aggregateId, aggregateId),
                inArray(events.type, [
                    knownEventTypes.raisedBedFields.plantUpdate,
                    knownEventTypes.raisedBedFields.plantBlock,
                ]),
                inArray(events.id, [...eventIds]),
            ),
        )
        .orderBy(asc(events.id));

    for (const event of completionEvents) {
        if (event.type === knownEventTypes.raisedBedFields.plantBlock) {
            return {
                kind: 'planting',
                outcome: 'blocked',
                status: 'blocked',
                eventId: event.id,
                occurredAt: event.createdAt,
                created: false,
            };
        }
        const status = (event.data as { status?: unknown } | null | undefined)
            ?.status;
        if (status !== 'pendingVerification' && status !== 'sowed') {
            continue;
        }
        return {
            kind: 'planting',
            outcome: 'completed',
            status,
            eventId: event.id,
            occurredAt: event.createdAt,
            created: false,
        };
    }

    return null;
}

function assertPlantingAssignment(
    field: Awaited<ReturnType<typeof getRaisedBedFieldsWithEvents>>[number],
    actor: ScheduleTaskActor,
) {
    if (
        actor.role === 'farmer' &&
        field.assignedUserIds.length > 0 &&
        !field.assignedUserIds.includes(actor.userId)
    ) {
        throw new ScheduleTaskSubmissionError(
            'assignment_changed',
            'Ovo je sijanje u međuvremenu dodijeljeno drugom korisniku.',
        );
    }
}

export async function submitOperationTaskCompletion(
    {
        actor,
        expectedEntityId,
        expectedTaskVersionEventId,
        imageUrls,
        notes,
        operationId,
    }: {
        actor: ScheduleTaskActor;
        expectedEntityId?: number;
        expectedTaskVersionEventId?: number;
        imageUrls?: readonly string[];
        notes?: string;
        operationId: number;
    },
    transaction?: ScheduleTaskTransaction,
): Promise<OperationTaskSubmissionResult> {
    const validOperationId = assertPositiveSafeInteger(
        operationId,
        'ID radnje',
    );
    const validExpectedEntityId =
        expectedEntityId === undefined
            ? undefined
            : assertPositiveSafeInteger(expectedEntityId, 'ID vrste radnje');
    const validExpectedTaskVersionEventId =
        expectedTaskVersionEventId === undefined
            ? undefined
            : assertTaskVersionEventId(expectedTaskVersionEventId);
    if (
        actor.role === 'farmer' &&
        (validExpectedEntityId === undefined ||
            validExpectedTaskVersionEventId === undefined)
    ) {
        throw new ScheduleTaskSubmissionError(
            'invalid_input',
            'Nedostaje identitet zadatka. Osvježi zadatke i pokušaj ponovno.',
        );
    }
    return withOperationScheduleTaskTransaction(
        validOperationId,
        async (transaction) => {
            const operation = await getAuthorizedOperation(
                transaction,
                actor,
                validOperationId,
            );
            if (
                validExpectedEntityId !== undefined &&
                operation.entityId !== validExpectedEntityId
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Radnja se u međuvremenu promijenila. Osvježi zadatke i pokušaj ponovno.',
                );
            }
            const existing = existingOperationTerminalResult(operation);
            if (existing) {
                if (existing.outcome === 'completed') {
                    if (
                        actor.role === 'admin' &&
                        operation.status === 'pendingVerification'
                    ) {
                        if (
                            validExpectedTaskVersionEventId !== undefined &&
                            operation.taskVersionEventId !==
                                validExpectedTaskVersionEventId
                        ) {
                            throw new ScheduleTaskSubmissionError(
                                'task_changed',
                                'Zadatak je u međuvremenu promijenjen. Osvježi zadatke i pokušaj ponovno.',
                            );
                        }
                        await createEvent(
                            knownEvents.operations.verifiedV1(
                                validOperationId.toString(),
                                { verifiedBy: actor.userId },
                            ),
                            transaction,
                        );
                        return {
                            ...existing,
                            status: 'completed' as const,
                            created: true,
                        };
                    }
                    return existing;
                }
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Radnja je već označena kao blokirana.',
                );
            }
            if (
                validExpectedTaskVersionEventId !== undefined &&
                operation.taskVersionEventId !== validExpectedTaskVersionEventId
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Zadatak je u međuvremenu promijenjen. Osvježi zadatke i pokušaj ponovno.',
                );
            }
            if (
                operation.status === 'failed' ||
                operation.status === 'canceled'
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    `Radnja sa stanjem ${operation.status} ne može biti dovršena.`,
                );
            }
            assertOperationAssignment(operation, actor);

            const event = await createEvent(
                knownEvents.operations.completedV1(
                    validOperationId.toString(),
                    {
                        completedBy: actor.userId,
                        images: normalizeImageUrls(
                            imageUrls,
                            maxCompletionImageCount,
                        ),
                        notes: normalizeOptionalNote(notes),
                    },
                ),
                transaction,
            );
            if (actor.role === 'admin') {
                await createEvent(
                    knownEvents.operations.verifiedV1(
                        validOperationId.toString(),
                        { verifiedBy: actor.userId },
                    ),
                    transaction,
                );
            }
            return {
                kind: 'operation',
                outcome: 'completed',
                status:
                    actor.role === 'admin'
                        ? 'completed'
                        : 'pendingVerification',
                eventId: event.id,
                occurredAt: event.createdAt,
                created: true,
            };
        },
        transaction,
    );
}

export async function submitOperationTaskBlock(
    {
        actor,
        expectedEntityId,
        expectedTaskVersionEventId,
        imageUrls,
        note,
        operationId,
        reasonCode,
    }: {
        actor: ScheduleTaskActor;
        expectedEntityId?: number;
        expectedTaskVersionEventId?: number;
        imageUrls?: readonly string[];
        note?: string | null;
        operationId: number;
        reasonCode: ScheduleTaskBlockReasonCode;
    },
    transaction?: ScheduleTaskTransaction,
): Promise<OperationTaskSubmissionResult> {
    const validOperationId = assertPositiveSafeInteger(
        operationId,
        'ID radnje',
    );
    const validExpectedEntityId =
        expectedEntityId === undefined
            ? undefined
            : assertPositiveSafeInteger(expectedEntityId, 'ID vrste radnje');
    const validExpectedTaskVersionEventId =
        expectedTaskVersionEventId === undefined
            ? undefined
            : assertTaskVersionEventId(expectedTaskVersionEventId);
    if (
        actor.role === 'farmer' &&
        (validExpectedEntityId === undefined ||
            validExpectedTaskVersionEventId === undefined)
    ) {
        throw new ScheduleTaskSubmissionError(
            'invalid_input',
            'Nedostaje identitet zadatka. Osvježi zadatke i pokušaj ponovno.',
        );
    }
    const payload = buildBlockPayload({
        actorId: actor.userId,
        imageUrls,
        note,
        reasonCode,
    });
    return withOperationScheduleTaskTransaction(
        validOperationId,
        async (transaction) => {
            const operation = await getAuthorizedOperation(
                transaction,
                actor,
                validOperationId,
            );
            if (
                validExpectedEntityId !== undefined &&
                operation.entityId !== validExpectedEntityId
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Radnja se u međuvremenu promijenila. Osvježi zadatke i pokušaj ponovno.',
                );
            }
            const existing = existingOperationTerminalResult(operation);
            if (existing) {
                if (existing.outcome === 'blocked') {
                    return existing;
                }
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Radnja je već dovršena.',
                );
            }
            if (
                validExpectedTaskVersionEventId !== undefined &&
                operation.taskVersionEventId !== validExpectedTaskVersionEventId
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Zadatak je u međuvremenu promijenjen. Osvježi zadatke i pokušaj ponovno.',
                );
            }
            if (
                operation.status === 'failed' ||
                operation.status === 'canceled'
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    `Radnja sa stanjem ${operation.status} ne može biti blokirana.`,
                );
            }
            assertOperationAssignment(operation, actor);

            const event = await createEvent(
                knownEvents.operations.blockedV1(
                    validOperationId.toString(),
                    payload,
                ),
                transaction,
            );
            return {
                kind: 'operation',
                outcome: 'blocked',
                status: 'blocked',
                eventId: event.id,
                occurredAt: event.createdAt,
                created: true,
            };
        },
        transaction,
    );
}

export async function submitPlantingTaskCompletion(
    {
        actor,
        expectedPlantCycleEventId,
        expectedPlantCycleVersionEventId,
        expectedPlantSortId,
        positionIndex,
        raisedBedId,
    }: {
        actor: ScheduleTaskActor;
        expectedPlantCycleEventId?: number;
        expectedPlantCycleVersionEventId?: number;
        expectedPlantSortId?: number;
        positionIndex: number;
        raisedBedId: number;
    },
    transaction?: ScheduleTaskTransaction,
): Promise<PlantingTaskSubmissionResult> {
    const validRaisedBedId = assertPositiveSafeInteger(
        raisedBedId,
        'ID gredice',
    );
    const validPositionIndex = assertPositionIndex(positionIndex);
    const validExpectedPlantCycleEventId =
        expectedPlantCycleEventId === undefined
            ? undefined
            : assertPositiveSafeInteger(
                  expectedPlantCycleEventId,
                  'ID ciklusa biljke',
              );
    const validExpectedPlantSortId =
        expectedPlantSortId === undefined
            ? undefined
            : assertPositiveSafeInteger(expectedPlantSortId, 'ID sorte biljke');
    const validExpectedPlantCycleVersionEventId =
        expectedPlantCycleVersionEventId === undefined
            ? undefined
            : assertTaskVersionEventId(expectedPlantCycleVersionEventId);
    if (
        actor.role === 'farmer' &&
        (validExpectedPlantCycleEventId === undefined ||
            validExpectedPlantCycleVersionEventId === undefined ||
            validExpectedPlantSortId === undefined)
    ) {
        throw new ScheduleTaskSubmissionError(
            'invalid_input',
            'Nedostaje identitet sijanja. Osvježi zadatke i pokušaj ponovno.',
        );
    }
    return withPlantingScheduleTaskTransaction(
        validRaisedBedId,
        validPositionIndex,
        async (transaction) => {
            const { field } = await getAuthorizedPlantingTask(
                transaction,
                actor,
                validRaisedBedId,
                validPositionIndex,
            );
            const activePlantCycle = field.plantCycles.find(
                (plantCycle) => plantCycle.active,
            );
            const assertAdminPendingVersion = () => {
                if (validExpectedPlantCycleVersionEventId === undefined) {
                    throw new ScheduleTaskSubmissionError(
                        'invalid_input',
                        'Nedostaje verzija zadatka sijanja. Osvježi zadatke i pokušaj ponovno.',
                    );
                }
                if (
                    activePlantCycle?.endedEventId !==
                    validExpectedPlantCycleVersionEventId
                ) {
                    throw new ScheduleTaskSubmissionError(
                        'task_changed',
                        'Zadatak sijanja je u međuvremenu promijenjen. Osvježi zadatke i pokušaj ponovno.',
                    );
                }
            };
            if (
                (validExpectedPlantCycleEventId !== undefined &&
                    activePlantCycle?.plantPlaceEventId !==
                        validExpectedPlantCycleEventId) ||
                (validExpectedPlantSortId !== undefined &&
                    field.plantSortId !== validExpectedPlantSortId)
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Sijanje se u međuvremenu promijenilo. Osvježi zadatke i pokušaj ponovno.',
                );
            }
            const existing = existingPlantingTerminalResult(field);
            if (existing) {
                if (existing.outcome === 'completed') {
                    if (
                        actor.role === 'admin' &&
                        field.plantStatus === 'pendingVerification'
                    ) {
                        assertAdminPendingVersion();
                        const event = await createEvent(
                            knownEvents.raisedBedFields.plantUpdateV1(
                                `${validRaisedBedId.toString()}|${validPositionIndex.toString()}`,
                                { status: 'sowed' },
                            ),
                            transaction,
                        );
                        return {
                            kind: 'planting',
                            outcome: 'completed',
                            status: 'sowed',
                            eventId: event.id,
                            occurredAt: event.createdAt,
                            created: true,
                        };
                    }
                    return existing;
                }
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Sijanje je već označeno kao blokirano.',
                );
            }
            const priorTerminal = activePlantCycle
                ? await existingPlantingTerminalInCycle(
                      transaction,
                      `${validRaisedBedId.toString()}|${validPositionIndex.toString()}`,
                      activePlantCycle.eventIds,
                  )
                : null;
            if (priorTerminal) {
                if (priorTerminal.outcome === 'blocked') {
                    throw new ScheduleTaskSubmissionError(
                        'invalid_status',
                        'Sijanje je već označeno kao blokirano.',
                    );
                }
                if (
                    actor.role === 'admin' &&
                    priorTerminal.status === 'pendingVerification'
                ) {
                    assertAdminPendingVersion();
                    const event = await createEvent(
                        knownEvents.raisedBedFields.plantUpdateV1(
                            `${validRaisedBedId.toString()}|${validPositionIndex.toString()}`,
                            { status: 'sowed' },
                        ),
                        transaction,
                    );
                    return {
                        kind: 'planting',
                        outcome: 'completed',
                        status: 'sowed',
                        eventId: event.id,
                        occurredAt: event.createdAt,
                        created: true,
                    };
                }
                return priorTerminal;
            }
            if (
                validExpectedPlantCycleVersionEventId !== undefined &&
                activePlantCycle?.endedEventId !==
                    validExpectedPlantCycleVersionEventId
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Zadatak sijanja je u međuvremenu promijenjen. Osvježi zadatke i pokušaj ponovno.',
                );
            }
            if (field.plantStatus !== 'planned') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Sijanje mora biti planirano prije završetka.',
                );
            }
            assertPlantingAssignment(field, actor);

            const nextStatus =
                actor.role === 'admin' ? 'sowed' : 'pendingVerification';
            const event = await createEvent(
                knownEvents.raisedBedFields.plantUpdateV1(
                    `${validRaisedBedId.toString()}|${validPositionIndex.toString()}`,
                    // A status event must never copy assignment state. Assignment
                    // is projected only from separately locked assignment events.
                    { status: nextStatus },
                ),
                transaction,
            );
            return {
                kind: 'planting',
                outcome: 'completed',
                status: nextStatus,
                eventId: event.id,
                occurredAt: event.createdAt,
                created: true,
            };
        },
        transaction,
    );
}

export async function submitPlantingTaskBlock(
    {
        actor,
        expectedPlantCycleEventId,
        expectedPlantCycleVersionEventId,
        expectedPlantSortId,
        imageUrls,
        note,
        positionIndex,
        raisedBedId,
        reasonCode,
    }: {
        actor: ScheduleTaskActor;
        expectedPlantCycleEventId?: number;
        expectedPlantCycleVersionEventId?: number;
        expectedPlantSortId?: number;
        imageUrls?: readonly string[];
        note?: string | null;
        positionIndex: number;
        raisedBedId: number;
        reasonCode: ScheduleTaskBlockReasonCode;
    },
    transaction?: ScheduleTaskTransaction,
): Promise<PlantingTaskSubmissionResult> {
    const validRaisedBedId = assertPositiveSafeInteger(
        raisedBedId,
        'ID gredice',
    );
    const validPositionIndex = assertPositionIndex(positionIndex);
    const validExpectedPlantCycleEventId =
        expectedPlantCycleEventId === undefined
            ? undefined
            : assertPositiveSafeInteger(
                  expectedPlantCycleEventId,
                  'ID ciklusa biljke',
              );
    const validExpectedPlantSortId =
        expectedPlantSortId === undefined
            ? undefined
            : assertPositiveSafeInteger(expectedPlantSortId, 'ID sorte biljke');
    const validExpectedPlantCycleVersionEventId =
        expectedPlantCycleVersionEventId === undefined
            ? undefined
            : assertTaskVersionEventId(expectedPlantCycleVersionEventId);
    if (
        actor.role === 'farmer' &&
        (validExpectedPlantCycleEventId === undefined ||
            validExpectedPlantCycleVersionEventId === undefined ||
            validExpectedPlantSortId === undefined)
    ) {
        throw new ScheduleTaskSubmissionError(
            'invalid_input',
            'Nedostaje identitet sijanja. Osvježi zadatke i pokušaj ponovno.',
        );
    }
    const payload = buildBlockPayload({
        actorId: actor.userId,
        imageUrls,
        note,
        reasonCode,
    });
    return withPlantingScheduleTaskTransaction(
        validRaisedBedId,
        validPositionIndex,
        async (transaction) => {
            const { field } = await getAuthorizedPlantingTask(
                transaction,
                actor,
                validRaisedBedId,
                validPositionIndex,
            );
            const activePlantCycle = field.plantCycles.find(
                (plantCycle) => plantCycle.active,
            );
            if (
                (validExpectedPlantCycleEventId !== undefined &&
                    activePlantCycle?.plantPlaceEventId !==
                        validExpectedPlantCycleEventId) ||
                (validExpectedPlantSortId !== undefined &&
                    field.plantSortId !== validExpectedPlantSortId)
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Sijanje se u međuvremenu promijenilo. Osvježi zadatke i pokušaj ponovno.',
                );
            }
            const existing = existingPlantingTerminalResult(field);
            if (existing) {
                if (existing.outcome === 'blocked') {
                    return existing;
                }
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Sijanje je već dovršeno.',
                );
            }
            const priorTerminal = activePlantCycle
                ? await existingPlantingTerminalInCycle(
                      transaction,
                      `${validRaisedBedId.toString()}|${validPositionIndex.toString()}`,
                      activePlantCycle.eventIds,
                  )
                : null;
            if (priorTerminal) {
                if (priorTerminal.outcome === 'blocked') {
                    return priorTerminal;
                }
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Sijanje je već dovršeno.',
                );
            }
            if (
                validExpectedPlantCycleVersionEventId !== undefined &&
                activePlantCycle?.endedEventId !==
                    validExpectedPlantCycleVersionEventId
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Zadatak sijanja je u međuvremenu promijenjen. Osvježi zadatke i pokušaj ponovno.',
                );
            }
            if (field.plantStatus !== 'planned') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Samo planirano sijanje može biti označeno kao blokirano.',
                );
            }
            assertPlantingAssignment(field, actor);

            const event = await createEvent(
                knownEvents.raisedBedFields.plantBlockedV1(
                    `${validRaisedBedId.toString()}|${validPositionIndex.toString()}`,
                    payload,
                ),
                transaction,
            );
            return {
                kind: 'planting',
                outcome: 'blocked',
                status: 'blocked',
                eventId: event.id,
                occurredAt: event.createdAt,
                created: true,
            };
        },
        transaction,
    );
}

export async function updateOperationCompletionEvidence(
    {
        expectedTaskVersionEventId,
        imageUrls,
        notes,
        operationId,
        updatedBy,
    }: {
        expectedTaskVersionEventId: number;
        imageUrls?: readonly string[];
        notes?: string | null;
        operationId: number;
        updatedBy: string;
    },
    transaction?: ScheduleTaskTransaction,
): Promise<OperationCompletionEvidenceUpdateResult> {
    const validOperationId = assertPositiveSafeInteger(
        operationId,
        'ID radnje',
    );
    const validExpectedTaskVersionEventId = assertTaskVersionEventId(
        expectedTaskVersionEventId,
    );
    const normalizedImageUrls = normalizeImageUrls(
        imageUrls,
        maxCompletionImageCount,
    );
    const normalizedNotes = normalizeOptionalNote(notes) ?? '';

    return withOperationScheduleTaskTransaction(
        validOperationId,
        async (tx) => {
            await assertCurrentAdmin(tx, updatedBy);
            await lockOperationAggregateRow(tx, validOperationId);
            const operation = await getOperationById(validOperationId, tx);
            if (operation.status !== 'pendingVerification') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Zapis završetka može se urediti samo prije verifikacije.',
                );
            }

            const currentImageUrls = operation.imageUrls ?? [];
            const currentNotes = operation.completionNotes ?? '';
            const evidenceIsUnchanged =
                sameStrings(currentImageUrls, normalizedImageUrls) &&
                currentNotes === normalizedNotes;

            if (
                operation.taskVersionEventId !== validExpectedTaskVersionEventId
            ) {
                const latestEvent = await tx.query.events.findFirst({
                    where: and(
                        eq(events.id, operation.taskVersionEventId),
                        eq(
                            events.type,
                            knownEventTypes.operations.completionEvidenceUpdate,
                        ),
                        eq(events.aggregateId, validOperationId.toString()),
                    ),
                });
                const latestEventData = latestEvent?.data;
                const latestImages =
                    isRecord(latestEventData) &&
                    Array.isArray(latestEventData.images)
                        ? latestEventData.images.filter(
                              (value): value is string =>
                                  typeof value === 'string',
                          )
                        : null;
                const isExactRetry =
                    latestEvent &&
                    isRecord(latestEventData) &&
                    latestEventData.updatedBy === updatedBy &&
                    latestImages &&
                    sameStrings(latestImages, normalizedImageUrls) &&
                    latestEventData.notes === normalizedNotes &&
                    evidenceIsUnchanged;
                if (isExactRetry) {
                    return {
                        kind: 'operation',
                        status: 'pendingVerification',
                        eventId: latestEvent.id,
                        occurredAt: latestEvent.createdAt,
                        created: false,
                    };
                }
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Zapis završetka je u međuvremenu promijenjen. Osvježi zadatak i pokušaj ponovno.',
                );
            }

            if (evidenceIsUnchanged) {
                const latestEvent = await tx.query.events.findFirst({
                    where: eq(events.id, operation.taskVersionEventId),
                });
                if (!latestEvent) {
                    throw new ScheduleTaskSubmissionError(
                        'not_found',
                        'Trenutna verzija zapisa završetka nije pronađena.',
                    );
                }
                return {
                    kind: 'operation',
                    status: 'pendingVerification',
                    eventId: latestEvent.id,
                    occurredAt: latestEvent.createdAt,
                    created: false,
                };
            }

            const event = await createEvent(
                knownEvents.operations.completionEvidenceUpdatedV1(
                    validOperationId.toString(),
                    {
                        updatedBy,
                        images: normalizedImageUrls,
                        notes: normalizedNotes,
                    },
                ),
                tx,
            );
            return {
                kind: 'operation',
                status: 'pendingVerification',
                eventId: event.id,
                occurredAt: event.createdAt,
                created: true,
            };
        },
        transaction,
    );
}

export async function verifyOperationTaskCompletion(
    {
        expectedTaskVersionEventId,
        operationId,
        verifiedBy,
    }: {
        expectedTaskVersionEventId: number;
        operationId: number;
        verifiedBy: string;
    },
    transaction?: ScheduleTaskTransaction,
): Promise<OperationTaskVerificationResult> {
    const validOperationId = assertPositiveSafeInteger(
        operationId,
        'ID radnje',
    );
    const validExpectedTaskVersionEventId = assertTaskVersionEventId(
        expectedTaskVersionEventId,
    );
    return withOperationScheduleTaskTransaction(
        validOperationId,
        async (transaction) => {
            await assertCurrentAdmin(transaction, verifiedBy);
            await lockOperationAggregateRow(transaction, validOperationId);
            const operation = await getOperationById(
                validOperationId,
                transaction,
            );

            if (
                operation.status === 'completed' &&
                operation.verificationEventId &&
                operation.verifiedAt
            ) {
                return {
                    kind: 'operation',
                    status: 'completed',
                    eventId: operation.verificationEventId,
                    occurredAt: operation.verifiedAt,
                    created: false,
                };
            }
            if (
                operation.taskVersionEventId !== validExpectedTaskVersionEventId
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Zadatak je u međuvremenu promijenjen. Osvježi zadatke i pokušaj ponovno.',
                );
            }
            if (operation.status !== 'pendingVerification') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Radnja ne čeka verifikaciju.',
                );
            }

            const event = await createEvent(
                knownEvents.operations.verifiedV1(validOperationId.toString(), {
                    verifiedBy,
                }),
                transaction,
            );
            return {
                kind: 'operation',
                status: 'completed',
                eventId: event.id,
                occurredAt: event.createdAt,
                created: true,
            };
        },
        transaction,
    );
}

export async function verifyPlantingTaskCompletion(
    {
        expectedPlantCycleEventId,
        expectedPlantCycleVersionEventId,
        expectedPlantSortId,
        positionIndex,
        raisedBedId,
        verifiedBy,
    }: {
        expectedPlantCycleEventId: number;
        expectedPlantCycleVersionEventId: number;
        expectedPlantSortId: number;
        positionIndex: number;
        raisedBedId: number;
        verifiedBy: string;
    },
    transaction?: ScheduleTaskTransaction,
): Promise<PlantingTaskVerificationResult> {
    const validRaisedBedId = assertPositiveSafeInteger(
        raisedBedId,
        'ID gredice',
    );
    const validPositionIndex = assertPositionIndex(positionIndex);
    const validExpectedPlantCycleEventId = assertPositiveSafeInteger(
        expectedPlantCycleEventId,
        'ID ciklusa biljke',
    );
    const validExpectedPlantSortId = assertPositiveSafeInteger(
        expectedPlantSortId,
        'ID sorte biljke',
    );
    const validExpectedPlantCycleVersionEventId = assertTaskVersionEventId(
        expectedPlantCycleVersionEventId,
    );
    return withPlantingScheduleTaskTransaction(
        validRaisedBedId,
        validPositionIndex,
        async (transaction) => {
            await assertCurrentAdmin(transaction, verifiedBy);
            const { field } = await getPlantingTaskContext(
                transaction,
                validRaisedBedId,
                validPositionIndex,
            );
            const activePlantCycle = field.plantCycles.find(
                (plantCycle) => plantCycle.active,
            );
            if (
                activePlantCycle?.plantPlaceEventId !==
                    validExpectedPlantCycleEventId ||
                field.plantSortId !== validExpectedPlantSortId
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Sijanje se u međuvremenu promijenilo. Osvježi zadatke i pokušaj ponovno.',
                );
            }

            if (field.plantStatus === 'sowed' && field.plantStatusEventId) {
                if (!field.plantStatusChangedAt) {
                    throw new ScheduleTaskSubmissionError(
                        'invalid_status',
                        'Nedostaje zapis verifikacije sijanja.',
                    );
                }
                return {
                    kind: 'planting',
                    status: 'sowed',
                    eventId: field.plantStatusEventId,
                    occurredAt: field.plantStatusChangedAt,
                    created: false,
                };
            }
            if (
                activePlantCycle?.endedEventId !==
                validExpectedPlantCycleVersionEventId
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Zadatak sijanja je u međuvremenu promijenjen. Osvježi zadatke i pokušaj ponovno.',
                );
            }
            if (field.plantStatus !== 'pendingVerification') {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Sijanje ne čeka verifikaciju.',
                );
            }

            const event = await createEvent(
                knownEvents.raisedBedFields.plantUpdateV1(
                    `${validRaisedBedId.toString()}|${validPositionIndex.toString()}`,
                    { status: 'sowed' },
                ),
                transaction,
            );
            return {
                kind: 'planting',
                status: 'sowed',
                eventId: event.id,
                occurredAt: event.createdAt,
                created: true,
            };
        },
        transaction,
    );
}

export async function assignOperationTaskUsers(
    {
        assignedBy,
        assignedUserIds,
        expectedEntityId,
        expectedTaskVersionEventId,
        operationId,
    }: {
        assignedBy: string;
        assignedUserIds: readonly string[];
        expectedEntityId: number;
        expectedTaskVersionEventId: number;
        operationId: number;
    },
    transaction?: ScheduleTaskTransaction,
): Promise<ScheduleTaskAssignmentResult> {
    const validOperationId = assertPositiveSafeInteger(
        operationId,
        'ID radnje',
    );
    const nextAssignedUserIds = normalizeUserIds(assignedUserIds);
    const validExpectedEntityId = assertPositiveSafeInteger(
        expectedEntityId,
        'ID vrste radnje',
    );
    const validExpectedTaskVersionEventId = assertTaskVersionEventId(
        expectedTaskVersionEventId,
    );
    return withOperationScheduleTaskTransaction(
        validOperationId,
        async (tx) => {
            await assertCurrentAdmin(tx, assignedBy);
            await lockOperationAggregateRow(tx, validOperationId);
            const operation = await getOperationById(validOperationId, tx);
            const previousAssignedUserIds = operation.assignedUserIds;
            if (
                operation.entityId !== validExpectedEntityId ||
                operation.taskVersionEventId !== validExpectedTaskVersionEventId
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Radnja se u međuvremenu promijenila. Osvježi zadatke i pokušaj ponovno.',
                );
            }
            if (sameUserIdSet(previousAssignedUserIds, nextAssignedUserIds)) {
                return {
                    kind: 'operation',
                    changed: false,
                    eventId: null,
                    assignedAt: null,
                    previousAssignedUserIds,
                    assignedUserIds: previousAssignedUserIds,
                    newlyAssignedUserIds: [],
                };
            }
            if (
                operation.status !== 'new' &&
                operation.status !== 'planned' &&
                operation.status !== 'failed'
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Dodjela se više ne može promijeniti nakon završetka ili prijave prepreke.',
                );
            }
            if (operation.isAccepted && nextAssignedUserIds.length === 0) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Potvrđena radnja mora ostati dodijeljena korisniku.',
                );
            }

            if (nextAssignedUserIds.length > 0) {
                const lockedMembershipUserIds =
                    await lockOperationFarmUserMemberships(
                        validOperationId,
                        nextAssignedUserIds,
                        tx,
                    );
                if (
                    !sameUserIdSet(lockedMembershipUserIds, nextAssignedUserIds)
                ) {
                    throw new ScheduleTaskSubmissionError(
                        'not_authorized',
                        'Jedan od korisnika nije dostupan za ovu radnju.',
                    );
                }
            }

            const event = await createEvent(
                knownEvents.operations.assignedV1(validOperationId.toString(), {
                    assignedUserId: nextAssignedUserIds[0] ?? null,
                    assignedUserIds: nextAssignedUserIds,
                    assignedBy,
                }),
                tx,
            );
            return {
                kind: 'operation',
                changed: true,
                eventId: event.id,
                assignedAt: event.createdAt,
                previousAssignedUserIds,
                assignedUserIds: nextAssignedUserIds,
                newlyAssignedUserIds: nextAssignedUserIds.filter(
                    (userId) => !previousAssignedUserIds.includes(userId),
                ),
            };
        },
        transaction,
    );
}

export async function assignPlantingTaskUsers(
    {
        assignedBy,
        assignedUserIds,
        expectedPlantCycleEventId,
        expectedPlantCycleVersionEventId,
        expectedPlantSortId,
        positionIndex,
        raisedBedId,
    }: {
        assignedBy: string;
        assignedUserIds: readonly string[];
        expectedPlantCycleEventId: number;
        expectedPlantCycleVersionEventId: number;
        expectedPlantSortId: number;
        positionIndex: number;
        raisedBedId: number;
    },
    transaction?: ScheduleTaskTransaction,
): Promise<ScheduleTaskAssignmentResult> {
    const validRaisedBedId = assertPositiveSafeInteger(
        raisedBedId,
        'ID gredice',
    );
    const validPositionIndex = assertPositionIndex(positionIndex);
    const nextAssignedUserIds = normalizeUserIds(assignedUserIds);
    const validExpectedPlantCycleEventId = assertPositiveSafeInteger(
        expectedPlantCycleEventId,
        'ID ciklusa biljke',
    );
    const validExpectedPlantSortId = assertPositiveSafeInteger(
        expectedPlantSortId,
        'ID sorte biljke',
    );
    const validExpectedPlantCycleVersionEventId = assertTaskVersionEventId(
        expectedPlantCycleVersionEventId,
    );
    return withPlantingScheduleTaskTransaction(
        validRaisedBedId,
        validPositionIndex,
        async (tx) => {
            await assertCurrentAdmin(tx, assignedBy);
            const { farmId, field } = await getPlantingTaskContext(
                tx,
                validRaisedBedId,
                validPositionIndex,
            );
            const previousAssignedUserIds = field.assignedUserIds;
            const activePlantCycle = field.plantCycles.find(
                (plantCycle) => plantCycle.active,
            );
            if (
                activePlantCycle?.plantPlaceEventId !==
                    validExpectedPlantCycleEventId ||
                activePlantCycle?.endedEventId !==
                    validExpectedPlantCycleVersionEventId ||
                field.plantSortId !== validExpectedPlantSortId
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Sijanje se u međuvremenu promijenilo. Osvježi zadatke i pokušaj ponovno.',
                );
            }
            if (sameUserIdSet(previousAssignedUserIds, nextAssignedUserIds)) {
                return {
                    kind: 'planting',
                    changed: false,
                    eventId: null,
                    assignedAt: null,
                    previousAssignedUserIds,
                    assignedUserIds: previousAssignedUserIds,
                    newlyAssignedUserIds: [],
                };
            }
            if (
                field.plantStatus !== 'new' &&
                field.plantStatus !== 'planned'
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Dodjela sijanja više se ne može promijeniti nakon završetka ili prijave prepreke.',
                );
            }
            if (
                field.plantStatus === 'planned' &&
                nextAssignedUserIds.length === 0
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Potvrđeno sijanje mora ostati dodijeljeno korisniku.',
                );
            }

            if (nextAssignedUserIds.length > 0) {
                const lockedMembershipUserIds = await lockFarmUserMemberships(
                    tx,
                    farmId,
                    nextAssignedUserIds,
                );
                if (
                    !sameUserIdSet(lockedMembershipUserIds, nextAssignedUserIds)
                ) {
                    throw new ScheduleTaskSubmissionError(
                        'not_authorized',
                        'Jedan od korisnika nije dostupan za ovo sijanje.',
                    );
                }
            }

            const event = await createEvent(
                knownEvents.raisedBedFields.plantUpdateV1(
                    `${validRaisedBedId.toString()}|${validPositionIndex.toString()}`,
                    {
                        assignedUserId: nextAssignedUserIds[0] ?? null,
                        assignedUserIds: nextAssignedUserIds,
                        assignedBy,
                    },
                ),
                tx,
            );
            return {
                kind: 'planting',
                changed: true,
                eventId: event.id,
                assignedAt: event.createdAt,
                previousAssignedUserIds,
                assignedUserIds: nextAssignedUserIds,
                newlyAssignedUserIds: nextAssignedUserIds.filter(
                    (userId) => !previousAssignedUserIds.includes(userId),
                ),
            };
        },
        transaction,
    );
}
