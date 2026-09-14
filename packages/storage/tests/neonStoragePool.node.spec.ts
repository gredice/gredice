import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { neonPoolErrorDetails } from '../src/neonPoolError';

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
    assert.match(result.stdout, /# tests 7\b/);
    assert.match(result.stdout, /# fail 0\b/);
});
