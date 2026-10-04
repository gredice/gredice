import 'server-only';
import { createHash } from 'node:crypto';
import {
    getObservationImagePathPrefix,
    isObservationImageUploadPath,
    MAX_OBSERVATION_IMAGE_COUNT,
    normalizeObservationContent,
    parseObservationSubmissionId,
    parseRaisedBedObservationTarget,
    RaisedBedObservationError,
    type RaisedBedObservationTarget,
} from '@gredice/js/operations';
import { and, eq } from 'drizzle-orm';
import { bustEntityReadModelsForMutatedTypes } from '../cache/entityReadModelInvalidation';
import { bustScheduleCache } from '../cache/scheduleCache';
import { ensureRaisedBedObservationOperation } from '../helpers/raisedBedObservationOperation';
import {
    events,
    farms,
    farmUsers,
    gardens,
    operations,
    raisedBedFields,
    raisedBedPlantings,
    raisedBeds,
    users,
} from '../schema';
import { storage } from '../storage';
import { createEvent, knownEvents, knownEventTypes } from './events';
import { getRaisedBedFieldsWithEvents } from './raisedBedFieldsRepo';
import { getRaisedBedPlanting } from './raisedBedPlantingsRepo';
import {
    acquirePlantingScheduleTaskLock,
    acquireScheduleTaskAdvisoryLock,
    type ScheduleTaskTransaction,
} from './scheduleTaskTransactionsRepo';

type ObservationActor = { userId: string; role: 'farmer' | 'admin' };
const staleTargetMessage =
    'Biljka se u međuvremenu promijenila. Osvježi stranicu i ponovno odaberi biljku.';

async function authorizedContext(
    tx: ScheduleTaskTransaction,
    actor: ObservationActor,
    target: RaisedBedObservationTarget,
) {
    const [user] = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, actor.userId))
        .for('share');
    if (
        !user ||
        user.role !== actor.role ||
        !['farmer', 'admin'].includes(user.role)
    )
        throw new RaisedBedObservationError('Nemaš ovlast za slanje opažanja.');
    if (target.kind === 'field') {
        await acquirePlantingScheduleTaskLock(
            tx,
            target.raisedBedId,
            target.positionIndex,
        );
    } else if (target.kind === 'planting') {
        await acquireScheduleTaskAdvisoryLock(
            tx,
            `selected-raised-bed-planting:${target.plantingId}`,
        );
    }
    const [context] = await tx
        .select({ bed: raisedBeds, farmId: farms.id })
        .from(raisedBeds)
        .innerJoin(gardens, eq(gardens.id, raisedBeds.gardenId))
        .innerJoin(farms, eq(farms.id, gardens.farmId))
        .where(
            and(
                eq(raisedBeds.id, target.raisedBedId),
                eq(raisedBeds.isDeleted, false),
                eq(gardens.isDeleted, false),
                eq(gardens.isSandbox, false),
                eq(farms.isDeleted, false),
            ),
        )
        .for('share');
    if (!context || context.bed.status === 'abandoned')
        throw new RaisedBedObservationError(
            'Gredica nije dostupna za opažanje.',
        );
    if (actor.role === 'farmer') {
        const [membership] = await tx
            .select({ userId: farmUsers.userId })
            .from(farmUsers)
            .where(
                and(
                    eq(farmUsers.userId, actor.userId),
                    eq(farmUsers.farmId, context.farmId),
                ),
            )
            .for('share');
        if (!membership)
            throw new RaisedBedObservationError(
                'Gredica nije dostupna za opažanje.',
            );
    }
    let raisedBedFieldId: number | null = null;
    let plantingId: number | null = null;
    if (target.kind === 'field') {
        // Logical target locks precede location locks; physical crop locks follow
        // them, matching the crop guard used by ordinary operation writers.
        await tx
            .select({ id: raisedBedFields.id })
            .from(raisedBedFields)
            .where(
                and(
                    eq(raisedBedFields.raisedBedId, target.raisedBedId),
                    eq(raisedBedFields.positionIndex, target.positionIndex),
                ),
            )
            .for('update');
        const fields = await getRaisedBedFieldsWithEvents(
            target.raisedBedId,
            tx,
        );
        const field = fields.find(
            (field) =>
                field.positionIndex === target.positionIndex &&
                field.active &&
                !field.isDeleted,
        );
        if (
            field?.plantSortId !== target.expectedPlantSortId ||
            !field.plantCycles.some(
                (cycle) =>
                    cycle.active &&
                    cycle.plantPlaceEventId === target.plantCycleEventId,
            )
        )
            throw new RaisedBedObservationError(staleTargetMessage);
        raisedBedFieldId = field.id;
    } else if (target.kind === 'planting') {
        await tx
            .select({ id: raisedBedPlantings.id })
            .from(raisedBedPlantings)
            .where(eq(raisedBedPlantings.id, target.plantingId))
            .for('update');
        const planting = await getRaisedBedPlanting(target.plantingId, tx);
        if (
            !planting ||
            planting.raisedBedId !== target.raisedBedId ||
            planting.configurationSource !== 'selected' ||
            !planting.isActive ||
            planting.isDeleted ||
            planting.plantSortId !== target.expectedPlantSortId ||
            planting.lifecycleVersionEventId !==
                target.expectedLifecycleVersionEventId ||
            !planting.memberships.some(
                (membership) =>
                    !membership.isDeleted &&
                    !membership.raisedBedField.isDeleted,
            )
        )
            throw new RaisedBedObservationError(staleTargetMessage);
        plantingId = planting.id;
    }
    return { ...context, raisedBedFieldId, plantingId };
}

