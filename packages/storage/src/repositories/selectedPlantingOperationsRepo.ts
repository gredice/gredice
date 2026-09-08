import 'server-only';
import { and, eq } from 'drizzle-orm';
import { v5 as uuidV5 } from 'uuid';
import { bustScheduleCache } from '../cache/scheduleCache';
import { operations, raisedBeds } from '../schema';
import { createEvent, knownEvents } from './events';
import {
    acceptOperation,
    assertOperationTargetAllowsDefinition,
    createOperation,
    getOperationById,
} from './operationsRepo';
import { getRaisedBedPlanting } from './raisedBedPlantingsRepo';
import {
    getSelectedRaisedBedPlantingTaskForActor,
    type SelectedRaisedBedPlantingTaskCommandIdentity,
    transplantSelectedRaisedBedPlanting,
    updateSelectedRaisedBedPlantingLifecycleStatus,
} from './raisedBedPlantingTasksRepo';
import {
    type ScheduleTaskActor,
    ScheduleTaskSubmissionError,
} from './scheduleTaskSubmissionsRepo';
import {
    type ScheduleTaskTransaction,
    withSelectedRaisedBedPlantingScheduleTaskTransaction,
} from './scheduleTaskTransactionsRepo';

export const SELECTED_PLANTING_TRANSPLANT_OPERATION_ID = 593;

export async function createSelectedPlantingOperation(
    input: SelectedRaisedBedPlantingTaskCommandIdentity & {
        actor: ScheduleTaskActor;
        entityId: number;
    },
) {
    if (
        input.actor.role !== 'admin' ||
        !Number.isSafeInteger(input.entityId) ||
        input.entityId <= 0
    ) {
        throw new ScheduleTaskSubmissionError(
            'not_authorized',
            'Radnju sadnje može kreirati administrator.',
        );
    }
    const result = await withSelectedRaisedBedPlantingScheduleTaskTransaction(
        input.plantingId,
        async (tx) => {
            const task = await getSelectedRaisedBedPlantingTaskForActor(
                input,
                tx,
            );
            if (
                task.identity.expectedLifecycleVersionEventId !==
                    input.expectedLifecycleVersionEventId ||
                task.identity.expectedPlantSortId !== input.expectedPlantSortId
            ) {
                throw new ScheduleTaskSubmissionError(
                    'task_changed',
                    'Sadnja se promijenila. Osvježi stranicu.',
                );
            }
            const planting = await getRaisedBedPlanting(input.plantingId, tx);
            if (
                !planting?.isActive ||
                (planting.lifecycleStoppedAt && input.entityId !== 346) ||
                task.status !== 'completed'
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Sadnja više nije dostupna za radnju.',
                );
            }
            if (
                input.entityId === SELECTED_PLANTING_TRANSPLANT_OPERATION_ID &&
                (task.sowingLocation !== 'greenhouse' ||
                    planting.lifecycleStatus !== 'sprouted')
            ) {
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Presađivanje je dostupno za proklijalu sadnju u stakleniku.',
                );
            }
            const existing = await tx.query.operations.findMany({
                where: and(
                    eq(operations.plantingId, input.plantingId),
                    eq(operations.entityId, input.entityId),
                    eq(operations.isDeleted, false),
                ),
            });
            for (const candidate of existing) {
                const operation = await getOperationById(candidate.id, tx);
                if (
                    [
                        'new',
                        'planned',
                        'blocked',
                        'pendingVerification',
                    ].includes(operation.status)
                )
                    return { operationId: candidate.id, created: false };
            }
            const bed = await tx.query.raisedBeds.findFirst({
                where: eq(raisedBeds.id, planting.raisedBedId),
            });
            if (!bed?.accountId || !bed.gardenId)
                throw new ScheduleTaskSubmissionError(
                    'invalid_status',
                    'Gredica nije dostupna.',
                );
            const timestamp = new Date();
            const operationId = await createOperation(
                {
                    entityId: input.entityId,
                    entityTypeName: 'operation',
                    plantingId: planting.id,
                    raisedBedId: bed.id,
                    gardenId: bed.gardenId,
                    accountId: bed.accountId,
                    timestamp,
                },
                tx,
            );
            await createEvent(
                knownEvents.operations.scheduledV1(operationId.toString(), {
                    scheduledDate: timestamp.toISOString(),
                }),
                tx,
            );
            await acceptOperation(operationId, tx);
            return { operationId, created: true };
        },
    );
    await bustScheduleCache();
    return result;
}

/** Runs in the operation verification transaction; failure rolls back verification too. */
export async function applySelectedPlantingOperationVerification(
    operation: Pick<
        Awaited<ReturnType<typeof getOperationById>>,
        | 'id'
        | 'plantingId'
        | 'entityId'
        | 'entityTypeName'
        | 'raisedBedId'
        | 'raisedBedFieldId'
        | 'accountId'
        | 'gardenId'
    >,
    verificationEventId: number,
    verifiedBy: string,
    tx: ScheduleTaskTransaction,
) {
    if (operation.plantingId)
        await assertOperationTargetAllowsDefinition(operation, tx);
    if (
        !operation.plantingId ||
        ![SELECTED_PLANTING_TRANSPLANT_OPERATION_ID, 346].includes(
            operation.entityId,
        )
    )
        return;
    const task = await getSelectedRaisedBedPlantingTaskForActor(
        {
            plantingId: operation.plantingId,
            actor: { role: 'admin', userId: verifiedBy },
        },
        tx,
    );
    if (operation.entityId === 346) {
        await updateSelectedRaisedBedPlantingLifecycleStatus(
            {
                ...task.identity,
                actor: { role: 'admin', userId: verifiedBy },
                commandId: uuidV5(
                    `selected-removal-operation:${operation.id}:verification:${verificationEventId}`,
                    uuidV5.URL,
                ),
                status: 'removed',
            },
            tx,
        );
        return;
    }
    await transplantSelectedRaisedBedPlanting(
        {
            ...task.identity,
            actor: { role: 'admin', userId: verifiedBy },
            commandId: uuidV5(
                `selected-transplant-operation:${operation.id}:verification:${verificationEventId}`,
                uuidV5.URL,
            ),
            operationId: operation.id,
        },
        tx,
    );
}
