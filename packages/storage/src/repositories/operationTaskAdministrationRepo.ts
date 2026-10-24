import 'server-only';
import { and, eq } from 'drizzle-orm';
import { operationTaskAdminSchema } from '../operationTaskAdministration';
import { entities, operations, users } from '../schema';
import { createEvent, knownEvents } from './events';
import {
    getOperationById,
    lockOperationFarmUserMemberships,
    switchOperationEntity,
} from './operationsRepo';
import { ScheduleTaskSubmissionError } from './scheduleTaskSubmissionsRepo';
import { withOperationScheduleTaskTransaction } from './scheduleTaskTransactionsRepo';
import { applySelectedPlantingOperationVerification } from './selectedPlantingOperationsRepo';

/** Append an audited correction; never rewrite the original task events. */
export async function administerOperationTask({
    operationId,
    expectedTaskVersionEventId,
    updatedBy,
    values,
}: {
    operationId: number;
    expectedTaskVersionEventId: number;
    updatedBy: string;
    values: unknown;
}) {
    const task = operationTaskAdminSchema.parse(values);
    if (
        !Number.isSafeInteger(expectedTaskVersionEventId) ||
        expectedTaskVersionEventId < 0
    ) {
        throw new ScheduleTaskSubmissionError(
            'invalid_input',
            'Verzija zadatka nije ispravna.',
        );
    }
    return withOperationScheduleTaskTransaction(operationId, async (tx) => {
        const [admin] = await tx
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, updatedBy))
            .for('share');
        if (admin?.role !== 'admin') {
            throw new ScheduleTaskSubmissionError(
                'not_authorized',
                'Samo administrator može urediti zadatak.',
            );
        }
        const current = await getOperationById(operationId, tx);
        if (current.taskVersionEventId !== expectedTaskVersionEventId) {
            throw new ScheduleTaskSubmissionError(
                'task_changed',
                'Radnja se u međuvremenu promijenila.',
            );
        }
        const assignedUserIds = [...new Set(task.assignedUserIds)];
        const newlyAssignedUserIds = assignedUserIds.filter(
            (id) => !current.assignedUserIds.includes(id),
        );
        // Historical assignees can remain after leaving a farm; new assignees must be farm members.
        const memberships = await lockOperationFarmUserMemberships(
            operationId,
            newlyAssignedUserIds,
            tx,
        );
        if (memberships.length !== newlyAssignedUserIds.length) {
            throw new ScheduleTaskSubmissionError(
                'not_authorized',
                'Jedan od korisnika nije dostupan na ovoj farmi.',
            );
        }
        if (task.entityId !== current.entityId) {
            const entity = await tx.query.entities.findFirst({
                where: and(
                    eq(entities.id, task.entityId),
                    eq(entities.entityTypeName, 'operation'),
                    eq(entities.isDeleted, false),
                ),
            });
            if (!entity)
                throw new ScheduleTaskSubmissionError(
                    'invalid_input',
                    'Odabrana radnja nije dostupna.',
                );
            await switchOperationEntity(
                operationId,
                { entityId: task.entityId, entityTypeName: 'operation' },
                tx,
                {
                    requireMatchingTargetScope: true,
                    allowSelectedPlantingFieldOperations: true,
                },
            );
        }
        await tx
            .update(operations)
            .set({
                isAccepted: task.isAccepted,
                timestamp: new Date(task.timestamp),
                createdAt: new Date(task.createdAt),
            })
            .where(eq(operations.id, operationId));
        const assignmentChanged =
            assignedUserIds.length !== current.assignedUserIds.length ||
            assignedUserIds.some((id) => !current.assignedUserIds.includes(id));
        const completing = task.completedAt !== null && !current.completedAt;
        const verifying =
            task.status === 'completed' && current.status !== 'completed';
        const event = await createEvent(
            knownEvents.operations.adminUpdatedV1(operationId.toString(), {
                task: { ...task, assignedUserIds },
                updatedBy,
                previous: {
                    entityId: current.entityId,
                    isAccepted: current.isAccepted,
                    timestamp: current.timestamp.toISOString(),
                    createdAt: current.createdAt.toISOString(),
                },
                assignedBy: assignmentChanged
                    ? updatedBy
                    : (current.assignedBy ?? null),
                completedBy: completing
                    ? updatedBy
                    : (current.completedBy ?? null),
                verifiedBy: verifying
                    ? updatedBy
                    : (current.verifiedBy ?? null),
                blockedBy:
                    task.status === 'blocked' && current.status !== 'blocked'
                        ? updatedBy
                        : (current.blockedBy ?? null),
                canceledBy:
                    task.status === 'canceled' && current.status !== 'canceled'
                        ? updatedBy
                        : (current.canceledBy ?? null),
                completionEventId: task.completedAt
                    ? (current.completionEventId ?? null)
                    : null,
                verificationEventId: task.verifiedAt
                    ? (current.verificationEventId ?? null)
                    : null,
                blockedEventId: task.blockedAt
                    ? (current.blockedEventId ?? null)
                    : null,
            }),
            tx,
        );
        if (verifying) {
            await applySelectedPlantingOperationVerification(
                { ...current, entityId: task.entityId },
                event.id,
                updatedBy,
                tx,
            );
        }
        return event;
    });
}
