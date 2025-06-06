import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from '../src/schema';

// This script truncates all tables in the test database to ensure a clean state between tests.
export const storage = drizzle(process.env.POSTGRES_URL!, {
    schema
});

export async function clearTestDb() {
    // Discover all user tables dynamically from information_schema
    const result = await storage.$client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'drizzle_%'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE 'sql_%';
  `);
    const tables = result.rows.map((row) => row.tablename);
    if (tables.length === 0) return;
    // Disable triggers for truncation (for foreign keys)
    await storage.$client.query('SET session_replication_role = replica;');
    try {
        await storage.$client.query(
            `TRUNCATE TABLE ${tables.map((t) => '"' + t + '"').join(', ')} RESTART IDENTITY CASCADE;`
        );
    } finally {
        await storage.$client.query('SET session_replication_role = DEFAULT;');
    }
}
