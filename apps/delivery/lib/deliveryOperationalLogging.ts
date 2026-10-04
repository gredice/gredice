import 'server-only';

export const deliveryRouteFallbackLogMessage =
    'Delivery route fallback selected';

export type DeliveryRouteFallbackPhase =
    | 'initial-route'
    | 'live-eta'
    | 'reroute';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function boundedToken(value: unknown, fallback: string) {
    return typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 64 &&
        /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
        ? value
        : fallback;
}

function boundedMutationCount(value: number | undefined) {
    return value !== undefined &&
        Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= 10_000
        ? { mutationCount: value }
        : {};
}

export function deliveryOperationalOpaqueId(value: unknown) {
    return typeof value === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
            value,
        )
        ? value
        : 'id-unavailable';
}

export function deliveryOperationalErrorContext(error: unknown) {
    return {
        errorCode: boundedToken(
            isRecord(error) ? error.code : undefined,
            'unclassified',
        ),
        errorName: boundedToken(
            error instanceof Error ? error.name : undefined,
            'UnknownError',
        ),
    };
}

export function deliveryOperationRejectionLogContext({
    errorCode,
    mutationCount,
}: {
    errorCode: unknown;
    mutationCount?: number;
}) {
    return {
        errorCode: boundedToken(errorCode, 'unclassified'),
        ...boundedMutationCount(mutationCount),
    };
}

export function deliveryOperationFailureLogContext({
    error,
    mutationCount,
}: {
    error: unknown;
    mutationCount?: number;
}) {
    return {
        ...deliveryOperationalErrorContext(error),
        ...boundedMutationCount(mutationCount),
    };
}

export function deliveryRouteFallbackLogContext({
    error,
    nodeCount,
    phase,
}: {
    error: unknown;
    nodeCount: number;
    phase: DeliveryRouteFallbackPhase;
}) {
    const errorContext = deliveryOperationalErrorContext(error);
    return {
        ...errorContext,
        errorCode:
            errorContext.errorCode === 'unclassified'
                ? `google-${phase}-failed`
                : errorContext.errorCode,
        fallback: 'local' as const,
        nodeCount,
        phase,
        provider: 'google' as const,
    };
}
