import { createRequire } from 'node:module';
import type { PGlite } from '@electric-sql/pglite';
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
import type { PgliteDatabase } from 'drizzle-orm/pglite';
// @ts-expect-error Type definitions for 'pg' ESM entry may not be resolved under NodeNext; runtime is fine for tests
import { Pool as PgPool } from 'pg';
import * as schema from './schema';

type StorageDatabase =
    | NodePgDatabase<typeof schema>
    | NeonDatabase<typeof schema>;
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
let client: StorageDatabase | null = null;

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

function pgliteStorage() {
    if (!pgliteStorageClient) {
        console.debug('Instantiating PgliteDatabase for testing');
        const { PGlite: PGliteClient, pgliteDrizzle } = loadPgliteDriver();
        pgliteClient = new PGliteClient(getPgliteDataDir());
        pgliteStorageClient = pgliteDrizzle(pgliteClient, { schema });
    }
    return pgliteStorageClient;
}

export function storage(): StorageDatabase {
    if (isTest) {
        if (isPgliteTest()) {
            return pgliteStorage() as NodePgDatabase<typeof schema>;
        }

        if (!client) {
            console.debug('Instantiating NodePgDatabase for testing');
            if (!testPool) {
                testPool = new PgPool({
                    connectionString: getDbConnectionString(),
                });
            }
            client = nodeDrizzle(testPool, { schema });
        }
        return client as NodePgDatabase<typeof schema>;
    }

    if (!pool) {
        pool = new Pool({ connectionString: getDbConnectionString() });
    }
    if (!client) {
        client = neonDrizzle({
            client: pool,
            schema,
        });
    }
    return client as NeonDatabase<typeof schema>;
}

export async function migrate() {
    if (isTest) {
        if (isPgliteTest()) {
            await loadPgliteMigrator()(pgliteStorage(), {
                migrationsFolder: './src/migrations',
            });
            return;
        }

        await nodeMigrate(storage(), { migrationsFolder: './src/migrations' });
    } else {
        await neonMigrate(storage(), { migrationsFolder: './src/migrations' });
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
        client = null;
        return;
    }
    // Non-test close (not used in tests, but safe to have)
    if (pool) {
        await pool.end();
    }
    pool = null;
    client = null;
}
