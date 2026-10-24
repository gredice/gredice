import assert from 'node:assert/strict';
import test from 'node:test';
import {
    BatchLogRecordProcessor,
    LoggerProvider,
} from '@opentelemetry/sdk-logs';
import {
    createPostHogLogFlushScheduler,
    FetchOTLPLogExporter,
    getPostHogLogsUrl,
    POSTHOG_LOG_EXPORT_TIMEOUT_MS,
    POSTHOG_LOG_FLUSH_TIMEOUT_MS,
    POSTHOG_LOG_PROCESSOR_TIMEOUT_MS,
} from './index';

test('uses the regional PostHog ingestion host for cloud log exports', () => {
    assert.equal(
        getPostHogLogsUrl('https://eu.posthog.com'),
        'https://eu.i.posthog.com/i/v1/logs',
    );
    assert.equal(
        getPostHogLogsUrl('https://us.posthog.com/'),
        'https://us.i.posthog.com/i/v1/logs',
    );
    assert.equal(
        getPostHogLogsUrl('https://app.posthog.com'),
        'https://us.i.posthog.com/i/v1/logs',
    );
    assert.equal(
        getPostHogLogsUrl('https://eu.i.posthog.com'),
        'https://eu.i.posthog.com/i/v1/logs',
    );
});

test('preserves custom PostHog hosts and path prefixes', () => {
    assert.equal(
        getPostHogLogsUrl('https://posthog.example.com/ingest/'),
        'https://posthog.example.com/ingest/i/v1/logs',
    );
    assert.equal(
        getPostHogLogsUrl('https://eu.posthog.com.example/'),
        'https://eu.posthog.com.example/i/v1/logs',
    );
    assert.equal(getPostHogLogsUrl(undefined), null);
});

test('keeps enough timeout budget for one bounded export retry', () => {
    assert.ok(
        POSTHOG_LOG_PROCESSOR_TIMEOUT_MS >=
            POSTHOG_LOG_EXPORT_TIMEOUT_MS * 2 + 1_000,
    );
    assert.ok(
        POSTHOG_LOG_FLUSH_TIMEOUT_MS >=
            POSTHOG_LOG_PROCESSOR_TIMEOUT_MS + 1_000,
    );
});

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

test('registers each scheduled flush with the request lifecycle', async () => {
    let flushCount = 0;
    let releaseBatchWindow = () => {};
    const batchWindow = new Promise<void>((resolve) => {
        releaseBatchWindow = resolve;
    });
    const backgroundTasks: Promise<void>[] = [];
    const scheduleFlush = createPostHogLogFlushScheduler({
        batchDelayMs: 1_000,
        flush: async () => {
            flushCount += 1;
        },
        initialFailureBackoffMs: 30_000,
        maxFailureBackoffMs: 300_000,
        onPersistentError: () => {},
        registerBackgroundTask: (task) => {
            backgroundTasks.push(task);
        },
        wait: () => batchWindow,
    });

    const firstFlush = scheduleFlush();
    const secondFlush = scheduleFlush();

    assert.equal(firstFlush, secondFlush);
    assert.deepEqual(backgroundTasks, [firstFlush, secondFlush]);
    assert.equal(flushCount, 0);

    releaseBatchWindow();
    await firstFlush;

    assert.equal(flushCount, 1);
});

test('exports logs arriving during a flush in one serialized follow-up batch', async (t) => {
    const firstRequest = Promise.withResolvers<void>();
    const releaseFirstRequest = Promise.withResolvers<void>();
    const requestBodies: string[] = [];
    let activeRequests = 0;
    let maxActiveRequests = 0;
    t.mock.method(
        globalThis,
        'fetch',
        async (_input: unknown, init: RequestInit) => {
            assert.ok(init.body instanceof Uint8Array);
            requestBodies.push(new TextDecoder().decode(init.body));
            activeRequests += 1;
            maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
            if (requestBodies.length === 1) {
                firstRequest.resolve();
                await releaseFirstRequest.promise;
            }
            activeRequests -= 1;
            return new Response(null, { status: 200 });
        },
    );
    const exporter = new FetchOTLPLogExporter({
        headers: {},
        timeoutMillis: 100,
        url: 'https://posthog.example.com/i/v1/logs',
    });
    const provider = new LoggerProvider({
        processors: [
            new BatchLogRecordProcessor({
                exporter,
                scheduledDelayMillis: 300_000,
            }),
        ],
    });
    t.after(() => provider.shutdown());
    const backgroundTasks: Promise<void>[] = [];
    const scheduleFlush = createPostHogLogFlushScheduler({
        batchDelayMs: 1_000,
        flush: () =>
            exporter.forceFlushWithErrorPropagation(() =>
                provider.forceFlush(),
            ),
        initialFailureBackoffMs: 30_000,
        maxFailureBackoffMs: 300_000,
        onPersistentError: () => assert.fail('exports should succeed'),
        registerBackgroundTask: (task) => backgroundTasks.push(task),
        wait: async () => {},
    });
    const logger = provider.getLogger('test');
    logger.emit({ body: 'first record' });
    const firstFlush = scheduleFlush();
    await firstRequest.promise;

    logger.emit({ body: 'record during export' });
    const followUpFlush = scheduleFlush();
    logger.emit({ body: 'another record during export' });
    const sameFollowUpFlush = scheduleFlush();
    // Release before assertions so the regression cannot leave an export open.
    releaseFirstRequest.resolve();
    await Promise.all([firstFlush, followUpFlush, sameFollowUpFlush]);

    assert.notEqual(followUpFlush, firstFlush);
    assert.equal(sameFollowUpFlush, followUpFlush);
    assert.deepEqual(backgroundTasks, [
        firstFlush,
        followUpFlush,
        sameFollowUpFlush,
    ]);
    assert.equal(maxActiveRequests, 1);
    assert.equal(requestBodies.length, 2);
    assert.match(requestBodies[0] ?? '', /first record/);
    assert.match(requestBodies[1] ?? '', /record during export/);
    assert.match(requestBodies[1] ?? '', /another record during export/);

    logger.emit({ body: 'record after both flushes' });
    await scheduleFlush();
    assert.equal(requestBodies.length, 3);
});

