import { migrate } from 'drizzle-orm/vercel-postgres/migrator';
import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import * as schema from './schema';

export const connection = sql;
export const storage = drizzle(sql, { schema });

async function migrateStorage() {
    await migrate(storage, { migrationsFolder: './src/migrations' });
}

const main = async () => {
    try {
        console.info('Starting migration...');
        const start = Date.now();
        await migrateStorage();
        await connection.end();
        console.info('Migration completed in', Date.now() - start, 'ms');
    } catch (error) {
        console.error('Error during migration:', error);
        process.exit(1);
    }
};

main();
