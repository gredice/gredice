import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDisposableStorageTestDatabase } from './testDatabaseGuard';

test('assertDisposableStorageTestDatabase accepts generated test databases', () => {
    assert.doesNotThrow(() =>
        assertDisposableStorageTestDatabase({
            GREDICE_TEST_DB_PGLITE_DIR: '/tmp/gredice-storage-test',
            GREDICE_TEST_DB_PROVIDER: 'pglite',
            POSTGRES_URL: 'pglite://local',
            TEST_ENV: '1',
        }),
    );
    assert.doesNotThrow(() =>
        assertDisposableStorageTestDatabase({
            GREDICE_TEST_DB_PROVIDER: 'docker',
            POSTGRES_URL:
                'postgres://postgres:postgres@127.0.0.1:5432/gredice_test',
            TEST_ENV: '1',
        }),
    );
    assert.doesNotThrow(() =>
        assertDisposableStorageTestDatabase({
            GREDICE_TEST_DB_NAME: 'gredice_test_worktree_run',
            GREDICE_TEST_DB_PROVIDER: 'fallback',
            POSTGRES_URL:
                'postgres://user:secret@database.example.test/gredice_test_worktree_run',
            TEST_ENV: '1',
        }),
    );
});

test('assertDisposableStorageTestDatabase rejects production-like targets', () => {
    const productionUrl =
        'postgresql://user:secret@production.example.test/verceldb';

    assert.throws(
        () =>
            assertDisposableStorageTestDatabase({
                POSTGRES_URL: productionUrl,
            }),
        /TEST_ENV=1/,
    );
    assert.throws(
        () =>
            assertDisposableStorageTestDatabase({
                GREDICE_TEST_DB_PROVIDER: 'docker',
                POSTGRES_URL: productionUrl,
                TEST_ENV: '1',
            }),
        /local Docker database/,
    );
    assert.throws(
        () =>
            assertDisposableStorageTestDatabase({
                GREDICE_TEST_DB_NAME: 'gredice_test_worktree_run',
                GREDICE_TEST_DB_PROVIDER: 'fallback',
                POSTGRES_URL: productionUrl,
                TEST_ENV: '1',
            }),
        /fallback database/,
    );
});
