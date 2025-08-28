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
// @ts-expect-error Type definitions for 'pg' ESM entry may not be resolved under NodeNext; runtime is fine for tests
import { Pool as PgPool } from 'pg';
import * as schema from './schema';

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
let client: NodePgDatabase<typeof schema> | NeonDatabase<typeof schema> | null =
    null;
export function storage() {
    if (isTest) {
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
        await nodeMigrate(storage(), { migrationsFolder: './src/migrations' });
    } else {
        await neonMigrate(storage(), { migrationsFolder: './src/migrations' });
    }
}

export async function closeStorage() {
    if (isTest) {
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
