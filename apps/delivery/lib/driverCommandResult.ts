export type DriverCommandResult =
    | { status: 'saved' }
    | { status: 'failed'; message: string };

export function isDriverCommandResult(
    value: unknown,
): value is DriverCommandResult {
    if (!value || typeof value !== 'object' || !('status' in value)) {
        return false;
    }
    return value.status === 'saved' || value.status === 'failed';
}
