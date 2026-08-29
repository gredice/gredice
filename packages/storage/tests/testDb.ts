// Initialize a shared Node Postgres Drizzle client for tests using the storage() factory.
import 'dotenv/config';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../src/schema';
import { storage } from '../src/storage';
import { assertDisposableStorageTestDatabase } from './testDatabaseGuard';

let db: NodePgDatabase<typeof schema> | undefined;

export function createTestDb() {
    if (!db) {
        assertDisposableStorageTestDatabase();
        // storage() uses TEST_ENV to create a NodePgDatabase backed by a pg Pool
        db = storage() as NodePgDatabase<typeof schema>;
    }
    return db;
}
