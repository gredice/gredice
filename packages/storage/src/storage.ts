import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { Pool } from '@neondatabase/serverless';
import {
    type NeonDatabase,
    drizzle as neonDrizzle,
} from 'drizzle-orm/neon-serverless';
import { migrate as neonMigrate } from 'drizzle-orm/neon-serverless/migrator';
import {
    type NodePgDatabase,
    drizzle as nodeDrizzle,
} from 'drizzle-orm/node-postgres';
import { migrate as nodeMigrate } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core/session';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
// @ts-expect-error Type definitions for 'pg' ESM entry may not be resolved under NodeNext; runtime is fine for tests
import { Pool as PgPool } from 'pg';
import { neonPoolErrorDetails } from './neonPoolError';
import * as schema from './schema';

type StorageDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;
type PgliteStorageDatabase = PgliteDatabase<typeof schema>;

// Switch between test and production clients based on environment variable
const isTest = process.env.TEST_ENV === '1';

function getDbConnectionString() {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
        throw new Error('POSTGRES_URL environment variable is not set.');
    }
    return connectionString;
}

let pool: Pool | null = null;
let testPool: PgPool | null = null;
let pgliteClient: PGlite | null = null;
let pgliteStorageClient: PgliteStorageDatabase | null = null;
let nodeClient: NodePgDatabase<typeof schema> | null = null;
let neonClient: NeonDatabase<typeof schema> | null = null;

function isPgliteTest() {
    return process.env.GREDICE_TEST_DB_PROVIDER === 'pglite';
}

function getPgliteDataDir() {
    const dataDir = process.env.GREDICE_TEST_DB_PGLITE_DIR;
    if (!dataDir) {
        throw new Error(
            'GREDICE_TEST_DB_PGLITE_DIR environment variable is not set.',
        );
    }
    return dataDir;
}

function loadPgliteDriver() {
    const require = createRequire(import.meta.url);
    const pgliteModule: typeof import('@electric-sql/pglite') =
        require('@electric-sql/pglite');
    const drizzleModule: typeof import('drizzle-orm/pglite') = require('drizzle-orm/pglite');

    return {
        PGlite: pgliteModule.PGlite,
        pgliteDrizzle: drizzleModule.drizzle,
    };
}

function loadPgliteMigrator() {
    const require = createRequire(import.meta.url);
    const migratorModule: typeof import('drizzle-orm/pglite/migrator') =
        require('drizzle-orm/pglite/migrator');

    return migratorModule.migrate;
}

const PGLITE_TRANSACTION_SCOPE_WAIT_MS = 10_000;
const pgliteTransactionScope = new AsyncLocalStorage<true>();

// PGlite serializes every call on one connection. A query issued through the
// shared client from inside a transaction callback (instead of through `tx`)
// waits for that transaction to finish; if the transaction awaits it, neither
// ever finishes. Calls from a transaction scope get a deadline so a deadlock
// fails with the offending stack instead of hanging the storage suite, while
// deliberately unawaited competing writers still run once the transaction ends.
function withPgliteDeadlockDeadline<T>(
    method: string,
    run: () => Promise<T>,
): Promise<T> {
    if (!pgliteTransactionScope.getStore()) {
        return run();
    }

    const deadlockError = new Error(
        `PGlite ${method} on the shared storage client waited ${PGLITE_TRANSACTION_SCOPE_WAIT_MS}ms inside an open transaction. ` +
            'PGlite has a single connection, so an awaited query here deadlocks; ' +
            'pass the transaction client through or run the query before the transaction.',
    );
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(
            () => reject(deadlockError),
            PGLITE_TRANSACTION_SCOPE_WAIT_MS,
        );
    });

    return Promise.race([run(), deadline]).finally(() => clearTimeout(timeout));
}

function guardPgliteTransactionDeadlocks(client: PGlite) {
    const transaction = client.transaction.bind(client);
    const query = client.query.bind(client);
    const exec = client.exec.bind(client);

    client.transaction = <T>(callback: (tx: Transaction) => Promise<T>) =>
        withPgliteDeadlockDeadline('transaction', () =>
            pgliteTransactionScope.run(true, () => transaction(callback)),
        );
    client.query = <T>(...args: Parameters<PGlite['query']>) =>
        withPgliteDeadlockDeadline('query', () => query<T>(...args));
    client.exec = (...args: Parameters<PGlite['exec']>) =>
        withPgliteDeadlockDeadline('exec', () => exec(...args));
}

function pgliteStorage() {
    if (!pgliteStorageClient) {
        console.debug('Instantiating PgliteDatabase for testing');
        const { PGlite: PGliteClient, pgliteDrizzle } = loadPgliteDriver();
        pgliteClient = new PGliteClient(getPgliteDataDir());
        guardPgliteTransactionDeadlocks(pgliteClient);
        pgliteStorageClient = pgliteDrizzle(pgliteClient, { schema });
    }
    return pgliteStorageClient;
}

function nodePgStorage() {
    if (!nodeClient) {
        console.debug('Instantiating NodePgDatabase for testing');
        if (!testPool) {
            testPool = new PgPool({
                connectionString: getDbConnectionString(),
            });
        }
        nodeClient = nodeDrizzle(testPool, { schema });
    }
    return nodeClient;
}

function neonStorage() {
    if (!pool) {
        const neonPool = new Pool({
            connectionString: getDbConnectionString(),
        });
        // The driver removes a failed idle client before emitting this event.
        // Handle it before first use so background disconnects cannot become
        // uncaught errors. Query/transaction rejections still reach their callers.
        neonPool.on('error', (error: unknown) => {
            console.error('Neon pool background connection error', {
                event: 'storage.neon.pool.error',
                error: neonPoolErrorDetails(error),
                totalCount: neonPool.totalCount,
                idleCount: neonPool.idleCount,
                waitingCount: neonPool.waitingCount,
            });
        });
        pool = neonPool;
    }
    if (!neonClient) {
        neonClient = neonDrizzle({
            client: pool,
            schema,
        });
    }
    return neonClient;
}

export function storage(): StorageDatabase {
    if (isTest) {
        if (isPgliteTest()) {
            return pgliteStorage();
        }

        return nodePgStorage();
    }

    return neonStorage();
}

export async function migrate() {
    if (isTest) {
        if (isPgliteTest()) {
            await loadPgliteMigrator()(pgliteStorage(), {
                migrationsFolder: './src/migrations',
            });
            return;
        }

        await nodeMigrate(nodePgStorage(), {
            migrationsFolder: './src/migrations',
        });
    } else {
        await neonMigrate(neonStorage(), {
            migrationsFolder: './src/migrations',
        });
    }
}

export async function closeStorage() {
    if (isTest) {
        if (pgliteClient) {
            await pgliteClient.close();
            pgliteClient = null;
            pgliteStorageClient = null;
        }
        if (testPool) {
            await testPool.end();
            testPool = null;
        }
        nodeClient = null;
        return;
    }
    // Non-test close (not used in tests, but safe to have)
    if (pool) {
        await pool.end();
    }
    pool = null;
    neonClient = null;
}
