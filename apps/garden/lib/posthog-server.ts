import { type Logger, logs, SeverityNumber } from '@opentelemetry/api-logs';
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

export const POSTHOG_SERVICE_NAME = 'gredice-garden';

const postHogConsoleForwardingKey = Symbol.for(
    `${POSTHOG_SERVICE_NAME}.console-forwarding`,
);

const postHogApiKey =
    process.env.NEXT_PUBLIC_POSTHOG_KEY ??
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const postHogServerHost =
    process.env.POSTHOG_SERVER_HOST ??
    process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ??
    process.env.NEXT_PUBLIC_POSTHOG_HOST;

const postHogLogsUrl = postHogServerHost
    ? `${postHogServerHost.replace(/\/$/, '')}/i/v1/logs`
    : null;

const noopPostHogClient: PostHogCaptureClient = {
    capture: () => undefined,
};

const originalConsole = {
    debug: console.debug.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    log: console.log.bind(console),
    warn: console.warn.bind(console),
};

let pendingLogFlush: Promise<void> | null = null;

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

function stringifyConsoleArgument(value: unknown): string {
    if (value instanceof Error) {
        return value.stack ?? `${value.name}: ${value.message}`;
    }

    if (typeof value === 'string') {
        return value;
    }

    if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'bigint' ||
        typeof value === 'symbol' ||
        value === null ||
        value === undefined
    ) {
        return String(value);
    }

    try {
        return JSON.stringify(value);
    } catch {
        return Object.prototype.toString.call(value);
    }
}

function schedulePostHogLogFlush(): void {
    if (!isPostHogLoggingEnabled() || pendingLogFlush) {
        return;
    }

    pendingLogFlush = loggerProvider.forceFlush().catch((error) => {
        originalConsole.warn('PostHog log flush failed', error);
    });

    void pendingLogFlush.finally(() => {
        pendingLogFlush = null;
    });
}

export function registerPostHogConsoleForwarding(): void {
    if (!isPostHogLoggingEnabled()) {
        return;
    }

    const globalState = globalThis as typeof globalThis & {
        [postHogConsoleForwardingKey]?: boolean;
    };

    if (globalState[postHogConsoleForwardingKey]) {
        return;
    }

    const consoleLogger = getPostHogLogger(`${POSTHOG_SERVICE_NAME}.console`);

    const wrapConsoleMethod = (
        method: keyof typeof originalConsole,
        severityNumber: SeverityNumber,
        severityText: string,
    ) => {
        const originalMethod = originalConsole[method];

        console[method] = (...args: unknown[]) => {
            originalMethod(...args);

            if (!isPostHogLoggingEnabled()) {
                return;
            }

            consoleLogger.emit({
                attributes: {
                    'console.method': method,
                    'posthog.log_type': 'console',
                },
                body: args.map(stringifyConsoleArgument).join(' '),
                severityNumber,
                severityText,
            });

            schedulePostHogLogFlush();
        };
    };

    wrapConsoleMethod('debug', SeverityNumber.DEBUG, 'DEBUG');
    wrapConsoleMethod('log', SeverityNumber.INFO, 'INFO');
    wrapConsoleMethod('info', SeverityNumber.INFO, 'INFO');
    wrapConsoleMethod('warn', SeverityNumber.WARN, 'WARN');
    wrapConsoleMethod('error', SeverityNumber.ERROR, 'ERROR');

    globalState[postHogConsoleForwardingKey] = true;
}

export async function flushPostHogLogs(): Promise<void> {
    if (!isPostHogLoggingEnabled()) {
        return;
    }

    try {
        await loggerProvider.forceFlush();
    } catch (error) {
        originalConsole.warn('PostHog log flush failed', error);
    }
}

export async function getPostHogClient(): Promise<PostHogCaptureClient> {
    if (!postHogApiKey) {
        return noopPostHogClient;
    }

    const { getPostHog } = await import('@posthog/next');

    return getPostHog(
        postHogApiKey,
        postHogServerHost ? { host: postHogServerHost } : undefined,
    );
}
