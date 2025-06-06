import { drizzle as neonDrizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as nodeDrizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { migrate as neonMigrate } from 'drizzle-orm/neon-http/migrator';
import { migrate as nodeMigrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from './schema';

// Switch between test and production clients based on environment variable
const isTest = process.env.TEST_ENV === '1';

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
    throw new Error("POSTGRES_URL environment variable is not set.");
}

let storage: NeonHttpDatabase<typeof schema>;
if (isTest) {
    // Test client
    storage = nodeDrizzle(connectionString, { schema }) as any;
} else {
    // Production client
    const sql = neon(connectionString);
    storage = neonDrizzle({
        client: sql,
        schema
    });
}

async function migrate() {
    if (isTest) {
        const migrateDb = storage as unknown as NodePgDatabase<typeof schema>;
        await nodeMigrate(migrateDb, { migrationsFolder: './src/migrations' });
    } else {
        await neonMigrate(storage, { migrationsFolder: './src/migrations' });
    }
}

export { storage, migrate };