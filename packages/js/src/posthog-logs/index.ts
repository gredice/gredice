import { OTLPExporterBase } from '@opentelemetry/otlp-exporter-base';
import { createLegacyOtlpBrowserExportDelegate } from '@opentelemetry/otlp-exporter-base/browser-http';
import { JsonLogsSerializer } from '@opentelemetry/otlp-transformer';
import type {
    LogRecordExporter,
    ReadableLogRecord,
} from '@opentelemetry/sdk-logs';

export const POSTHOG_LOG_BATCH_DELAY_MS = 1_000;
export const POSTHOG_LOG_EXPORT_TIMEOUT_MS = 5_000;
export const POSTHOG_LOG_PROCESSOR_TIMEOUT_MS = 6_000;
export const POSTHOG_LOG_FLUSH_TIMEOUT_MS = 7_000;
export const POSTHOG_LOG_INITIAL_FAILURE_BACKOFF_MS = 30_000;
export const POSTHOG_LOG_MAX_FAILURE_BACKOFF_MS = 5 * 60_000;

type PostHogLogFlushErrorContext = {
    consecutiveFailures: number;
    retryInMs: number;
};

type PostHogLogFlushSchedulerOptions = {
    batchDelayMs: number;
    flush: () => Promise<void>;
    initialFailureBackoffMs: number;
    maxFailureBackoffMs: number;
    now?: () => number;
    onPersistentError: (
        error: unknown,
        context: PostHogLogFlushErrorContext,
    ) => void;
    wait?: (delayMs: number) => Promise<void>;
};

type FetchOTLPLogExporterOptions = {
    headers: Record<string, string>;
    timeoutMillis: number;
    url: string;
};

function waitFor(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, delayMs);
    });
}

/**
 * Uses OpenTelemetry's fetch transport so its AbortController deadline covers
 * connection setup as well as response inactivity in short-lived runtimes.
 */
export class FetchOTLPLogExporter
    extends OTLPExporterBase<ReadableLogRecord[]>
    implements LogRecordExporter
{
    constructor(options: FetchOTLPLogExporterOptions) {
        super(
            createLegacyOtlpBrowserExportDelegate(
                options,
                JsonLogsSerializer,
                'v1/logs',
                { 'Content-Type': 'application/json' },
            ),
        );
    }
}

export function createPostHogLogFlushScheduler({
    batchDelayMs,
    flush,
    initialFailureBackoffMs,
    maxFailureBackoffMs,
    now = Date.now,
    onPersistentError,
    wait = waitFor,
}: PostHogLogFlushSchedulerOptions): () => Promise<void> {
    let consecutiveFailures = 0;
    let failureBackoffMs = initialFailureBackoffMs;
    let hasReportedFailure = false;
    let pendingFlush: Promise<void> | null = null;
    let retryAfter = 0;

    return function schedulePostHogLogFlush(): Promise<void> {
        if (pendingFlush) {
            return pendingFlush;
        }

        if (now() < retryAfter) {
            return Promise.resolve();
        }

        pendingFlush = wait(batchDelayMs)
            .then(flush)
            .then(() => {
                consecutiveFailures = 0;
                failureBackoffMs = initialFailureBackoffMs;
                hasReportedFailure = false;
                retryAfter = 0;
            })
            .catch((error) => {
                consecutiveFailures += 1;
                const retryInMs = failureBackoffMs;
                retryAfter = now() + retryInMs;
                failureBackoffMs = Math.min(
                    failureBackoffMs * 2,
                    maxFailureBackoffMs,
                );

                if (consecutiveFailures >= 2 && !hasReportedFailure) {
                    hasReportedFailure = true;
                    onPersistentError(error, {
                        consecutiveFailures,
                        retryInMs,
                    });
                }
            })
            .finally(() => {
                pendingFlush = null;
            });

        return pendingFlush;
    };
}
