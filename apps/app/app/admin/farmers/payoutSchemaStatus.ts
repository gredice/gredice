const missingPayoutSchemaCodes = new Set(['42P01', '42703']);

function getErrorCode(error: unknown): string | null {
    if (typeof error !== 'object' || error === null) {
        return null;
    }

    if ('code' in error && typeof error.code === 'string') {
        return error.code;
    }

    if ('cause' in error) {
        return getErrorCode(error.cause);
    }

    return null;
}

export function isMissingPayoutSchemaError(error: unknown) {
    const code = getErrorCode(error);
    return code !== null && missingPayoutSchemaCodes.has(code);
}