export async function validateRaisedBedObservationTarget(
    actor: ObservationActor,
    input: unknown,
) {
    const target = parseRaisedBedObservationTarget(input);
    await storage().transaction((tx) => authorizedContext(tx, actor, target));
    return target;
}

// Slots are never recycled: removed photos and failed uploads still consume the
// submission's budget. The token fixes this pathname without suffixes/overwrite.
export async function reserveRaisedBedObservationImage(input: {
    actor: ObservationActor;
    target: RaisedBedObservationTarget;
    submissionId: string;
    pathname: string;
}) {
    const target = parseRaisedBedObservationTarget(input.target);
    const submissionId = parseObservationSubmissionId(input.submissionId);
    if (
        typeof input.pathname !== 'string' ||
        !isObservationImageUploadPath(
            input.pathname,
            getObservationImagePathPrefix(
                target.raisedBedId,
                input.actor.userId,
                submissionId,
            ),
        )
    )
        throw new RaisedBedObservationError(
            'Putanja fotografije nije valjana.',
        );
    const receiptId = `observation:${input.actor.userId}:${submissionId}`;
    await storage().transaction(async (tx) => {
        await acquireScheduleTaskAdvisoryLock(tx, receiptId);
        await authorizedContext(tx, input.actor, target);
        const [receipt] = await tx
            .select({ id: events.id })
            .from(events)
            .where(
                and(
                    eq(
                        events.type,
                        knownEventTypes.raisedBeds.observationSubmitted,
                    ),
                    eq(events.aggregateId, receiptId),
                ),
            );
        if (receipt)
            throw new RaisedBedObservationError('Opažanje je već poslano.');
        const slots = await tx
            .select({ data: events.data })
            .from(events)
            .where(
                and(
                    eq(
                        events.type,
                        knownEventTypes.raisedBeds.observationImageReserved,
                    ),
                    eq(events.aggregateId, receiptId),
                ),
            );
        if (
            slots.some(
                ({ data }) =>
                    data &&
                    typeof data === 'object' &&
                    'pathname' in data &&
                    data.pathname === input.pathname,
            )
        )
            return;
        if (slots.length >= MAX_OBSERVATION_IMAGE_COUNT)
            throw new RaisedBedObservationError(
                'Za jedno opažanje možeš učitati najviše 20 fotografija.',
            );
        await createEvent(
            {
                type: knownEventTypes.raisedBeds.observationImageReserved,
                version: 1,
                aggregateId: receiptId,
                data: { pathname: input.pathname },
            },
            tx,
        );
    });
    return input.pathname;
}

