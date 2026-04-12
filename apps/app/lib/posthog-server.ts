import { type Logger, logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
    BatchLogRecordProcessor,
    LoggerProvider,
} from '@opentelemetry/sdk-logs';

type PostHogCaptureClient = {
    capture: (payload: {
        distinctId: string;
        event: string;
        properties?: Record<string, unknown>;
    }) => unknown;
};

export const POSTHOG_SERVICE_NAME = 'gredice-app';

const postHogApiKey =
    process.env.NEXT_PUBLIC_POSTHOG_KEY ??
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

const postHogLogsUrl = process.env.NEXT_PUBLIC_POSTHOG_HOST
    ? `${process.env.NEXT_PUBLIC_POSTHOG_HOST.replace(/\/$/, '')}/i/v1/logs`
    : null;

const noopPostHogClient: PostHogCaptureClient = {
    capture: () => undefined,
};

const postHogLogsProcessor =
    postHogApiKey && postHogLogsUrl
        ? new BatchLogRecordProcessor(
              new OTLPLogExporter({
                  headers: {
                      Authorization: `Bearer ${postHogApiKey}`,
                      'Content-Type': 'application/json',
                  },
                  url: postHogLogsUrl,
              }),
          )
        : null;

export const loggerProvider = new LoggerProvider({
    processors: postHogLogsProcessor ? [postHogLogsProcessor] : [],
    resource: resourceFromAttributes({
        'service.name': POSTHOG_SERVICE_NAME,
        'service.namespace': 'gredice',
    }),
});

export function registerPostHogLoggerProvider() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        logs.setGlobalLoggerProvider(loggerProvider);
    }
}

export function isPostHogLoggingEnabled(): boolean {
    return Boolean(postHogApiKey && postHogLogsUrl);
}

export function getPostHogLogger(scope = POSTHOG_SERVICE_NAME): Logger {
    return loggerProvider.getLogger(scope);
}

export async function flushPostHogLogs(): Promise<void> {
    if (!isPostHogLoggingEnabled()) {
        return;
    }

    try {
        await loggerProvider.forceFlush();
    } catch (error) {
        console.warn('PostHog log flush failed', error);
    }
}

export async function getPostHogClient(): Promise<PostHogCaptureClient> {
    if (!postHogApiKey) {
        return noopPostHogClient;
    }

    const { getPostHog } = await import('@posthog/next');

    return getPostHog(postHogApiKey);
}
