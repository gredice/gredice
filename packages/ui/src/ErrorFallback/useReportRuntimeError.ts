'use client';

import { useEffect } from 'react';

type CaptureFn = (eventName: string, payload: Record<string, unknown>) => void;

type ReportRuntimeErrorOptions = {
    error: Error & { digest?: string };
    correlationId: string;
    capture: CaptureFn | null | undefined;
    boundary?: 'global';
};

// Intentionally omits `error.message` and `error.stack` from the captured payload:
// both can carry user input, tokens, or PII and can be very large. The full error
// still lands in the browser console (and server logs via Next.js), which is enough
// to triage by correlation id without leaking sensitive fields into analytics.
export function useReportRuntimeError({
    error,
    correlationId,
    capture,
    boundary,
}: ReportRuntimeErrorOptions) {
    useEffect(() => {
        const payload: Record<string, unknown> = {
            correlation_id: correlationId,
            digest: error.digest,
            name: error.name,
            pathname:
                typeof window !== 'undefined'
                    ? window.location.pathname
                    : undefined,
        };
        if (boundary) {
            payload.boundary = boundary;
        }

        capture?.('ui_runtime_error', payload);

        console.error('[ui_runtime_error]', {
            correlationId,
            digest: error.digest,
            error,
            ...(boundary ? { boundary } : {}),
        });
    }, [capture, correlationId, error, boundary]);
}
