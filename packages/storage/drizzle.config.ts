import { defineConfig } from 'drizzle-kit';

if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL environment variable is required');
}

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/schema/index.ts',
    out: './src/migrations',
    dbCredentials: {
        url: process.env.POSTGRES_URL,
    },
});
