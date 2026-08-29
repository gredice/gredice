import { readFileSync } from 'node:fs';

type StorageTestDatabaseEnvironment = {
    GREDICE_TEST_DB_CONTAINER?: string;
    GREDICE_TEST_DB_NAME?: string;
    GREDICE_TEST_DB_PGLITE_DIR?: string;
    GREDICE_TEST_DB_PROVIDER?: string;
    GREDICE_TEST_DB_RUN_MARKER?: string;
    GREDICE_TEST_DB_RUN_TOKEN?: string;
    POSTGRES_URL?: string;
    TEST_ENV?: string;
};

function assertCurrentStorageTestDatabaseRun(
    environment: StorageTestDatabaseEnvironment,
    provider: string,
    resource: string,
) {
    const markerPath = environment.GREDICE_TEST_DB_RUN_MARKER;
    const runToken = environment.GREDICE_TEST_DB_RUN_TOKEN;
    if (!markerPath || !runToken) {
        throw new Error(
            'Refusing to run storage tests without the current setup-owned database marker.',
        );
    }

    let marker: string;
    try {
        marker = readFileSync(markerPath, 'utf8');
    } catch {
        throw new Error(
            'Refusing to run storage tests because the setup-owned database marker is unavailable.',
        );
    }

    if (
        marker !== `gredice-storage-test-v1:${runToken}:${provider}:${resource}`
    ) {
        throw new Error(
            'Refusing to run storage tests because the setup-owned database marker does not match this test run.',
        );
    }
}

function parsePostgresDatabaseName(connectionString: string) {
    let url: URL;
    try {
        url = new URL(connectionString);
    } catch {
        throw new Error(
            'Refusing to run storage tests without a valid disposable database URL.',
        );
    }

    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
        throw new Error(
            'Refusing to run storage tests without a PostgreSQL disposable database.',
        );
    }

    return {
        databaseName: decodeURIComponent(url.pathname.slice(1)),
        hostname: url.hostname,
    };
}

export function assertDisposableStorageTestDatabase(
    environment: StorageTestDatabaseEnvironment = process.env,
) {
    const connectionString = environment.POSTGRES_URL;
    if (!connectionString) {
        throw new Error('POSTGRES_URL environment variable is not set');
    }

    if (environment.TEST_ENV !== '1') {
        throw new Error(
            'Refusing to run storage tests because TEST_ENV=1 is missing. Use pnpm --filter @gredice/storage test.',
        );
    }

    const provider = environment.GREDICE_TEST_DB_PROVIDER;
    if (provider === 'pglite') {
        if (
            connectionString !== 'pglite://local' ||
            !environment.GREDICE_TEST_DB_PGLITE_DIR
        ) {
            throw new Error(
                'Refusing to run storage tests without the generated disposable PGlite database.',
            );
        }
        assertCurrentStorageTestDatabaseRun(
            environment,
            provider,
            environment.GREDICE_TEST_DB_PGLITE_DIR,
        );
        return;
    }

    const { databaseName, hostname } =
        parsePostgresDatabaseName(connectionString);
    if (provider === 'docker') {
        if (hostname !== '127.0.0.1' || databaseName !== 'gredice_test') {
            throw new Error(
                'Refusing to run storage tests without the generated local Docker database.',
            );
        }
        if (!environment.GREDICE_TEST_DB_CONTAINER) {
            throw new Error(
                'Refusing to run storage tests without the generated local Docker container identity.',
            );
        }
        assertCurrentStorageTestDatabaseRun(
            environment,
            provider,
            environment.GREDICE_TEST_DB_CONTAINER,
        );
        return;
    }

    if (provider === 'fallback') {
        const expectedDatabaseName = environment.GREDICE_TEST_DB_NAME;
        if (
            !expectedDatabaseName?.startsWith('gredice_test_') ||
            databaseName !== expectedDatabaseName
        ) {
            throw new Error(
                'Refusing to run storage tests without the generated fallback database.',
            );
        }
        assertCurrentStorageTestDatabaseRun(
            environment,
            provider,
            expectedDatabaseName,
        );
        return;
    }

    throw new Error(
        'Refusing to run storage tests without a recognized disposable database provider.',
    );
}
