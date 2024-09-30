import { defineConfig } from "drizzle-kit";
import { config } from 'dotenv';

const isProduction = process.env.NODE_ENV === 'production';
if (!isProduction) {
    config({ path: '.env.development.local' });
}

export default defineConfig({
    dialect: "postgresql",
    schema: "./lib/storage/schema.ts",
    out: "./lib/storage/migrations",
    dbCredentials: {
        url: process.env.POSTGRES_URL!,
    }
});