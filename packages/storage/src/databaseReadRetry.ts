import {
    isRetryableNeonReadError,
    neonPoolErrorDetails,
} from './neonPoolError';

type DiagnosticValue = string | number | boolean | null | undefined;

type DatabaseReadRetryOptions = {
    operation: string;
    context?: Readonly<Record<string, DiagnosticValue>>;
};

export async function withTransientDatabaseReadRetry<T>(
    read: () => Promise<T>,
    { operation, context = {} }: DatabaseReadRetryOptions,
) {
    const maxAttempts = 2;
    let firstErrorDetails: ReturnType<typeof neonPoolErrorDetails> | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const result = await read();
            if (attempt > 1) {
                console.warn(
                    'Database read recovered after transient failure',
                    {
                        ...context,
                        event: 'storage.database.read.recovered',
                        operation,
                        attempt,
                        error: firstErrorDetails,
                    },
                );
            }
            return result;
        } catch (error) {
            const errorDetails = neonPoolErrorDetails(error);
            const retryable = isRetryableNeonReadError(error);
            if (attempt < maxAttempts && retryable) {
                firstErrorDetails = errorDetails;
                console.warn('Transient database read failed; retrying once', {
                    ...context,
                    event: 'storage.database.read.retry',
                    operation,
                    attempt,
                    maxAttempts,
                    error: errorDetails,
                });
                continue;
            }

            console.error('Database read failed', {
                ...context,
                event: 'storage.database.read.failed',
                operation,
                attempt,
                maxAttempts,
                retryable,
                error: errorDetails,
            });
            throw error;
        }
    }

    throw new Error('Database read retry loop exhausted unexpectedly');
}
