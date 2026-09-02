import assert from 'node:assert/strict';
import test from 'node:test';
import {
    BatchLogRecordProcessor,
    LoggerProvider,
} from '@opentelemetry/sdk-logs';
import { createPostHogLogFlushScheduler, FetchOTLPLogExporter } from './index';

test('coalesces log flushes during the batch window', async () => {
    let flushCount = 0;
    let releaseBatchWindow = () => {};
    const batchWindow = new Promise<void>((resolve) => {
        releaseBatchWindow = resolve;
    });
    const scheduleFlush = createPostHogLogFlushScheduler({
        batchDelayMs: 1_000,
        flush: async () => {
            flushCount += 1;
        },
        initialFailureBackoffMs: 30_000,
        maxFailureBackoffMs: 300_000,
        onPersistentError: () => {},
        wait: () => batchWindow,
    });

    const firstFlush = scheduleFlush();
    const secondFlush = scheduleFlush();

    assert.equal(firstFlush, secondFlush);
    assert.equal(flushCount, 0);

    releaseBatchWindow();
    await firstFlush;

    assert.equal(flushCount, 1);
});

test('uses capped exponential backoff and reports one persistent failure', async () => {
    const flushError = new Error('Operation timed out');
    const reportedErrors: Array<{
        context: { consecutiveFailures: number; retryInMs: number };
        error: unknown;
    }> = [];
    let currentTime = 1_000;
    let flushCount = 0;
    const scheduleFlush = createPostHogLogFlushScheduler({
        batchDelayMs: 1_000,
        flush: async () => {
            flushCount += 1;
            throw flushError;
        },
        initialFailureBackoffMs: 30_000,
        maxFailureBackoffMs: 60_000,
        now: () => currentTime,
        onPersistentError: (error, context) => {
            reportedErrors.push({ context, error });
        },
        wait: async () => {},
    });

    await scheduleFlush();
    await scheduleFlush();

    assert.equal(flushCount, 1);
    assert.deepEqual(reportedErrors, []);

    currentTime += 30_000;
    await scheduleFlush();

    assert.equal(flushCount, 2);
    assert.deepEqual(reportedErrors, [
        {
            context: {
                consecutiveFailures: 2,
                retryInMs: 60_000,
            },
            error: flushError,
        },
    ]);

    currentTime += 60_000;
    await scheduleFlush();

    assert.equal(flushCount, 3);
    assert.equal(reportedErrors.length, 1);
});

test('resets backoff and failure reporting after a successful flush', async () => {
    const reportedFailures: number[] = [];
    let currentTime = 1_000;
    let shouldFail = true;
    const scheduleFlush = createPostHogLogFlushScheduler({
        batchDelayMs: 1_000,
        flush: async () => {
            if (shouldFail) {
                throw new Error('unavailable');
            }
        },
        initialFailureBackoffMs: 30_000,
        maxFailureBackoffMs: 300_000,
        now: () => currentTime,
        onPersistentError: (_error, context) => {
            reportedFailures.push(context.consecutiveFailures);
        },
        wait: async () => {},
    });

    await scheduleFlush();
    currentTime += 30_000;
    await scheduleFlush();

    shouldFail = false;
    currentTime += 60_000;
    await scheduleFlush();

    shouldFail = true;
    await scheduleFlush();
    currentTime += 30_000;
    await scheduleFlush();

    assert.deepEqual(reportedFailures, [2, 2]);
});

test('preserves OTLP JSON log bodies, attributes, and authorization', async () => {
    const originalFetch = globalThis.fetch;
    let requestInit: RequestInit | undefined;

    globalThis.fetch = async (_input, init) => {
        requestInit = init;
        return new Response(null, { status: 200 });
    };

    try {
        const exporter = new FetchOTLPLogExporter({
            headers: {
                Authorization: 'Bearer test',
            },
            timeoutMillis: 100,
            url: 'https://eu.i.posthog.com/i/v1/logs',
        });
        const processor = new BatchLogRecordProcessor({
            exporter,
            exportTimeoutMillis: 100,
            scheduledDelayMillis: 1_000,
        });
        const provider = new LoggerProvider({
            forceFlushTimeoutMillis: 200,
            processors: [processor],
        });

        provider.getLogger('test').emit({
            attributes: {
                'posthog.log_type': 'console',
            },
            body: 'preserved log',
        });
        await provider.forceFlush();

        assert.equal(
            new Headers(requestInit?.headers).get('Authorization'),
            'Bearer test',
        );
        assert.ok(requestInit?.body instanceof Uint8Array);

        const payload = JSON.parse(new TextDecoder().decode(requestInit.body));
        const logRecord = payload.resourceLogs[0]?.scopeLogs[0]?.logRecords[0];

        assert.equal(logRecord?.body.stringValue, 'preserved log');
        assert.deepEqual(logRecord?.attributes, [
            {
                key: 'posthog.log_type',
                value: { stringValue: 'console' },
            },
        ]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('aborts a hanging OTLP request before the provider flush deadline', async () => {
    const originalFetch = globalThis.fetch;
    let requestWasAborted = false;

    globalThis.fetch = (_input, init) => {
        return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
                'abort',
                () => {
                    requestWasAborted = true;
                    reject(init.signal?.reason);
                },
                { once: true },
            );
        });
    };

    try {
        const exporter = new FetchOTLPLogExporter({
            headers: {
                Authorization: 'Bearer test',
            },
            timeoutMillis: 20,
            url: 'https://eu.i.posthog.com/i/v1/logs',
        });
        const processor = new BatchLogRecordProcessor({
            exporter,
            exportTimeoutMillis: 50,
            scheduledDelayMillis: 1_000,
        });
        const provider = new LoggerProvider({
            forceFlushTimeoutMillis: 100,
            processors: [processor],
        });

        provider.getLogger('test').emit({ body: 'test log' });
        await provider.forceFlush();

        assert.equal(requestWasAborted, true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
