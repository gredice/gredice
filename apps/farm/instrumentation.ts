import { SeverityNumber } from '@opentelemetry/api-logs';
import type { Instrumentation } from 'next';

import {
    flushPostHogLogs,
    getPostHogLogger,
    isPostHogLoggingEnabled,
    POSTHOG_SERVICE_NAME,
    registerPostHogConsoleForwarding,
    registerPostHogLoggerProvider,
} from './lib/posthog-server';

const requestLogger = getPostHogLogger(`${POSTHOG_SERVICE_NAME}.request`);

export async function register() {
    registerPostHogLoggerProvider();
    registerPostHogConsoleForwarding();
}

export const onRequestError: Instrumentation.onRequestError = async (
    error,
    request,
    context,
) => {
    if (!isPostHogLoggingEnabled()) {
        return;
    }

    const errorDigest =
        typeof error === 'object' &&
        error !== null &&
        'digest' in error &&
        typeof error.digest === 'string'
            ? error.digest
            : undefined;
    const requestError = error instanceof Error ? error : undefined;

    requestLogger.emit({
        attributes: {
            ...(errorDigest ? { 'error.digest': errorDigest } : {}),
            ...(requestError?.name ? { 'error.name': requestError.name } : {}),
            ...(requestError?.stack
                ? { 'error.stack': requestError.stack }
                : {}),
            'http.method': request.method,
            'next.route_path': context.routePath,
            'next.route_type': context.routeType,
            'next.router_kind': context.routerKind,
            'url.path': request.path,
            ...(context.renderSource
                ? { 'next.render_source': context.renderSource }
                : {}),
            ...(context.revalidateReason
                ? { 'next.revalidate_reason': context.revalidateReason }
                : {}),
        },
        body: requestError?.message || 'Unhandled request error',
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
    });

    await flushPostHogLogs();
};
