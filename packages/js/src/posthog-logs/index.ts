import { type ExportResult, ExportResultCode } from '@opentelemetry/core';
import { OTLPExporterBase } from '@opentelemetry/otlp-exporter-base';
import { createLegacyOtlpBrowserExportDelegate } from '@opentelemetry/otlp-exporter-base/browser-http';
import { JsonLogsSerializer } from '@opentelemetry/otlp-transformer';
import type {
    LogRecordExporter,
    ReadableLogRecord,
} from '@opentelemetry/sdk-logs';

export const POSTHOG_LOG_BATCH_DELAY_MS = 1_000;
export const POSTHOG_LOG_EXPORT_TIMEOUT_MS = 5_000;
export const POSTHOG_LOG_FALLBACK_DELAY_MS = 5 * 60_000;
export const POSTHOG_LOG_PROCESSOR_TIMEOUT_MS = 12_000;
export const POSTHOG_LOG_FLUSH_TIMEOUT_MS = 13_000;
export const POSTHOG_LOG_INITIAL_FAILURE_BACKOFF_MS = 30_000;
export const POSTHOG_LOG_MAX_FAILURE_BACKOFF_MS = 5 * 60_000;
const POSTHOG_LOG_TIMEOUT_RETRY_COUNT = 1;

export function getPostHogLogsUrl(host: string | undefined): string | null {
    if (!host) {
        return null;
    }

    const ingestHost = host
        .replace(/:\/\/app\.posthog\.com(?=\/|$)/, '://us.i.posthog.com')
        .replace(/:\/\/us\.posthog\.com(?=\/|$)/, '://us.i.posthog.com')
        .replace(/:\/\/eu\.posthog\.com(?=\/|$)/, '://eu.i.posthog.com');

    return `${ingestHost.replace(/\/+$/, '')}/i/v1/logs`;
}

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
    registerBackgroundTask?: (task: Promise<void>) => void;
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

function isAbortError(error: unknown): boolean {
    let currentError = error;

    for (let depth = 0; depth < 3; depth += 1) {
        if (typeof currentError !== 'object' || currentError === null) {
            return false;
        }

        if ('name' in currentError && currentError.name === 'AbortError') {
            return true;
        }

        currentError = 'cause' in currentError ? currentError.cause : undefined;
    }

    return false;
}

/**
 * Uses OpenTelemetry's fetch transport so its AbortController deadline covers
 * connection setup as well as response inactivity in short-lived runtimes.
 */
export class FetchOTLPLogExporter
    extends OTLPExporterBase<ReadableLogRecord[]>
    implements LogRecordExporter
{
    private pendingExportError: Error | null = null;

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

    override export(
        items: ReadableLogRecord[],
        resultCallback: (result: ExportResult) => void,
    ): void {
        this.exportWithTimeoutRetry(
            items,
            POSTHOG_LOG_TIMEOUT_RETRY_COUNT,
            resultCallback,
        );
    }

    private exportWithTimeoutRetry(
        items: ReadableLogRecord[],
        timeoutRetriesRemaining: number,
        resultCallback: (result: ExportResult) => void,
    ): void {
        super.export(items, (result) => {
            if (result.code === ExportResultCode.SUCCESS) {
                resultCallback(result);
                return;
            }

            if (timeoutRetriesRemaining > 0 && isAbortError(result.error)) {
                this.exportWithTimeoutRetry(
                    items,
                    timeoutRetriesRemaining - 1,
                    resultCallback,
                );
                return;
            }

            this.pendingExportError =
                result.error ?? new Error('PostHog OTLP log export failed');

            // BatchLogRecordProcessor reports every failed result through the
            // global error handler and then resolves forceFlush(). Record the
            // error here and let the bounded scheduler report only persistent
            // failures instead of amplifying one warning per export attempt.
            resultCallback({ code: ExportResultCode.SUCCESS });
        });
    }

    async forceFlushWithErrorPropagation(
        forceFlush: () => Promise<void>,
    ): Promise<void> {
        let forceFlushError: unknown;
        let forceFlushFailed = false;

        try {
            await forceFlush();
        } catch (error) {
            forceFlushError = error;
            forceFlushFailed = true;
        }

        const exportError = this.pendingExportError;
        this.pendingExportError = null;

        if (forceFlushFailed) {
            throw forceFlushError;
        }

        if (exportError) {
            throw exportError;
        }
    }
}

export function createPostHogLogFlushScheduler({
    batchDelayMs,
    flush,
    initialFailureBackoffMs,
    maxFailureBackoffMs,
    now = Date.now,
    onPersistentError,
    registerBackgroundTask,
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

        registerBackgroundTask?.(pendingFlush);

        return pendingFlush;
    };
}
