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
let client: NodePgDatabase<typeof schema> | NeonDatabase<typeof schema> | null =
    null;
export function storage() {
    if (isTest) {
        if (!client) {
            console.debug('Instantiating NodePgDatabase for testing');
            client = nodeDrizzle(getDbConnectionString(), { schema }) as any;
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
