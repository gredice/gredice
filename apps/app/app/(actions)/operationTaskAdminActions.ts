'use server';

import {
    administerOperationTask,
    getOperationById,
    OperationTargetConflictError,
} from '@gredice/storage';
import { operationTaskAdminSchema } from '@gredice/storage/operationTaskAdministration';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';
import { OPERATION_SCHEDULE_CONFLICT_MESSAGE } from '../admin/schedule/operationScheduleActionResult';

export async function updateOperationTaskAdminAction(
    operationId: number,
    expectedTaskVersionEventId: number,
    values: unknown,
) {
    const { userId } = await auth(['admin']);
    const parsed = operationTaskAdminSchema.safeParse(values);
    if (!parsed.success)
        return {
            success: false,
            message:
                parsed.error.issues[0]?.message ?? 'Provjeri unesene podatke.',
        };
    try {
        await administerOperationTask({
            operationId,
            expectedTaskVersionEventId,
            updatedBy: userId,
            values: parsed.data,
        });
    } catch (error) {
        if (error instanceof OperationTargetConflictError)
            return { success: false, message: error.message };
        if (
            error instanceof Error &&
            error.name === 'ScheduleTaskSubmissionError' &&
            'code' in error
        ) {
            return {
                success: false,
                conflict: error.code === 'task_changed',
                message:
                    error.code === 'task_changed'
                        ? OPERATION_SCHEDULE_CONFLICT_MESSAGE
                        : error.message,
            };
        }
        console.error('Operation task administration failed', { operationId });
        return {
            success: false,
            message: 'Spremanje nije uspjelo. Pokušaj ponovno.',
        };
    }
    const operation = await getOperationById(operationId);
    for (const path of [
        KnownPages.Operation(operationId),
        KnownPages.Operations,
        KnownPages.Schedule,
        KnownPages.Approvals,
        operation.accountId ? KnownPages.Account(operation.accountId) : null,
        operation.farmId ? KnownPages.Farm(operation.farmId) : null,
        operation.gardenId ? KnownPages.Garden(operation.gardenId) : null,
        operation.raisedBedId
            ? KnownPages.RaisedBed(operation.raisedBedId)
            : null,
    ]) {
        if (path) revalidatePath(path);
    }
    return { success: true };
}