export async function submitRaisedBedObservation(input: {
    actor: ObservationActor;
    target: RaisedBedObservationTarget;
    submissionId: string;
    notes: string;
    imageUrls: string[];
}) {
    const target = parseRaisedBedObservationTarget(input.target);
    const submissionId = parseObservationSubmissionId(input.submissionId);
    const content = normalizeObservationContent(
        input.notes,
        input.imageUrls,
        getObservationImagePathPrefix(
            target.raisedBedId,
            input.actor.userId,
            submissionId,
        ),
    );
    const fingerprint = createHash('sha256')
        .update(JSON.stringify({ target, ...content }))
        .digest('hex');
    const receiptId = `observation:${input.actor.userId}:${submissionId}`;
    const result = await storage().transaction(async (tx) => {
        await acquireScheduleTaskAdvisoryLock(tx, receiptId);
        // Replay remains valid after the plant changes; only the original actor can read this receipt.
        const [user] = await tx
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, input.actor.userId))
            .for('share');
        if (
            !user ||
            user.role !== input.actor.role ||
            !['farmer', 'admin'].includes(user.role)
        )
            throw new RaisedBedObservationError(
                'Nemaš ovlast za slanje opažanja.',
            );
        const [receipt] = await tx
            .select({ data: events.data })
            .from(events)
            .where(
                and(
                    eq(
                        events.type,
                        knownEventTypes.raisedBeds.observationSubmitted,
                    ),
                    eq(events.aggregateId, receiptId),
                ),
            );
        if (receipt) {
            const data = receipt.data;
            if (
                !data ||
                typeof data !== 'object' ||
                !('fingerprint' in data) ||
                data.fingerprint !== fingerprint ||
                !('operationId' in data) ||
                typeof data.operationId !== 'number'
            )
                throw new RaisedBedObservationError(
                    'Ovo opažanje je već poslano s drugim sadržajem.',
                );
            return {
                operationId: data.operationId,
                catalogueCreated:
                    'catalogueCreated' in data &&
                    data.catalogueCreated === true,
            };
        }
        const { bed, farmId, raisedBedFieldId, plantingId } =
            await authorizedContext(tx, input.actor, target);
        const definition = await ensureRaisedBedObservationOperation(tx);
        const now = new Date();
        // Observation is already performed work. Its own target guard allows observations before sowing too.
        const [operation] = await tx
            .insert(operations)
            .values({
                entityId: definition.id,
                entityTypeName: 'operation',
                accountId: bed.accountId,
                gardenId: bed.gardenId,
                farmId,
                raisedBedId: bed.id,
                raisedBedFieldId,
                plantingId,
                timestamp: now,
                isAccepted: true,
            })
            .returning({ id: operations.id });
        if (!operation)
            throw new Error('Observation operation was not created.');
        await createEvent(
            {
                type: knownEventTypes.operations.observationRecorded,
                version: 1,
                aggregateId: String(operation.id),
                data: {
                    target,
                    entityId: definition.id,
                    recordedBy: input.actor.userId,
                    catalogueCreated: definition.created,
                },
            },
            tx,
        );
        await createEvent(
            knownEvents.operations.scheduledV1(String(operation.id), {
                scheduledDate: now.toISOString(),
            }),
            tx,
        );
        await createEvent(
            knownEvents.operations.assignedV1(String(operation.id), {
                assignedUserId: input.actor.userId,
                assignedUserIds: [input.actor.userId],
                assignedBy: input.actor.userId,
            }),
            tx,
        );
        await createEvent(
            knownEvents.operations.completedV1(String(operation.id), {
                completedBy: input.actor.userId,
                notes: content.notes,
                images: content.imageUrls,
            }),
            tx,
        );
        await createEvent(
            {
                type: knownEventTypes.raisedBeds.observationSubmitted,
                version: 1,
                aggregateId: receiptId,
                data: {
                    operationId: operation.id,
                    fingerprint,
                    target,
                    recordedBy: input.actor.userId,
                },
            },
            tx,
        );
        return {
            operationId: operation.id,
            catalogueCreated: definition.created,
        };
    });
    await bustScheduleCache();
    if (result.catalogueCreated)
        await bustEntityReadModelsForMutatedTypes(['operation']);
    return { operationId: result.operationId };
}
