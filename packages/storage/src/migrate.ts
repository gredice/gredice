import { migrate } from 'drizzle-orm/vercel-postgres/migrator';
import { connection, storage } from '.';

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