test('a queued follow-up respects backoff established by the active flush', async () => {
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let currentTime = 0;
    let flushCount = 0;
    const scheduleFlush = createPostHogLogFlushScheduler({
        batchDelayMs: 1_000,
        flush: async () => {
            flushCount += 1;
            if (flushCount === 1) {
                started.resolve();
                await release.promise;
                throw new Error('export unavailable');
            }
        },
        initialFailureBackoffMs: 30_000,
        maxFailureBackoffMs: 300_000,
        now: () => currentTime,
        onPersistentError: () => assert.fail('only one failure'),
        wait: async () => {},
    });
    const firstFlush = scheduleFlush();
    await started.promise;
    const followUpFlush = scheduleFlush();
    release.resolve();
    await Promise.all([firstFlush, followUpFlush]);
    assert.equal(flushCount, 1);

    await scheduleFlush();
    assert.equal(flushCount, 1);
    currentTime += 30_000;
    await scheduleFlush();
    assert.equal(flushCount, 2);
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
            processors: [processor],
        });

        provider.getLogger('test').emit({
            attributes: {
                'posthog.log_type': 'console',
            },
            body: 'preserved log',
        });
        await provider.forceFlush({ timeoutMillis: 200 });

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

test('retries one timed-out OTLP request with the same log batch', async () => {
    const originalFetch = globalThis.fetch;
    const requestBodies: Uint8Array[] = [];
    let requestCount = 0;

    globalThis.fetch = (_input, init) => {
        requestCount += 1;
        assert.ok(init?.body instanceof Uint8Array);
        requestBodies.push(init.body);

        if (requestCount === 2) {
            return Promise.resolve(new Response(null, { status: 200 }));
        }

        return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
                'abort',
                () => {
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
            processors: [processor],
        });

        provider.getLogger('test').emit({ body: 'test log' });
        await exporter.forceFlushWithErrorPropagation(() =>
            provider.forceFlush({ timeoutMillis: 100 }),
        );

        assert.equal(requestCount, 2);
        assert.deepEqual(requestBodies[1], requestBodies[0]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('stops after one retry when OTLP requests keep timing out', async () => {
    const originalFetch = globalThis.fetch;
    let requestCount = 0;

    globalThis.fetch = (_input, init) => {
        requestCount += 1;
        return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
                'abort',
                () => reject(init.signal?.reason),
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
            exportTimeoutMillis: 80,
            scheduledDelayMillis: 1_000,
        });
        const provider = new LoggerProvider({
            processors: [processor],
        });

        provider.getLogger('test').emit({ body: 'test log' });
        await assert.rejects(() =>
            exporter.forceFlushWithErrorPropagation(() =>
                provider.forceFlush({ timeoutMillis: 100 }),
            ),
        );

        assert.equal(requestCount, 2);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('does not retry non-transient OTLP response failures', async () => {
    const originalFetch = globalThis.fetch;
    let requestCount = 0;

    globalThis.fetch = async () => {
        requestCount += 1;
        return new Response(null, { status: 400 });
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
            exportTimeoutMillis: 80,
            scheduledDelayMillis: 1_000,
        });
        const provider = new LoggerProvider({
            processors: [processor],
        });

        provider.getLogger('test').emit({ body: 'test log' });
        await assert.rejects(() =>
            exporter.forceFlushWithErrorPropagation(() =>
                provider.forceFlush({ timeoutMillis: 100 }),
            ),
        );

        assert.equal(requestCount, 1);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('backs off after an OTLP export failure swallowed by the batch processor', async () => {
    const originalFetch = globalThis.fetch;
    let currentTime = 1_000;
    let requestCount = 0;

    globalThis.fetch = async () => {
        requestCount += 1;
        return new Response(null, { status: 400 });
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
            exportTimeoutMillis: 200,
            scheduledDelayMillis: 60_000,
        });
        const provider = new LoggerProvider({
            processors: [processor],
        });
        const logger = provider.getLogger('test');
        const reportedFailures: number[] = [];
        const scheduleFlush = createPostHogLogFlushScheduler({
            batchDelayMs: 1_000,
            flush: () =>
                exporter.forceFlushWithErrorPropagation(() =>
                    provider.forceFlush({ timeoutMillis: 300 }),
                ),
            initialFailureBackoffMs: 30_000,
            maxFailureBackoffMs: 300_000,
            now: () => currentTime,
            onPersistentError: (_error, context) => {
                reportedFailures.push(context.consecutiveFailures);
            },
            wait: async () => {},
        });

        logger.emit({ body: 'first log' });
        await scheduleFlush();

        logger.emit({ body: 'second log' });
        await scheduleFlush();
        assert.equal(requestCount, 1);

        currentTime += 30_000;
        await scheduleFlush();

        assert.equal(requestCount, 2);
        assert.deepEqual(reportedFailures, [2]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
