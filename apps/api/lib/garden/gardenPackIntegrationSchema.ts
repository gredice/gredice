import { PGlite } from '@electric-sql/pglite';
import { storage } from '@gredice/storage';
import {
    gardenPackIntegritySql,
    getGardenPackTestDdl,
} from '@gredice/storage/testing/gardenPackTestSchema';
import { sql } from 'drizzle-orm';
export async function prepareGardenPackIntegrationSchema() {
    const statements = await getGardenPackTestDdl();
    if (process.env.GREDICE_TEST_DB_PROVIDER === 'pglite') {
        // Use the simple protocol for full PL/pgSQL guard DDL before the app opens its client.
        const client = new PGlite(process.env.GREDICE_TEST_DB_PGLITE_DIR);
        try {
            for (const statement of statements) await client.exec(statement);
            await client.exec(gardenPackIntegritySql);
        } finally {
            await client.close();
        }
    } else {
        for (const statement of statements)
            await storage().execute(sql.raw(statement));
        await storage().execute(sql.raw(gardenPackIntegritySql));
    }
}
