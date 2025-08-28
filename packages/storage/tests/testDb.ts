// This file sets up an in-memory SQLite database for testing Drizzle ORM repositories.
// It is used to mock the database for integration tests without mocking repositories themselves.

import 'dotenv/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../src/schema';

let db: NodePgDatabase<typeof schema> | undefined;

export function createTestDb() {
    if (!db) {
        const dbUrl = process.env.POSTGRES_URL;
        if (!dbUrl) {
            throw new Error('POSTGRES_URL environment variable is not set');
        }
        db = drizzle<typeof schema>(dbUrl, { schema });
    }
    return db;
}
