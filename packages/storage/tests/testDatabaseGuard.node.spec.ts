import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { assertDisposableStorageTestDatabase } from './testDatabaseGuard';

const markerDirectory = mkdtempSync(join(tmpdir(), 'gredice-storage-guard-'));
after(() => rmSync(markerDirectory, { force: true, recursive: true }));

function createRunMarker(provider: string, resource: string) {
    const runToken = `${provider}-run-token`;
    const markerPath = join(markerDirectory, `${provider}.marker`);
    writeFileSync(
        markerPath,
        `gredice-storage-test-v1:${runToken}:${provider}:${resource}`,
    );
    return {
        GREDICE_TEST_DB_RUN_MARKER: markerPath,
        GREDICE_TEST_DB_RUN_TOKEN: runToken,
    };
}

test('assertDisposableStorageTestDatabase accepts generated test databases', () => {
    assert.doesNotThrow(() =>
        assertDisposableStorageTestDatabase({
            ...createRunMarker('pglite', '/tmp/gredice-storage-test'),
            GREDICE_TEST_DB_PGLITE_DIR: '/tmp/gredice-storage-test',
            GREDICE_TEST_DB_PROVIDER: 'pglite',
            POSTGRES_URL: 'pglite://local',
            TEST_ENV: '1',
        }),
    );
    assert.doesNotThrow(() =>
        assertDisposableStorageTestDatabase({
            ...createRunMarker(
                'docker',
                'gredice-storage-test-db-worktree-run:127.0.0.1:5432/gredice_test',
            ),
            GREDICE_TEST_DB_CONTAINER: 'gredice-storage-test-db-worktree-run',
            GREDICE_TEST_DB_PROVIDER: 'docker',
            POSTGRES_URL:
                'postgres://postgres:postgres@127.0.0.1:5432/gredice_test',
            TEST_ENV: '1',
        }),
    );
    assert.doesNotThrow(() =>
        assertDisposableStorageTestDatabase({
            ...createRunMarker(
                'fallback',
                'database.example.test:5432/gredice_test_worktree_run',
            ),
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

test('assertDisposableStorageTestDatabase rejects a matching name without the current setup marker', () => {
    assert.throws(
        () =>
            assertDisposableStorageTestDatabase({
                GREDICE_TEST_DB_NAME: 'gredice_test_worktree_run',
                GREDICE_TEST_DB_PROVIDER: 'fallback',
                POSTGRES_URL:
                    'postgres://user:secret@database.example.test/gredice_test_worktree_run',
                TEST_ENV: '1',
            }),
        /setup-owned database marker/,
    );
});

test('assertDisposableStorageTestDatabase rejects a Docker target whose port differs from the setup marker', () => {
    assert.throws(
        () =>
            assertDisposableStorageTestDatabase({
                ...createRunMarker(
                    'docker',
                    'gredice-storage-test-db-worktree-run:127.0.0.1:5432/gredice_test',
                ),
                GREDICE_TEST_DB_CONTAINER:
                    'gredice-storage-test-db-worktree-run',
                GREDICE_TEST_DB_PROVIDER: 'docker',
                POSTGRES_URL:
                    'postgres://postgres:postgres@127.0.0.1:5433/gredice_test',
                TEST_ENV: '1',
            }),
        /does not match this test run/,
    );
});
