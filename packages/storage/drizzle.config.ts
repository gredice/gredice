import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.POSTGRES_URL;
if (!databaseUrl) {
    throw new Error('POSTGRES_URL environment variable is not set.');
}

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/schema/index.ts',
    out: './src/migrations',
    dbCredentials: {
        url: databaseUrl,
    },
});
