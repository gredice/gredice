import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { withTransientDatabaseReadRetry } from '../src/databaseReadRetry';
import {
    isRetryableNeonReadError,
    neonPoolErrorDetails,
} from '../src/neonPoolError';

test('pool diagnostics allow safe codes without serializing error payloads', () => {
    const secret = 'postgresql://user:secret@database.invalid/private';
    const error = Object.assign(new Error(secret), {
        code: secret,
        client: { connectionParameters: { password: secret } },
        cause: { code: 'ETIMEDOUT', message: secret },
    });
    assert.deepEqual(neonPoolErrorDetails(error), {
        kind: 'error',
        code: 'ETIMEDOUT',
    });
    for (const value of [null, undefined, secret, 129, {}, { code: secret }]) {
        assert.deepEqual(neonPoolErrorDetails(value), {
            kind: 'unknown',
            code: undefined,
        });
    }
    const event = Object.create({
        type: 'error',
        error: { code: 'ECONNRESET' },
    });
    assert.deepEqual(neonPoolErrorDetails(event), {
        kind: 'error-event',
        code: 'ECONNRESET',
    });

    const wrappedEvent = Object.assign(new Error(`Failed query: ${secret}`), {
        cause: Object.create({
            type: 'error',
            target: { url: secret },
        }),
    });
    assert.deepEqual(neonPoolErrorDetails(wrappedEvent), {
        kind: 'error-event',
        code: undefined,
    });
    assert.equal(isRetryableNeonReadError(wrappedEvent), true);
    assert.equal(
        isRetryableNeonReadError(
            Object.assign(new Error('connection failed'), { code: '08006' }),
        ),
        true,
    );
    assert.equal(
        isRetryableNeonReadError(
            Object.assign(new Error('unique violation'), { code: '23505' }),
        ),
        false,
    );

    const cyclicRoot: { cause?: unknown; error?: unknown } = {};
    cyclicRoot.cause = cyclicRoot;
    let cyclicTail = cyclicRoot;
    for (let index = 0; index < 4; index += 1) {
        const next: { cause?: unknown; error?: unknown } = {
            cause: cyclicRoot,
        };
        cyclicTail.error = next;
        cyclicTail = next;
    }
    cyclicTail.error = {
        type: 'error',
        target: { url: secret },
    };
    assert.deepEqual(neonPoolErrorDetails(cyclicRoot), {
        kind: 'error-event',
        code: undefined,
    });
    assert.equal(isRetryableNeonReadError(cyclicRoot), true);
});

test('transient read retry is bounded and keeps diagnostics sanitized', async (t) => {
    const secret = 'postgresql://user:secret@database.invalid/private';
    const warnings = t.mock.method(console, 'warn', () => undefined);
    const errors = t.mock.method(console, 'error', () => undefined);
    let attempts = 0;

    const result = await withTransientDatabaseReadRetry(
        async () => {
            attempts += 1;
            if (attempts === 1) {
                throw Object.assign(new Error(secret), { code: 'ETIMEDOUT' });
            }
            return 'recovered';
        },
        {
            operation: 'hydrate-garden-operation-events',
            context: { gardenId: 66, aggregateCount: 295 },
        },
    );

    assert.equal(result, 'recovered');
    assert.equal(attempts, 2);
    assert.equal(errors.mock.callCount(), 0);
    assert.deepEqual(
        warnings.mock.calls.map((call) => call.arguments),
        [
            [
                'Transient database read failed; retrying once',
                {
                    gardenId: 66,
                    aggregateCount: 295,
                    event: 'storage.database.read.retry',
                    operation: 'hydrate-garden-operation-events',
                    attempt: 1,
                    maxAttempts: 2,
                    error: { kind: 'error', code: 'ETIMEDOUT' },
                },
            ],
            [
                'Database read recovered after transient failure',
                {
                    gardenId: 66,
                    aggregateCount: 295,
                    event: 'storage.database.read.recovered',
                    operation: 'hydrate-garden-operation-events',
                    attempt: 2,
                    error: { kind: 'error', code: 'ETIMEDOUT' },
                },
            ],
        ],
    );
    assert.doesNotMatch(JSON.stringify(warnings.mock.calls), /secret|private/);

    const permanentError = Object.assign(new Error(secret), { code: '23505' });
    attempts = 0;
    await assert.rejects(
        withTransientDatabaseReadRetry(
            async () => {
                attempts += 1;
                throw permanentError;
            },
            { operation: 'hydrate-garden-operation-events' },
        ),
        (error) => error === permanentError,
    );
    assert.equal(attempts, 1);
    assert.equal(errors.mock.callCount(), 1);
    assert.doesNotMatch(JSON.stringify(errors.mock.calls), /secret|private/);

    const transientError = {
        type: 'error',
        target: { url: secret },
    };
    attempts = 0;
    await assert.rejects(
        withTransientDatabaseReadRetry(
            async () => {
                attempts += 1;
                throw transientError;
            },
            { operation: 'hydrate-garden-operation-events' },
        ),
        (error) => error === transientError,
    );
    assert.equal(attempts, 2);
    assert.equal(errors.mock.callCount(), 2);
    assert.deepEqual(errors.mock.calls.at(-1)?.arguments, [
        'Database read failed',
        {
            event: 'storage.database.read.failed',
            operation: 'hydrate-garden-operation-events',
            attempt: 2,
            maxAttempts: 2,
            retryable: true,
            error: { kind: 'error-event', code: undefined },
        },
    ]);
    assert.doesNotMatch(JSON.stringify(errors.mock.calls), /secret|private/);
});

test('production Neon pool handles background errors and preserves database failures', () => {
    // The normal storage runner preloads storage.ts with TEST_ENV=1. Use a fresh
    // process to exercise the production singleton, with no real credentials.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    delete env.NODE_OPTIONS;
    const result = spawnSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--test',
            '--test-reporter=tap',
            '--test-timeout=10000',
            '--conditions=react-server',
            fileURLToPath(
                new URL('./fixtures/neonStoragePool.ts', import.meta.url),
            ),
        ],
        {
            env: {
                ...env,
                TEST_ENV: '0',
                POSTGRES_URL: 'postgresql://test:secret@database.invalid/test',
            },
            encoding: 'utf8',
            timeout: 30_000,
        },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /# tests 8\b/);
    assert.match(result.stdout, /# fail 0\b/);
});
