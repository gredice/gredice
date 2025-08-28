// Initialize a shared Node Postgres Drizzle client for tests using the storage() factory.
import 'dotenv/config';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../src/schema';
import { storage } from '../src/storage';

let db: NodePgDatabase<typeof schema> | undefined;

export function createTestDb() {
    if (!db) {
        const dbUrl = process.env.POSTGRES_URL;
        if (!dbUrl) {
            throw new Error('POSTGRES_URL environment variable is not set');
        }
        // storage() uses TEST_ENV to create a NodePgDatabase backed by a pg Pool
        db = storage() as NodePgDatabase<typeof schema>;
    }
    return db;
}
