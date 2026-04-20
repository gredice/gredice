'use client';

import {
    ErrorFallback,
    generateCorrelationId,
    useReportRuntimeError,
} from '@gredice/ui/ErrorFallback';
import { usePostHog } from '@posthog/next';
import { useMemo } from 'react';

type ErrorPageProps = {
    error: Error & { digest?: string };
    reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorPageProps) {
    const posthog = usePostHog();
    const correlationId = useMemo(() => generateCorrelationId(), []);

    useReportRuntimeError({
        error,
        correlationId,
        capture: posthog?.capture.bind(posthog),
        boundary: 'global',
    });

    return (
        <html lang="hr">
            <body>
                <ErrorFallback
                    correlationId={correlationId}
                    onRetry={reset}
                    variant="global"
                />
            </body>
        </html>
    );
}
