import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "postgresql",
    schema: "./lib/storage/schema.ts",
    out: "./lib/storage/migrations",
    dbCredentials: {
        url: process.env.POSTGRES_URL!,
    }
});