import {
    type Logger as OpenTelemetryLogger,
    SeverityNumber,
} from '@opentelemetry/api-logs';

import {
    flushPostHogLogs,
    getPostHogLogger,
    POSTHOG_SERVICE_NAME,
} from '../../../lib/posthog-server';

type LogAttributeValue =
    | boolean
    | boolean[]
    | number
    | number[]
    | string
    | string[];

function toLogAttributeValue(value: unknown): LogAttributeValue | undefined {
    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    if (Array.isArray(value)) {
        if (value.every((item): item is string => typeof item === 'string')) {
            return value;
        }

        if (value.every((item): item is number => typeof item === 'number')) {
            return value;
        }

        if (value.every((item): item is boolean => typeof item === 'boolean')) {
            return value;
        }
    }

    if (value === null || value === undefined) {
        return undefined;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function normalizeAttributes(
    attributes?: Record<string, unknown>,
): Record<string, LogAttributeValue> {
    const normalized: Record<string, LogAttributeValue> = {};

    for (const [key, value] of Object.entries(attributes ?? {})) {
        const normalizedValue = toLogAttributeValue(value);

        if (normalizedValue !== undefined) {
            normalized[key] = normalizedValue;
        }
    }

    return normalized;
}

export class Logger {
    private readonly logger: OpenTelemetryLogger;

    constructor(scope = `${POSTHOG_SERVICE_NAME}.mcp`) {
        this.logger = getPostHogLogger(scope);
    }

    debug(message: string, attributes?: Record<string, unknown>): void {
        this.emit(message, attributes, SeverityNumber.DEBUG, 'DEBUG');
    }

    info(message: string, attributes?: Record<string, unknown>): void {
        this.emit(message, attributes, SeverityNumber.INFO, 'INFO');
    }

    warn(message: string, attributes?: Record<string, unknown>): void {
        this.emit(message, attributes, SeverityNumber.WARN, 'WARN');
    }

    error(message: string, attributes?: Record<string, unknown>): void {
        this.emit(message, attributes, SeverityNumber.ERROR, 'ERROR');
    }

    async flush(): Promise<void> {
        await flushPostHogLogs();
    }

    private emit(
        message: string,
        attributes: Record<string, unknown> | undefined,
        severityNumber: SeverityNumber,
        severityText: string,
    ): void {
        this.logger.emit({
            attributes: {
                ...normalizeAttributes(attributes),
                'posthog.log_type': 'mcp',
            },
            body: message,
            severityNumber,
            severityText,
        });
    }
}
