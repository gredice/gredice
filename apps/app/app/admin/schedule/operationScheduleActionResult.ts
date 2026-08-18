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

export async function runOperationScheduleAction(
    action: () => Promise<void>,
): Promise<OperationScheduleActionResult> {
    try {
        await action();
        return { success: true };
    } catch (error) {
        if (error instanceof OperationScheduleConflictError) {
            return { success: false, message: error.message };
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
