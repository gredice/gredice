export const OPERATION_SCHEDULE_CONFLICT_MESSAGE =
    'Radnja se u međuvremenu promijenila. Osvježi stranicu i pokušaj ponovno.';

export type OperationScheduleActionResult =
    | { success: true }
    | { success: false; message: string };

export class OperationScheduleConflictError extends Error {
    constructor() {
        super(OPERATION_SCHEDULE_CONFLICT_MESSAGE);
        this.name = 'OperationScheduleConflictError';
    }
}

function isScheduleTaskConflictError(error: unknown): boolean {
    return (
        error instanceof Error &&
        error.name === 'ScheduleTaskSubmissionError' &&
        'code' in error &&
        error.code === 'task_changed'
    );
}

export async function runOperationScheduleAction(
    action: () => Promise<void>,
): Promise<OperationScheduleActionResult> {
    try {
        await action();
        return { success: true };
    } catch (error) {
        if (
            error instanceof OperationScheduleConflictError ||
            isScheduleTaskConflictError(error)
        ) {
            return {
                success: false,
                message: OPERATION_SCHEDULE_CONFLICT_MESSAGE,
            };
        }

        throw error;
    }
}

export function getOperationScheduleActionFailureMessage(
    result: unknown,
): string | undefined {
    if (Array.isArray(result)) {
        for (const item of result) {
            const message = getOperationScheduleActionFailureMessage(item);
            if (message) {
                return message;
            }
        }
        return undefined;
    }

    if (
        typeof result !== 'object' ||
        result === null ||
        !('success' in result) ||
        result.success !== false ||
        !('message' in result) ||
        typeof result.message !== 'string'
    ) {
        return undefined;
    }

    return result.message;
}
