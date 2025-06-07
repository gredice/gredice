// This file sets up an in-memory SQLite database for testing Drizzle ORM repositories.
// It is used to mock the database for integration tests without mocking repositories themselves.

import 'dotenv/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../src/schema';

let db: NodePgDatabase<typeof schema> | undefined;

export function createTestDb() {
    if (!db) {
        db = drizzle<typeof schema>(process.env.POSTGRES_URL!, { schema });
    }
    return db;
}
